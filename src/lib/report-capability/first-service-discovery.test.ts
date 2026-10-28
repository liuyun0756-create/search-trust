import {randomUUID} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {describe,expect,it,vi} from "vitest";
import {FirstServiceDiscoveryRepository, type FirstServiceDiscoveryStart} from "./first-service-discovery";
vi.mock("server-only",()=>({}));

function fixture() {
  const market={display_name:"Austin, TX, US",country_code:"US",region:"TX",city:"Austin",postal_code:null,latitude:null,longitude:null};
  const input:FirstServiceDiscoveryStart={userId:randomUUID(),caseId:randomUUID(),workflowId:randomUUID(),discoveryJobId:randomUUID(),
    idempotencyKey:randomUUID(),gscSnapshotId:randomUUID(),ga4SnapshotId:randomUUID(),request:null};
  const request={case_id:input.caseId,business_identity:{business_name:"Acme Plumbing",site_url:"https://example.com/",
    normalized_domain:"example.com",operating_model:"hybrid",primary_location:market,public_gbp_url:"https://www.google.com/maps?cid=123"},
    primary_service:"Plumbing",target_market:market,queries:["plumber","emergency plumber","local plumber"]};
  input.request=request;
  const data={schema_version:"v22_first_service_discovery_v1",user_id:input.userId,case_id:input.caseId,workflow_id:input.workflowId,
    discovery_job_id:input.discoveryJobId,idempotency_key:input.idempotencyKey,charge_state:"reserved",analysis_job_id:null,
    phase:"discovering",awaiting_confirmation:false,idempotent:false,credit_balance:4,created_at:"2026-10-21T00:00:00Z",deadline_at:"2026-10-21T00:20:00Z"};
  const status={discovery_job_id:input.discoveryJobId,status:"queued",stage:"queued",progress:0,message:"Queued.",
    result:null,error:null,created_at:"2026-10-21T00:00:00Z",updated_at:"2026-10-21T00:01:00Z"};
  const result={discovery_id:input.discoveryJobId,case_id:input.caseId,input_digest:`sha256:${"1".repeat(64)}`,
    candidate_digest:`sha256:${"2".repeat(64)}`,market_snapshot_id:randomUUID(),market_snapshot_checksum:`sha256:${"3".repeat(64)}`,
    candidates:[],ready_for_confirmation:false,data_gaps:[{gap_code:"NO_CANDIDATES",message:"Confirm a competitor.",blocking:true,resolution:"Supplement the search."}],
    limitations:[],created_at:status.created_at,expires_at:"2026-10-22T00:00:00Z"};
  const rpc=vi.fn().mockResolvedValue({data,error:null});
  return {input,request,data,status,result,rpc,repo:new FirstServiceDiscoveryRepository({rpc} as unknown as SupabaseClient)};
}

