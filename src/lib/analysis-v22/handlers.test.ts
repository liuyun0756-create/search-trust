import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAnalysisStatusHandler, createAnalysisSubmitHandler, createAnalysisStreamHandler } from "./handlers";
import type { AnalysisRepository } from "./repository";
import capabilityCompleted from "../report-capability/runtime-contracts/completed.json";

const userId = "00000000-0000-4000-8000-000000000001";
const caseId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const discoveryId = "33333333-3333-4333-8333-333333333333";
const workflowId = "44444444-4444-4444-8444-444444444444";
const market = { display_name: "Austin, TX", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const business = { business_name: "Acme Plumbing", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "hybrid", primary_location: market, public_gbp_url: null };
const body = {
  case_id: caseId,
  report_type: "prospect",
  business_identity: business,
  primary_service: "Plumbing",
  target_market: market,
  queries: ["plumber Austin", "best plumber Austin", "plumber near me"],
  competitors: [{ competitor_id: "cp_example", business_name: "Example", website_url: "https://competitor.example/", public_gbp_url: null, confirmation_source: "user" }],
  first_party_snapshots: [],
  parent_report: null,
};

function repository(): AnalysisRepository {
  return {
    start: vi.fn(async () => undefined),
    getOwned: vi.fn(async () => ({ id: jobId, caseId, reportId: null })),
  };
}

function deps(repo: AnalysisRepository, fetcher: typeof fetch, signedIn = true) {
  return {
    getCurrentUser: async () => signedIn ? { userId } : null,
    createRepository: () => repo,
    getConfig: () => ({ baseUrl: "https://internal.example", token: "server-secret" }),
    fetcher,
    timeoutMs: 1000,
  };
}

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

function queued() {
  return {job_id:jobId,revision:1,run_generation:1,status:"queued",stage:"queued",progress:0,
    message:"Queued to prepare the confirmed analysis sources.",report:null,error:null,
    created_at:"2026-10-21T00:00:00Z",deadline_at:"2026-10-21T00:20:00Z",updated_at:"2026-10-21T00:00:00Z"};
}

function intakeRequest() {
  return request("/api/v2/analyze",{method:"POST",body:JSON.stringify(body),headers:{
    "x-searchtrust-job-id":jobId,"x-searchtrust-discovery-id":discoveryId,"x-searchtrust-workflow-id":workflowId,
    "idempotency-key":`analyze:${jobId}`,"x-searchtrust-user-id":"untrusted-browser-value"}});
}

describe("default-off capability intake",()=>{
  it("requires and forwards an explicitly confirmed planning version when enabled",async()=>{
    const repo=repository(),fetcher=vi.fn<typeof fetch>(async()=>Response.json(queued()));
    const h=createAnalysisSubmitHandler({...deps(repo,fetcher),isCapabilityIntakeEnabled:()=>true,isPlanningEnabled:()=>true});
    expect((await h(intakeRequest())).status).toBe(409);expect(fetcher).not.toHaveBeenCalled();
    const req=intakeRequest();req.headers.set("x-searchtrust-planning-revision","2");expect((await h(req)).status).toBe(202);
    expect(new Headers(fetcher.mock.calls[0][1]!.headers).get("x-searchtrust-planning-revision")).toBe("2");
    const invalid=intakeRequest();invalid.headers.set("x-searchtrust-planning-revision","-1");expect((await h(invalid)).status).toBe(409);
  });
  it("forwards server identity and never binds the old job first",async()=>{
    const repo=repository(),fetcher=vi.fn<typeof fetch>(async()=>Response.json(queued()));
    const response=await createAnalysisSubmitHandler({...deps(repo,fetcher),isCapabilityIntakeEnabled:()=>true})(intakeRequest());
    expect(response.status).toBe(202); expect(repo.start).not.toHaveBeenCalled();
    const [url,init]=fetcher.mock.calls[0];
    expect(url).toBe("https://internal.example/api/v2/capability-acquisition");
    expect(new Headers(init?.headers).get("x-searchtrust-user-id")).toBe(userId);
    expect(new Headers(init?.headers).get("x-searchtrust-workflow-id")).toBe(workflowId);
    expect(init?.redirect).toBe("error"); expect(JSON.parse(String(init?.body))).toEqual(body);
  });
  it.each(["missing-config","unavailable","invalid-response"])("does not fall back to old binding after %s",async(kind)=>{
    const repo=repository(), fetcher=vi.fn<typeof fetch>(async()=>kind==="unavailable"?Response.json({}, {status:503}):Response.json({...queued(),job_id:userId}));
    const options={...deps(repo,fetcher),isCapabilityIntakeEnabled:()=>true};
    if(kind==="missing-config")Object.assign(options,{getConfig:()=>null});
    const response=await createAnalysisSubmitHandler(options)(intakeRequest());
    expect(response.status).toBe(kind==="invalid-response"?502:503);
    expect(repo.start).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(kind==="missing-config"?0:1);
  });
  it.each(["queued","completed"])("reads owned %s SQL state without depending on Redis",async(kind)=>{
    const repo=repository(), fetcher=vi.fn<typeof fetch>();
    const completed=structuredClone(capabilityCompleted);
    completed.job_id=jobId;completed.report_reference.report_id=jobId;completed.report_reference.case_id=caseId;
    repo.getAcquisitionStatus=vi.fn(async()=>kind==="queued"?queued():completed);
    const options={...deps(repo,fetcher),isCapabilityReadEnabled:()=>true};
    const response=await createAnalysisStatusHandler(options)(request(`/api/v2/tasks/${jobId}`),{params:Promise.resolve({id:jobId})});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({database_report_id:kind==="queued"?null:jobId});
    const stream=await createAnalysisStreamHandler(options)(request(`/api/v2/tasks/${jobId}/stream`),{params:Promise.resolve({id:jobId})});
    expect(stream.headers.get("content-type")).toBe("text/event-stream");
    expect(await stream.text()).toContain("event: state\ndata: ");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["unowned","rpc-failed","invalid-state"])("fails closed on %s status lookup",async(kind)=>{
    const repo=repository(), fetcher=vi.fn<typeof fetch>();
    if(kind==="unowned")repo.getOwned=vi.fn(async()=>null);
    repo.getAcquisitionStatus=vi.fn(async()=>{if(kind==="rpc-failed")throw new Error("private storage detail"); return {...queued(),job_id:userId};});
    const options={...deps(repo,fetcher),isCapabilityReadEnabled:()=>true};
    for(const factory of [createAnalysisStatusHandler,createAnalysisStreamHandler]) {
      const response=await factory(options)(request(`/api/v2/tasks/${jobId}`),{params:Promise.resolve({id:jobId})});
      expect(response.status).toBe(kind==="unowned"?404:503);
      expect(await response.text()).not.toContain("private storage detail");
    }
    expect(fetcher).not.toHaveBeenCalled();
    if(kind==="unowned")expect(repo.getAcquisitionStatus).not.toHaveBeenCalled();
  });
  it("falls back to the legacy status reader only for unmarked jobs",async()=>{
    const repo=repository(),fetcher=vi.fn<typeof fetch>(async()=>Response.json(queued()));
    repo.getAcquisitionStatus=vi.fn(async()=>null);
    const response=await createAnalysisStatusHandler({...deps(repo,fetcher),isCapabilityReadEnabled:()=>true})(request(`/api/v2/tasks/${jobId}`),{params:Promise.resolve({id:jobId})});
    expect(response.status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("v2.2 analysis handlers", () => {
  it("accepts only the owned Case completion reference from the new worker", async () => {
    const repo=repository();
    const payload=structuredClone(capabilityCompleted);
    payload.job_id=jobId;payload.report_reference.report_id=jobId;payload.report_reference.case_id=caseId;
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json(payload));
    const handler=createAnalysisStatusHandler(deps(repo,fetcher));
    const response=await handler(request(`/api/v2/tasks/${jobId}`),{params:Promise.resolve({id:jobId})});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({database_report_id:jobId,report_reference:payload.report_reference});
    payload.report_reference.case_id=userId;
    expect((await handler(request(`/api/v2/tasks/${jobId}`),{params:Promise.resolve({id:jobId})})).status).toBe(502);
  });
  it("reserves the owned job before submitting the exact request with server-only auth", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ job_id: jobId, status: "queued", estimated_seconds: 600 }, { status: 202 }));
    const response = await createAnalysisSubmitHandler(deps(repo, fetcher))(
      request("/api/v2/analyze", {
        method: "POST",
        headers: { "x-searchtrust-job-id": jobId, "x-searchtrust-discovery-id": discoveryId, "x-searchtrust-workflow-id": workflowId, "idempotency-key": `analyze:${jobId}` },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(202);
    expect(repo.start).toHaveBeenCalledWith(userId, caseId, workflowId, jobId, `analyze:${jobId}`, null);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://internal.example/api/v2/analyze");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer server-secret");
    expect(headers.get("x-searchtrust-discovery-id")).toBe(discoveryId);
    expect(headers.get("x-searchtrust-workflow-id")).toBe(workflowId);
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it("never reserves or forwards an unauthenticated request", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>();
    const response = await createAnalysisSubmitHandler(deps(repo, fetcher, false))(
      request("/api/v2/analyze", { method: "POST", body: JSON.stringify(body) }),
    );
    expect(response.status).toBe(401);
    expect(repo.start).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks local ownership before returning upstream task state", async () => {
    const repo = repository();
    repo.getOwned = vi.fn(async () => ({ id: jobId, caseId, reportId: null }));
    const timestamp = "2026-09-04T08:00:00Z";
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      job_id: jobId, revision: 2, run_generation: 1,
      status: "running", stage: "collecting_site", progress: 20,
      message: "Collecting site evidence.", report: null, error: null,
      created_at: timestamp, deadline_at: "2026-09-04T08:20:00Z", updated_at: timestamp,
    }));
    const response = await createAnalysisStatusHandler(deps(repo, fetcher))(
      request(`/api/v2/tasks/${jobId}`),
      { params: Promise.resolve({ id: jobId }) },
    );
    expect(response.status).toBe(200);
    expect(repo.getOwned).toHaveBeenCalledWith(userId, jobId);
    expect(await response.json()).toMatchObject({ job_id: jobId, progress: 20, database_report_id: null });
  });
});
