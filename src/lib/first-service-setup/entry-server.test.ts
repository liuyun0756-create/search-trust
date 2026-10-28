import {randomUUID} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {describe,it,expect,vi} from "vitest";
import {FirstServiceEntryRepository} from "./entry-server";
import type {EntryCommand} from "./entry-contract";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {E2E_BUSINESS,E2E_MARKET,discoveryStatusFixture} from "../../../e2e/fixtures/preflight";
vi.mock("server-only",()=>({}));

function fixture(active=false){
  const user=randomUUID(),caseId=randomUUID(),workflow=randomUUID(),discovery=randomUUID();
  const business={business_identity:E2E_BUSINESS,primary_service:"Plumbing",target_market:E2E_MARKET};
  const request={case_id:caseId,...business,queries:["plumber Austin","plumber near me","local plumber"]};
  const result={...discoveryStatusFixture("succeeded").result!,case_id:caseId,discovery_id:discovery};
  const raw={user_id:user,case_id:caseId,business,sources:{gsc:{id:randomUUID(),ready:true},ga4:{id:randomUUID(),ready:true}},credit_balance:5,other_work:false,
    workflow:active?{user_id:user,case_id:caseId,workflow_id:workflow,current_discovery_job_id:discovery,phase:"awaiting_confirmation",remaining_attempts:2}:null,
    request:active?request:null,result:active?result:null,collection:null};
  const rpc=vi.fn(async()=>({data:raw,error:null}));const repo=new FirstServiceEntryRepository({rpc} as unknown as SupabaseClient);
  const command:EntryCommand={action:active?"confirm":"start",workflowId:workflow,discoveryId:discovery,operationId:randomUUID(),
    scopeHash:canonicalDigest(business),gscSnapshotId:raw.sources.gsc.id,ga4SnapshotId:raw.sources.ga4.id,
    acceptedCredit:true,queries:request.queries,websites:active?[result.candidates[0].website_url]:[]};
  return {user,caseId,workflow,discovery,raw,command,rpc,repo};
}
describe("first-service entry trusted projections",()=>{
  it("uses the planning-aware atomic confirmation only after an explicit saved version",async()=>{
    const f=fixture(true),repo=new FirstServiceEntryRepository({rpc:f.rpc} as unknown as SupabaseClient,true);
    await expect(repo.execute(f.user,f.caseId,f.command)).rejects.toThrow("CONFLICT");
    await repo.execute(f.user,f.caseId,{...f.command,planningRevision:2});
    const calls=f.rpc.mock.calls as unknown as [string,Record<string,unknown>][];
    expect(calls.find(c=>c[0]==="confirm_v22_first_service_entry_with_planning")?.[1].p_planning_revision).toBe(2);
    expect(calls.some(c=>c[0]==="confirm_v22_first_service_entry")).toBe(false);
  });
  it("projects safe metadata without raw evidence or client-controlled costs",async()=>{
    const f=fixture();Object.assign(f.raw,{private_token:"do not expose"});
    const view=await f.repo.read(f.user,f.caseId);expect(view).toMatchObject({workflow:null,sourcesReady:true,creditBalance:5});
    expect(JSON.stringify(view)).not.toMatch(/private_token|business_identity|normalized_payload/);
  });
  it("derives confirmation from trusted candidates and sends complete backend defaults",async()=>{
    const f=fixture(true);await f.repo.execute(f.user,f.caseId,f.command);
    const call=f.rpc.mock.calls as unknown as [string,Record<string,unknown>][];
    const payload=JSON.parse(call.find(c=>c[0]==="confirm_v22_first_service_entry")![1].p_request_canonical as string);
    expect(payload.collection_request.competitors).toEqual([{competitor_id:f.raw.result!.candidates[0].competitor_id,
      business_name:f.raw.result!.candidates[0].business_name,website_url:f.command.websites[0],public_gbp_url:f.raw.result!.candidates[0].public_gbp_url,confirmation_source:"user"}]);
    expect(payload.collection_request.generation_limits).toEqual({max_site_urls:500,max_deep_pages:50,max_competitor_pages_each:10,competitor_count:1,max_pagespeed_pages:5,max_review_samples_each:30});
    expect(payload).not.toHaveProperty("report_type");
  });
  it("does not reserve again on a recovered start",async()=>{const f=fixture(true);await f.repo.execute(f.user,f.caseId,{...f.command,action:"start",websites:[]});expect(f.rpc).toHaveBeenCalledOnce();});
  it.each(["scope","other","source","active"])("does not charge when %s changed",async(mode)=>{
    const f=fixture(mode==="active");f.command.action="start";f.command.websites=[];
    if(mode==="active")f.command.workflowId=randomUUID();if(mode==="scope")f.command.scopeHash="sha256:"+"0".repeat(64);
    if(mode==="other")f.raw.other_work=true;if(mode==="source")f.raw.sources.gsc.ready=false;
    await expect(f.repo.execute(f.user,f.caseId,f.command)).rejects.toThrow();expect(f.rpc).toHaveBeenCalledOnce();
  });
  it.each(["candidate","discovery","workflow"])("rejects forged %s confirmation",async(mode)=>{
    const f=fixture(true);if(mode==="candidate")f.command.websites=["https://forged.example/"];
    if(mode==="discovery")f.command.discoveryId=randomUUID();if(mode==="workflow")f.command.workflowId=randomUUID();
    await expect(f.repo.execute(f.user,f.caseId,f.command)).rejects.toThrow("CONFLICT");expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("rejects cross-owner storage responses",async()=>{const f=fixture();f.raw.user_id=randomUUID();await expect(f.repo.read(f.user,f.caseId)).rejects.toThrow("UNAVAILABLE");});
  it.each([["08006","UNAVAILABLE"],["40001","CONFLICT"],["P0001","NOT_READY"]])("preserves ambiguous confirmation %s for recovery",async(code,expected)=>{
    const f=fixture(true);f.rpc.mockResolvedValueOnce({data:f.raw,error:null}).mockResolvedValueOnce({data:null,error:{code,message:"private"}} as never);
    await expect(f.repo.execute(f.user,f.caseId,f.command)).rejects.toThrow(expected);
  });
});
