import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord, isUuid } from "../verified-analysis-v22/contracts";

type Identity = {userId:string; caseId:string; workflowId:string};
export type FirstServiceContinuation = Identity & {
  previousDiscoveryJobId:string; discoveryJobId:string; idempotencyKey:string;
  mode:"supplement"|"refresh"; supplementalWebsiteUrls:string[];
  gscSnapshotId:string; ga4SnapshotId:string;
};
export type FirstServiceContinuationReceipt = {
  schema_version:"v22_first_service_continuation_v1";
  user_id:string; case_id:string; workflow_id:string;
  previous_discovery_job_id:string; discovery_job_id:string; current_discovery_job_id:string;
  idempotency_key:string; mode:"supplement"|"refresh"; idempotent:boolean;
};
export type FirstServiceDiscoveryState = {
  schema_version:"v22_first_service_discovery_state_v1";
  user_id:string; case_id:string; workflow_id:string;
  initial_discovery_job_id:string; current_discovery_job_id:string;
  charge_state:"reserved"|"consumed"|"compensated"; analysis_job_id:string|null;
  phase:"discovering"|"needs_competitors"|"awaiting_confirmation"|"refresh_required"|"analyzing"|"completed"|"failed";
  remaining_attempts:number;
};
export class FirstServiceContinuationError extends Error {
  constructor(public readonly code:"INVALID"|"CONFLICT"|"NOT_READY"|"BUDGET_EXHAUSTED"|"UNAVAILABLE") { super(code); }
}
function validIdentity(input:Identity) {return [input.userId,input.caseId,input.workflowId].every(isUuid);}
function validUrls(urls:unknown):urls is string[] {
  if(!Array.isArray(urls)||urls.length>3)return false;
  try {
    const domains=urls.map(value=>{
      if(typeof value!=="string"||value.length>2048||/\s/.test(value))throw Error();
      const url=new URL(value);
      if(!["http:","https:"].includes(url.protocol)||url.username||url.password||!url.hostname)throw Error();
      return url.hostname.toLowerCase().replace(/^www\./,"");
    });
    return new Set(domains).size===domains.length;
  }catch{return false;}
}
function fail(error:{code?:string;message?:string}):never {
  throw new FirstServiceContinuationError(error.code==="40001"?"CONFLICT"
    :error.message==="FIRST_SERVICE_DISCOVERY_BUDGET_EXHAUSTED"?"BUDGET_EXHAUSTED"
      :["FIRST_SERVICE_REFRESH_NOT_REQUIRED","FIRST_SERVICE_DISCOVERY_IN_PROGRESS","FIRST_SERVICE_SUPPLEMENTS_UNCHANGED",
        "FIRST_SERVICE_DISCOVERY_CLOSED"].includes(error.message??"")?"NOT_READY":"UNAVAILABLE");
}

/** Internal only. Neither reading state nor replaying an intent starts a new paid workflow. */
export class FirstServiceContinuationRepository {
  constructor(private readonly db:SupabaseClient){}
  async continue(input:FirstServiceContinuation):Promise<FirstServiceContinuationReceipt> {
    if(!validIdentity(input)||![input.previousDiscoveryJobId,input.discoveryJobId,input.gscSnapshotId,input.ga4SnapshotId].every(isUuid)
      ||input.discoveryJobId===input.previousDiscoveryJobId||input.discoveryJobId===input.workflowId
      ||input.gscSnapshotId===input.ga4SnapshotId||!/^[A-Za-z0-9._:-]{8,200}$/.test(input.idempotencyKey)
      ||!["supplement","refresh"].includes(input.mode)||!validUrls(input.supplementalWebsiteUrls)
      ||(input.mode==="supplement"&&!input.supplementalWebsiteUrls.length))throw new FirstServiceContinuationError("INVALID");
    const {data,error}=await this.db.rpc("continue_v22_first_service_discovery",{
      p_user_id:input.userId,p_case_id:input.caseId,p_workflow_id:input.workflowId,
      p_previous_discovery_job_id:input.previousDiscoveryJobId,p_discovery_job_id:input.discoveryJobId,
      p_idempotency_key:input.idempotencyKey,p_mode:input.mode,p_supplemental_website_urls:input.supplementalWebsiteUrls,
      p_gsc_snapshot_id:input.gscSnapshotId,p_ga4_snapshot_id:input.ga4SnapshotId,
    });
    if(error)fail(error);
    if(!isRecord(data)||data.schema_version!=="v22_first_service_continuation_v1"||data.user_id!==input.userId
      ||data.case_id!==input.caseId||data.workflow_id!==input.workflowId||data.previous_discovery_job_id!==input.previousDiscoveryJobId
      ||data.discovery_job_id!==input.discoveryJobId||data.idempotency_key!==input.idempotencyKey||data.mode!==input.mode
      ||!isUuid(data.current_discovery_job_id)||[input.workflowId,input.previousDiscoveryJobId].includes(data.current_discovery_job_id)||typeof data.idempotent!=="boolean"
      ||(!data.idempotent&&data.current_discovery_job_id!==input.discoveryJobId))throw new FirstServiceContinuationError("UNAVAILABLE");
    return {schema_version:"v22_first_service_continuation_v1",user_id:input.userId,case_id:input.caseId,workflow_id:input.workflowId,
      previous_discovery_job_id:input.previousDiscoveryJobId,discovery_job_id:input.discoveryJobId,
      current_discovery_job_id:data.current_discovery_job_id,idempotency_key:input.idempotencyKey,mode:input.mode,idempotent:data.idempotent};
  }
  async state(input:Identity):Promise<FirstServiceDiscoveryState> {
    if(!validIdentity(input))throw new FirstServiceContinuationError("INVALID");
    const {data,error}=await this.db.rpc("get_v22_first_service_discovery_state",{
      p_user_id:input.userId,p_case_id:input.caseId,p_workflow_id:input.workflowId});
    if(error)fail(error);
    if(!isRecord(data)||data.schema_version!=="v22_first_service_discovery_state_v1"||data.user_id!==input.userId
      ||data.case_id!==input.caseId||data.workflow_id!==input.workflowId||!isUuid(data.initial_discovery_job_id)
      ||!isUuid(data.current_discovery_job_id)||[data.initial_discovery_job_id,data.current_discovery_job_id].includes(input.workflowId)
      ||!["reserved","consumed","compensated"].includes(data.charge_state as string)
      ||(data.analysis_job_id!==null&&data.analysis_job_id!==input.workflowId)
      ||!Number.isInteger(data.remaining_attempts)||(data.remaining_attempts as number)<0||(data.remaining_attempts as number)>3
      ||(data.charge_state==="consumed"?(data.phase!=="completed"||data.analysis_job_id!==input.workflowId)
        :data.charge_state==="compensated"?data.phase!=="failed"
          :data.analysis_job_id!==null?data.phase!=="analyzing"
            :!["discovering","needs_competitors","awaiting_confirmation","refresh_required"].includes(data.phase as string)))
      throw new FirstServiceContinuationError("UNAVAILABLE");
    return {schema_version:"v22_first_service_discovery_state_v1",user_id:input.userId,case_id:input.caseId,workflow_id:input.workflowId,
      initial_discovery_job_id:data.initial_discovery_job_id,current_discovery_job_id:data.current_discovery_job_id,
      charge_state:data.charge_state as FirstServiceDiscoveryState["charge_state"],analysis_job_id:data.analysis_job_id,
      phase:data.phase as FirstServiceDiscoveryState["phase"],remaining_attempts:data.remaining_attempts as number};
  }
}
