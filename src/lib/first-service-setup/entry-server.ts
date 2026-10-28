import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord, isUuid } from "../verified-analysis-v22/contracts";
import { canonicalDigest, canonicalJsonText } from "../verified-analysis-v22/digest";
import { parseDiscoveryRequest, parseDiscoveryStatusResponse } from "../preflight-v22/validate";
import { FirstServiceDiscoveryRepository } from "../report-capability/first-service-discovery";
import { FirstServiceContinuationRepository } from "../report-capability/first-service-continuation";
import type { EntryCommand, EntryView } from "./entry-contract";

export class EntryError extends Error {
  constructor(public code: "NOT_FOUND" | "CONFLICT" | "NOT_READY" | "UNAVAILABLE") {super(code);}
}
export class FirstServiceEntryRepository {
  constructor(private db: SupabaseClient,private planningEnabled=false) {}
  private async load(userId: string, caseId: string) {
    const {data:r,error}=await this.db.rpc("get_v22_first_service_workspace",{p_user_id:userId,p_case_id:caseId});
    if(error) throw new EntryError(error.message==="FIRST_SERVICE_CASE_NOT_FOUND"?"NOT_FOUND":"UNAVAILABLE");
    if(!isRecord(r)||r.user_id!==userId||r.case_id!==caseId||!isRecord(r.business)||!isRecord(r.sources)
      ||!Number.isSafeInteger(r.credit_balance)||(r.credit_balance as number)<0||typeof r.other_work!=="boolean") throw new EntryError("UNAVAILABLE");
    const business=parseDiscoveryRequest({case_id:caseId,...r.business,queries:["one","two","three"]});
    if(!business.ok) throw new EntryError("UNAVAILABLE");
    const source=(name:string)=>{const s=r.sources as Record<string,unknown>,v=s[name];
      if(!isRecord(v)||typeof v.ready!=="boolean"||(v.id!==null&&!isUuid(v.id)))throw new EntryError("UNAVAILABLE");
      return {id:v.id as string|null,ready:v.ready};};
    const gsc=source("gsc"),ga4=source("ga4");
    const w=r.workflow;
    if(w!==null && (!isRecord(w)||w.user_id!==userId||w.case_id!==caseId||!isUuid(w.workflow_id)||!isUuid(w.current_discovery_job_id)
      ||!Number.isInteger(w.remaining_attempts)||(w.remaining_attempts as number)<0||(w.remaining_attempts as number)>3
      ||!["discovering","needs_competitors","awaiting_confirmation","refresh_required","analyzing","completed","failed"].includes(w.phase as string)))throw new EntryError("UNAVAILABLE");
    const request=w?parseDiscoveryRequest(r.request):null;
    if(request && (!request.ok||request.value.case_id!==caseId))throw new EntryError("UNAVAILABLE");
    const result=r.result===null?null:parseDiscoveryStatusResponse({discovery_job_id:isRecord(w)?w.current_discovery_job_id:null,
      status:"succeeded",stage:"completed",progress:100,message:"Discovery completed",result:r.result,error:null,
      created_at:isRecord(r.result)?r.result.created_at:null,updated_at:isRecord(r.result)?r.result.created_at:null});
    if(result && (!result.ok||result.value.result?.case_id!==caseId))throw new EntryError("UNAVAILABLE");
    const current=request?.ok?request.value:null,found=result?.ok?result.value.result:null;
    const service=business.value.primary_service,market=business.value.target_market.display_name;
    const view: EntryView={caseId,scopeHash:canonicalDigest(r.business),creditBalance:r.credit_balance as number,
      sourcesReady:gsc.ready&&ga4.ready&&!!business.value.business_identity.public_gbp_url,otherWork:r.other_work,
      gscSnapshotId:gsc.id,ga4SnapshotId:ga4.id,service,market,
      queries:current?.queries??[`${service} ${market}`,`${service} near me`,`${service} local service`],
      workflow:isRecord(w)?{id:w.workflow_id as string,discoveryId:w.current_discovery_job_id as string,
        remainingAttempts:w.remaining_attempts as number,phase:w.phase as NonNullable<EntryView["workflow"]>["phase"]}:null,
      candidates:found?.candidates.map(c=>({website:c.website_url,name:c.business_name,reason:c.relevance_reason}))??[],
      supplements:current?.supplemental_website_urls??[]};
    return {view,business:r.business,request:current,result:found};
  }
  async read(user:string,caseId:string) {return (await this.load(user,caseId)).view;}
  async execute(user:string,caseId:string,command:EntryCommand):Promise<EntryView> {
    const {view,business,request,result}=await this.load(user,caseId),w=view.workflow;
    // An already committed start is recovered by identity, never started again.
    if(command.action==="start" && w?.id===command.workflowId)return view;
    if(command.action==="start") {
      if(view.otherWork||(w&&w.phase!=="failed")||!view.sourcesReady)throw new EntryError("NOT_READY");
      if(command.scopeHash!==view.scopeHash)throw new EntryError("CONFLICT");
      await new FirstServiceDiscoveryRepository(this.db).reserve({userId:user,caseId,workflowId:command.workflowId,
        discoveryJobId:command.discoveryId,idempotencyKey:command.workflowId,
        request:{case_id:caseId,...business,queries:command.queries},gscSnapshotId:command.gscSnapshotId,ga4SnapshotId:command.ga4SnapshotId});
    } else {
      if(!w||w.id!==command.workflowId)throw new EntryError("CONFLICT");
      if(command.action==="supplement"||command.action==="refresh") {
        await new FirstServiceContinuationRepository(this.db).continue({userId:user,caseId,workflowId:w.id,
          previousDiscoveryJobId:command.discoveryId,discoveryJobId:command.operationId,idempotencyKey:command.operationId,
          mode:command.action,supplementalWebsiteUrls:command.websites,gscSnapshotId:command.gscSnapshotId,ga4SnapshotId:command.ga4SnapshotId});
      } else {
        if(!request||!result||w.discoveryId!==command.discoveryId || (this.planningEnabled&&command.planningRevision===undefined))throw new EntryError("CONFLICT");
        const selected=result.candidates.filter(c=>command.websites.includes(c.website_url));
        if(selected.length!==command.websites.length)throw new EntryError("CONFLICT");
        const envelope={schema_version:"v22_first_service_collection_v1",collection_request:{case_id:caseId,
          business_identity:request.business_identity,primary_service:request.primary_service,target_market:request.target_market,queries:request.queries,
          competitors:selected.map(c=>({competitor_id:c.competitor_id,business_name:c.business_name,website_url:c.website_url,
            public_gbp_url:c.public_gbp_url,confirmation_source:"user"})),
          generation_limits:{max_site_urls:500,max_deep_pages:50,max_competitor_pages_each:10,competitor_count:selected.length,max_pagespeed_pages:5,max_review_samples_each:30}},
          competitor_discovery:{discovery_id:result.discovery_id,candidate_digest:result.candidate_digest,
            market_snapshot_id:result.market_snapshot_id,market_snapshot_checksum:result.market_snapshot_checksum}};
        const {error}=await this.db.rpc(this.planningEnabled?"confirm_v22_first_service_entry_with_planning":"confirm_v22_first_service_entry",{p_user_id:user,p_case_id:caseId,p_workflow_id:w.id,
          p_discovery_job_id:command.discoveryId,p_gsc_snapshot_id:command.gscSnapshotId,p_ga4_snapshot_id:command.ga4SnapshotId,p_request_canonical:canonicalJsonText(envelope),
          ...(this.planningEnabled?{p_planning_revision:command.planningRevision}:{})});
        if(error)throw new EntryError(error.code==="40001"?"CONFLICT":error.code==="P0001"?"NOT_READY":"UNAVAILABLE");
      }
    }
    return this.read(user,caseId);
  }
}
