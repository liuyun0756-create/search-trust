import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCapabilityDispatchHandler } from "./dispatch-handler";
import { validateCapabilityDispatch, type CapabilityDispatch } from "./runtime";
import completed from "./runtime-contracts/completed.json";
import envelope from "./runtime-contracts/request.json";

const user = "11111111-1111-4111-8111-111111111111";
const caseId = completed.report_reference.case_id, jobId = completed.job_id, key = "original-analysis";
function receipt(): CapabilityDispatch {
  return { schema_version: "v22_capability_dispatch_v1", user_id:user, case_id:caseId,job_id:jobId,
    idempotency_key:key,request:structuredClone(envelope) as CapabilityDispatch["request"],
    run_generation:1,revision:1,attempt_count:0,cost_counters:{},status:"queued",
    created_at:completed.created_at,deadline_at:completed.deadline_at,completion:null };
}
const request = (body: unknown = {}) => new NextRequest("http://localhost/api/v2/cases/id/capability-analysis",{
  method:"POST",headers:{"X-SearchTrust-Job-ID":jobId,"Idempotency-Key":key,"X-SearchTrust-User-ID":"forged-owner"},
  body:JSON.stringify(body),
});
function setup() {
  const dispatch = receipt();
  const queued = { job_id:jobId,revision:1,run_generation:1,status:"queued",stage:"queued",progress:0,message:"Queued.",
    report:null,error:null,created_at:completed.created_at,deadline_at:completed.deadline_at,updated_at:completed.created_at };
  const deps = {
    getCurrentUser:vi.fn(async () => ({userId:user}) as {userId:string}|null),
    isEnabled:()=>true,loadDispatch:vi.fn(async()=>dispatch),
    getConfig:()=>({baseUrl:"https://internal.example",token:"server-token"}),
    fetcher:vi.fn<typeof fetch>(async()=>Response.json(queued)),
    timeoutMs:1000,
  };
  return {deps,dispatch,queued,run:(body?:unknown)=>createCapabilityDispatchHandler(deps)(request(body),{params:Promise.resolve({id:caseId})})};
}
describe("owner dispatch of already prepared analysis",()=>{
  it("sends only server-loaded frozen reference and authenticated identity",async()=>{
    const {deps,run} = setup();
    expect((await run()).status).toBe(202);
    expect(deps.loadDispatch).toHaveBeenCalledWith(user,caseId,jobId,key);
    const [url,init] = deps.fetcher.mock.calls[0];
    expect(url).toBe("https://internal.example/api/v2/capability-analyze");
    expect(JSON.parse(init!.body as string)).toEqual(envelope);
    expect(new Headers(init?.headers).get("x-searchtrust-user-id")).toBe(user);
    expect(init?.redirect).toBe("error");
  });
  it.each(["disabled","signed-out","source-body","oversize","owner-mismatch","key-mismatch","expired"])("blocks %s without dispatch",async(kind)=>{
    const {deps,dispatch,run} = setup();
    if(kind==="disabled")deps.isEnabled=()=>false;
    if(kind==="signed-out")deps.getCurrentUser.mockResolvedValue(null);
    if(kind==="owner-mismatch")dispatch.user_id="22222222-2222-4222-8222-222222222222";
    if(kind==="key-mismatch")dispatch.idempotency_key="another-analysis";
    if(kind==="expired")deps.loadDispatch.mockRejectedValue(new Error("private SQL constraint"));
    const response=await run(kind==="source-body"?{request:envelope}:kind==="oversize"?{data:"x".repeat(5000)}:undefined);
    expect(response.status).toBe(kind==="disabled"?404:kind==="signed-out"?401:["source-body","oversize"].includes(kind)?400:409);
    expect(deps.fetcher).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("private SQL");
  });
  it("returns authoritative completed result while the queue is offline, without leaking receipt",async()=>{
    const {deps,dispatch,run}=setup();
    dispatch.status="succeeded";dispatch.completion=structuredClone(completed) as CapabilityDispatch["completion"];
    expect(validateCapabilityDispatch(dispatch)).toBe(true);
    deps.fetcher.mockRejectedValue(new Error("offline"));
    const response=await run();
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(completed);
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it("network failure can retry the same dispatch and performs no credit mutation",async()=>{
    const {deps,run,queued}=setup();
    deps.fetcher.mockRejectedValueOnce(new Error("private endpoint details")).mockResolvedValue(Response.json(queued));
    const failed=await run();
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private endpoint");
    expect((await run()).status).toBe(202);
    expect(deps.loadDispatch.mock.calls[0]).toEqual(deps.loadDispatch.mock.calls[1]);
    expect(deps.fetcher.mock.calls[0][1]?.body).toBe(deps.fetcher.mock.calls[1][1]?.body);
  });
  it.each(["job","case","private","unknown-schema"])("rejects upstream %s mismatch",async(kind)=>{
    const {deps,run}=setup();
    const value=structuredClone(completed) as Record<string,unknown>;
    if(kind==="job")value.job_id=user;
    if(kind==="case")value.report_reference={...completed.report_reference,case_id:user};
    if(kind==="private")value.input_manifest={user_id:user};
    if(kind==="unknown-schema")value.schema_version="future";
    deps.fetcher.mockResolvedValue(Response.json(value));
    expect((await run()).status).toBe(502);
  });
});