describe("first-service discovery server persistence seam",()=>{
  it("reserves a verified workflow with the original request and exposes only a safe receipt",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.data,normalized_payload:{secret:"private source"}},error:null});
    expect(await f.repo.reserve(f.input)).toEqual(f.data);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("reserve_v22_first_service_discovery",{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_workflow_id:f.input.workflowId,p_discovery_job_id:f.input.discoveryJobId,
      p_idempotency_key:f.input.idempotencyKey,p_request:f.request,p_gsc_snapshot_id:f.input.gscSnapshotId,p_ga4_snapshot_id:f.input.ga4SnapshotId,
    });
  });
  it.each(["user_id","case_id","workflow_id","discovery_job_id","idempotency_key","charge_state","analysis_job_id","deadline_at"])("rejects invalid %s receipts",async key=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.data,[key]:"wrong"},error:null});
    await expect(f.repo.reserve(f.input)).rejects.toMatchObject({code:"FIRST_SERVICE_UNAVAILABLE"});
  });
  it("rejects inconsistent receipt lifecycles and invalid balances",async()=>{
    const f=fixture();
    for(const patch of [{charge_state:"consumed"},{charge_state:"compensated",awaiting_confirmation:true},
      {analysis_job_id:f.input.workflowId,awaiting_confirmation:true},{credit_balance:-1},{credit_balance:1.5},{idempotent:"true"}]){
      f.rpc.mockResolvedValue({data:{...f.data,...patch},error:null});
      await expect(f.repo.reserve(f.input)).rejects.toMatchObject({code:"FIRST_SERVICE_UNAVAILABLE"});
    }
  });
  it.each(["reserved","consumed","compensated"])("recovers a %s workflow without reissuing identifiers",async charge_state=>{
    const f=fixture();const data={...f.data,charge_state,idempotent:true,analysis_job_id:charge_state==="consumed"?f.input.workflowId:null,
      phase:charge_state==="consumed"?"completed":charge_state==="compensated"?"failed":"discovering"};
    f.rpc.mockResolvedValue({data,error:null});expect(await f.repo.reserve(f.input)).toEqual(data);expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("validates identifiers, matching scope and current discovery limits before persistence",async()=>{
    const f=fixture();
    for(const patch of [{userId:"wrong"},{discoveryJobId:f.input.workflowId},{ga4SnapshotId:f.input.gscSnapshotId},{idempotencyKey:"x"},
      ...[{case_id:randomUUID()},{queries:["same","SAME","third"]},{queries:["a".repeat(301),"b","c"]},
        {search_device:"desktop"},{search_language:"fr"},{supplemental_website_urls:["https://another.invalid/"]},
        {business_identity:{...f.request.business_identity,public_gbp_url:null}},{report_type:"prospect"}]
        .map(request=>({request:{...f.request,...request}}))]){
      await expect(f.repo.reserve({...f.input,...patch})).rejects.toMatchObject({code:"FIRST_SERVICE_INVALID"});
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([{code:"40001",message:"private diagnostics",expected:"FIRST_SERVICE_CONFLICT"},
    {code:"P0001",message:"INSUFFICIENT_CREDITS",expected:"INSUFFICIENT_CREDITS"},
    {code:"503",message:"sensitive data",expected:"FIRST_SERVICE_UNAVAILABLE"}])("sanitizes $expected and never retries",async error=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error});
    await expect(f.repo.reserve(f.input)).rejects.toMatchObject({code:error.expected});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not convert pending or malformed backend responses into failures or refunds",async()=>{
    const f=fixture();expect(await f.repo.recordBackendOutcome(f.input,f.status)).toBe("pending");
    await expect(f.repo.recordBackendOutcome(f.input,{error:"network timeout"})).rejects.toMatchObject({code:"FIRST_SERVICE_INVALID"});
    await expect(f.repo.recordBackendOutcome(f.input,{...f.status,status:"failed"})).rejects.toMatchObject({code:"FIRST_SERVICE_INVALID"});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("records an actual backend result, including a successful search with no candidates, without generating a report",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error:null});
    expect(await f.repo.recordBackendOutcome(f.input,{...f.status,status:"succeeded",stage:"completed",progress:100,result:f.result})).toBe("recorded");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("record_v22_first_service_discovery",{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_workflow_id:f.input.workflowId,p_result:f.result,
    });
  });
  it("rejects crossed discovery/Case results before recording",async()=>{
    const f=fixture(),status={...f.status,status:"succeeded",stage:"completed",progress:100,result:f.result};
    for(const patch of [{discovery_job_id:randomUUID()},{result:{...f.result,case_id:randomUUID()}},{result:{...f.result,discovery_id:randomUUID()}}])
      await expect(f.repo.recordBackendOutcome(f.input,{...status,...patch})).rejects.toMatchObject({code:"FIRST_SERVICE_INVALID"});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("uses a confirmed backend failure with the exact discovery identity, not a transport exception",async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:true,error:null});
    const status={...f.status,status:"failed",stage:"failed",error:{error_code:"DISCOVERY_RETRY_EXHAUSTED",user_message:"Try again later.",
      retryable:true,stage:"failed",diagnostic_id:randomUUID()}};
    expect(await f.repo.recordBackendOutcome(f.input,status)).toBe("failed");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("fail_v22_first_service_discovery",{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_workflow_id:f.input.workflowId,p_discovery_job_id:f.input.discoveryJobId,p_reason:"DISCOVERY_FAILED",
    });
    f.rpc.mockResolvedValue({data:null,error:{message:"FIRST_SERVICE_DISCOVERY_NOT_REFUNDABLE"}});
    await expect(f.repo.recordBackendOutcome(f.input,status)).rejects.toMatchObject({code:"FIRST_SERVICE_UNAVAILABLE"});
  });
});
