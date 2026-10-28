import {randomUUID} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {describe,expect,it,vi} from "vitest";
import {FirstServiceContinuationRepository,type FirstServiceContinuation} from "./first-service-continuation";
vi.mock("server-only",()=>({}));
function fixture(){
  const input:FirstServiceContinuation={userId:randomUUID(),caseId:randomUUID(),workflowId:randomUUID(),previousDiscoveryJobId:randomUUID(),
    discoveryJobId:randomUUID(),idempotencyKey:randomUUID(),mode:"supplement",supplementalWebsiteUrls:["https://rival.example/"],
    gscSnapshotId:randomUUID(),ga4SnapshotId:randomUUID()};
  const receipt={schema_version:"v22_first_service_continuation_v1",user_id:input.userId,case_id:input.caseId,workflow_id:input.workflowId,
    previous_discovery_job_id:input.previousDiscoveryJobId,discovery_job_id:input.discoveryJobId,current_discovery_job_id:input.discoveryJobId,
    idempotency_key:input.idempotencyKey,mode:input.mode,idempotent:false};
  const state={schema_version:"v22_first_service_discovery_state_v1",user_id:input.userId,case_id:input.caseId,workflow_id:input.workflowId,
    initial_discovery_job_id:input.previousDiscoveryJobId,current_discovery_job_id:input.discoveryJobId,charge_state:"reserved",
    analysis_job_id:null,phase:"discovering",remaining_attempts:2};
  const rpc=vi.fn().mockResolvedValue({data:receipt,error:null});
  return {input,receipt,state,rpc,repo:new FirstServiceContinuationRepository({rpc} as unknown as SupabaseClient)};
}
describe("first-service continuation internal repository",()=>{
  it("registers one explicit continuation and strips private fields",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.receipt,previous_snapshot:{private:true}},error:null});
    expect(await f.repo.continue(f.input)).toEqual(f.receipt);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("continue_v22_first_service_discovery",{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_workflow_id:f.input.workflowId,
      p_previous_discovery_job_id:f.input.previousDiscoveryJobId,p_discovery_job_id:f.input.discoveryJobId,
      p_idempotency_key:f.input.idempotencyKey,p_mode:"supplement",p_supplemental_website_urls:f.input.supplementalWebsiteUrls,
      p_gsc_snapshot_id:f.input.gscSnapshotId,p_ga4_snapshot_id:f.input.ga4SnapshotId});
  });
  it("preserves the original operation on replay while exposing a newer current task",async()=>{
    const f=fixture(),data={...f.receipt,idempotent:true,current_discovery_job_id:randomUUID()};
    f.rpc.mockResolvedValue({data,error:null});expect(await f.repo.continue(f.input)).toEqual(data);
  });
  it("supports refresh with an unchanged empty supplement list",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.receipt,mode:"refresh"},error:null});
    await f.repo.continue({...f.input,mode:"refresh",supplementalWebsiteUrls:[]});
    expect(f.rpc.mock.calls[0][1].p_supplemental_website_urls).toEqual([]);
  });
  it.each(["user_id","case_id","workflow_id","previous_discovery_job_id","discovery_job_id","mode","idempotency_key","current_discovery_job_id"])("rejects changed receipt %s",async key=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.receipt,[key]:"wrong"},error:null});
    await expect(f.repo.continue(f.input)).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
  it("rejects invalid identities, duplicate domains and unsafe URL syntax before persistence",async()=>{
    const f=fixture();
    for(const patch of [{userId:"bad"},{discoveryJobId:f.input.previousDiscoveryJobId},{discoveryJobId:f.input.workflowId},
      {ga4SnapshotId:f.input.gscSnapshotId},{idempotencyKey:"short"},
      ...[[],["ftp://rival.example"],["https://user:password@rival.example"],["not a url"],
        ["https://rival.example","https://www.rival.example/other"],Array(4).fill("https://rival.example")].map(supplementalWebsiteUrls=>({supplementalWebsiteUrls}))])
      await expect(f.repo.continue({...f.input,...patch})).rejects.toMatchObject({code:"INVALID"});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [{code:"40001",message:"private"},"CONFLICT"],
    [{message:"FIRST_SERVICE_DISCOVERY_BUDGET_EXHAUSTED"},"BUDGET_EXHAUSTED"],
    [{message:"FIRST_SERVICE_REFRESH_NOT_REQUIRED"},"NOT_READY"],
    [{message:"sensitive provider context"},"UNAVAILABLE"],
  ])("sanitizes errors without retrying",async(error,code)=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error});
    await expect(f.repo.continue(f.input)).rejects.toMatchObject({code});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("reads current state without dispatch, debit, or private data exposure",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.state,request:{private:true}},error:null});
    expect(await f.repo.state(f.input)).toEqual(f.state);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("get_v22_first_service_discovery_state",{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_workflow_id:f.input.workflowId});
  });
  it("rejects inconsistent phases, wrong identities and impossible remaining attempts",async()=>{
    const f=fixture();for(const patch of [{user_id:randomUUID()},{current_discovery_job_id:f.input.workflowId},
      {remaining_attempts:4},{remaining_attempts:-1},{remaining_attempts:1.5},{remaining_attempts:true},
      {phase:"failed"},{charge_state:"consumed",phase:"completed"},{charge_state:"compensated",phase:"refresh_required"},
      {analysis_job_id:randomUUID()}]){
      f.rpc.mockResolvedValue({data:{...f.state,...patch},error:null});
      await expect(f.repo.state(f.input)).rejects.toMatchObject({code:"UNAVAILABLE"});
    }
  });
});
