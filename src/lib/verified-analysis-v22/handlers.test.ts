import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVerifiedAnalysisSubmitHandler } from "./handlers";
import { VerifiedAnalysisContractError, type VerifiedAnalysisRepository } from "./repository";
import { canonicalDigest } from "./digest";

vi.mock("server-only", () => ({}));
const userId = "00000000-0000-4000-8000-000000000001";
const caseId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const parentId = "33333333-3333-4333-8333-333333333333";
const gscId = "44444444-4444-4444-8444-444444444444";
const ga4Id = "55555555-5555-4555-8555-555555555555";
const publicGbpId = "66666666-6666-4666-8666-666666666666";
const binding = { job_id: jobId, created: true, idempotent: false, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId, audit_credits: 3 };
const bindingChecksum = canonicalDigest({ case_id: caseId, job_id: jobId, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId });
const taskRequest = { schema_version: "v22_verified_task_request_v1" as const, case_id: caseId, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId, input_checksum: bindingChecksum };
const accepted = { job_id: jobId, status: "queued", estimated_seconds: 600 };
function setup() {
  const start = vi.fn<VerifiedAnalysisRepository["start"]>(async () => ({ binding, request: taskRequest }));
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(accepted, { status: 202 }));
  const deps = { getCurrentUser: vi.fn(async (): Promise<{ userId: string } | null> => ({ userId })), isEnabled: vi.fn(() => true), createRepository: () => ({ start }), getConfig: (): { baseUrl: string; token: string } | null => ({ baseUrl: "https://railway.invalid", token: "server-secret" }), fetcher, timeoutMs: 10 };
  return { deps, start, fetcher, submit: createVerifiedAnalysisSubmitHandler(deps) };
}
function request(body = "{}", headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/v2/cases/${caseId}/verified-analysis`, { method: "POST", headers: { "x-searchtrust-job-id": jobId, "idempotency-key": "verified-attempt-1", ...headers }, body });
}
const context = (id = caseId) => ({ params: Promise.resolve({ id }) });
afterEach(() => vi.unstubAllEnvs());

describe("Verified submit boundary", () => {
  it("submits only the frozen RPC IDs and checksum with internal authentication", async () => {
    const { submit, start, fetcher } = setup();
    const response = await submit(request(), context());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(accepted);
    expect(start).toHaveBeenCalledWith(userId, caseId, jobId, "verified-attempt-1", null);
    expect(fetcher).toHaveBeenCalledWith("https://railway.invalid/api/v2/verified-analyze", expect.objectContaining({ method: "POST", body: JSON.stringify({ schema_version: "v22_verified_task_request_v1", case_id: caseId, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId, input_checksum: bindingChecksum }), headers: expect.objectContaining({ authorization: "Bearer server-secret", "X-SearchTrust-Job-ID": jobId, "Idempotency-Key": "verified-attempt-1" }) }));
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(fetcher.mock.invocationCallOrder[0]);
  });

  it("returns 401 before checking the flag for unauthenticated users", async () => {
    const { deps, submit, start } = setup();
    deps.getCurrentUser.mockResolvedValue(null);
    expect((await submit(request(), context())).status).toBe(401);
    expect(deps.isEnabled).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("returns 404 before parsing invalid IDs or body when disabled", async () => {
    const { deps, submit, start, fetcher } = setup();
    deps.isEnabled.mockReturnValue(false);
    expect((await submit(request("invalid"), context("invalid"))).status).toBe(404);
    expect(start).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["", "null", "[]", '"{}"', "1", "true", "{", '{"case_id":"ignored"}', '{"parent_report_id":"injected"}', '{"gsc_snapshot_id":"injected"}', '{"ga4_snapshot_id":"injected"}', '{"public_gbp_snapshot_id":"injected"}', '{"input_checksum":"injected"}', '{"job_id":"injected"}', '{"parent_report":{}}', '{"__proto__":{}}'])("rejects every nonempty-object browser body: %s", async (body) => {
    const { submit, start, fetcher } = setup();
    expect((await submit(request(body), context())).status).toBe(400);
    expect(start).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([{ "x-searchtrust-job-id": "invalid" }, { "idempotency-key": "short" }, { "x-searchtrust-previous-job-id": "invalid" }])("rejects invalid headers: %s", async (headers) => {
    const { submit, start } = setup();
    expect((await submit(request("{}", headers), context())).status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects an invalid Case ID", async () => {
    const { submit, start } = setup();
    expect((await submit(request(), context("invalid"))).status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });

  it.each(["V22_VERIFIED_CREDIT_UNAVAILABLE", "V22_VERIFIED_BINDING_INVALID"])("maps eligibility/credit failures to safe 409: %s", async (message) => {
    const { submit, start, fetcher } = setup();
    start.mockRejectedValue(new Error(message));
    const response = await submit(request(), context());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(message);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed RPC output with 502 before Railway", async () => {
    const { submit, start, fetcher } = setup();
    start.mockRejectedValue(new VerifiedAnalysisContractError());
    expect((await submit(request(), context())).status).toBe(502);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns 504 on timeout without compensation or another start", async () => {
    const { submit, fetcher, start } = setup();
    fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("secret", "AbortError")))));
    expect((await submit(request(), context())).status).toBe(504);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("returns a safe error on immediate Railway failure without compensation", async () => {
    const { submit, fetcher, start } = setup();
    fetcher.mockRejectedValue(new Error("server-secret"));
    const response = await submit(request(), context());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("server-secret");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each([{}, null, { ...accepted, job_id: parentId }, { ...accepted, status: "succeeded" }, { ...accepted, estimated_seconds: "600" }, { ...accepted, token: "server-secret" }])("rejects invalid upstream response: %s", async (payload) => {
    const { submit, fetcher } = setup();
    fetcher.mockResolvedValue(Response.json(payload));
    expect((await submit(request(), context())).status).toBe(502);
  });

  it("returns 202 on replay with the same trusted Railway request", async () => {
    const { submit, start, fetcher } = setup();
    start.mockResolvedValue({ binding: { ...binding, created: false, idempotent: true }, request: taskRequest });
    expect((await submit(request(), context())).status).toBe(202);
    expect(start).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify(taskRequest) }));
  });

  it("defaults server exposure off even with a configured Railway service", async () => {
    vi.doMock("@/lib/auth", () => ({ getCurrentUser: async () => ({ userId }) }));
    vi.stubEnv("GOOGLE_VERIFIED_ANALYSIS_ENABLED", "");
    vi.stubEnv("V22_API_BASE_URL", "https://railway.invalid");
    vi.stubEnv("V22_INTERNAL_API_TOKEN", "server-secret");
    const { submitVerifiedAnalysis } = await import("./server");
    expect((await submitVerifiedAnalysis(request(), context())).status).toBe(404);
  });
});
