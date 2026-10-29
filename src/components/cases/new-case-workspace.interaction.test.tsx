// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewCaseWorkspace } from "./new-case-workspace";
import { createNewCaseDraft, type NewCaseDraft } from "@/lib/preflight-v22";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), discovery: vi.fn(), load: vi.fn(), save: vi.fn(),
}));
vi.mock("@/lib/client-auth", () => ({ useAppUser: () => ({ isLoaded: true, isSignedIn: true }) }));
vi.mock("@/components/common/AuditModalProvider", () => ({ useAuditModal: () => ({ openLogin: vi.fn() }) }));
vi.mock("@/lib/use-authenticated-fetch", () => ({ useAuthenticatedFetch: () => mocks.fetch }));
vi.mock("@/lib/preflight-v22", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/preflight-v22")>(),
  loadDraft: mocks.load,
  saveDraft: mocks.save,
  getCompetitorDiscovery: mocks.discovery,
}));

let resolveStart: (response: Response) => void;
beforeEach(() => {
  vi.useFakeTimers();
  const market = { display_name: "Austin, TX, US", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
  const draft: NewCaseDraft = {
    ...createNewCaseDraft(), stage: "prospect_start", goal: "win_new_client",
    prospect_workflow_id: crypto.randomUUID(),
    business_confirmation: {
      business_identity: { business_name: "Test Plumbing", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "service_area", primary_location: market, public_gbp_url: null },
      primary_service: "Plumbing repair", target_market: market,
    },
  };
  mocks.load.mockReturnValue(draft);
  mocks.discovery.mockResolvedValue({ discovery_job_id: "unused", status: "queued" });
  mocks.fetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/v2/prospect-workflows/")) return Promise.resolve(Response.json({ workflow_id: draft.prospect_workflow_id, case_id: draft.draft_case_id, discovery_job_id: crypto.randomUUID(), analysis_job_id: null, state: "reserved" }));
    if (url === "/api/v2/cases") return Promise.resolve(Response.json({ id: draft.draft_case_id }));
    if (url.endsWith("/prospect-workflow")) return new Promise<Response>((resolve) => { resolveStart = resolve; });
    if (url.endsWith("/credits")) return Promise.resolve(Response.json({ credit_balance: 4 }));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function start() {
  await act(async () => { render(<NewCaseWorkspace />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  const button = screen.getByRole("button", { name: "Resume discovery · no extra credit" });
  expect(button).toBeEnabled();
  await act(async () => { fireEvent.click(button); });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
}

describe("discovery submission and polling", () => {
  it("waits for task registration before polling, then polls without another start request", async () => {
    await start();
    expect(mocks.discovery).not.toHaveBeenCalled();
    await act(async () => { resolveStart(Response.json({ status: "queued" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.discovery).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith("/prospect-workflow"))).toHaveLength(1);
  });

  it("keeps a rejected start visible without polling a task that was never registered", async () => {
    await start();
    await act(async () => { resolveStart(Response.json({ error: { code: "PROSPECT_WORKFLOW_UNAVAILABLE", message: "Reservation unavailable." } }, { status: 409 })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByText("Reservation unavailable.")).toBeVisible();
    expect(mocks.discovery).not.toHaveBeenCalled();
  });
});


describe("paid workflow recovery", () => {
  it("reconnects a legacy draft to its actual existing Case and running job using reads only", async () => {
    const saved = { ...mocks.load(), stage: "auth_handoff" as const, analysis_job_id: crypto.randomUUID(), analysis_idempotency_key: "original-analysis-key" };
    const actualCase = crypto.randomUUID();
    mocks.load.mockReturnValue(saved);
    vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/v2/prospect-workflows/")) return Response.json({ workflow_id: saved.prospect_workflow_id, case_id: actualCase, discovery_job_id: crypto.randomUUID(), analysis_job_id: saved.analysis_job_id, state: "reserved" });
      if (url === `/api/v2/tasks/${saved.analysis_job_id}`) return Response.json({
        job_id: saved.analysis_job_id, revision: 1, run_generation: 1, status: "running", stage: "collecting_site", progress: 20,
        message: "Collecting the existing task", report: null, error: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deadline_at: new Date(Date.now()+1200000).toISOString(),
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    await act(async () => { render(<NewCaseWorkspace />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(screen.getByText(actualCase)).toBeVisible();
    expect(screen.getByText(/Collecting the existing task/)).toBeVisible();
    expect(mocks.fetch.mock.calls.some(([url]) => url.includes("/tasks/latest"))).toBe(false);
    expect(mocks.fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(mocks.discovery).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ analysis_job_id: saved.analysis_job_id, analysis_idempotency_key: saved.analysis_idempotency_key }));
  });

  it.each([404, 503])("does not start or charge again when recovery returns %s", async (status) => {
    mocks.fetch.mockResolvedValue(Response.json({ error: { code: "UNAVAILABLE" } }, { status }));
    await act(async () => { render(<NewCaseWorkspace />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(screen.getByText(/The saved workflow could not be checked/)).toBeVisible();
    expect(mocks.fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(mocks.discovery).not.toHaveBeenCalled();
  });

  it("does not restart a refunded workflow without a report task", async () => {
    const saved = mocks.load();
    mocks.fetch.mockResolvedValue(Response.json({ workflow_id: saved.prospect_workflow_id, case_id: crypto.randomUUID(), discovery_job_id: crypto.randomUUID(), analysis_job_id: null, state: "compensated" }));
    await act(async () => { render(<NewCaseWorkspace />); });
    expect(screen.getByText(/This workflow is closed/)).toBeVisible();
    expect(mocks.fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });
});


describe("existing Case before payment", () => {
  it.each(["active", "archived"])("only permits explicit reuse of an %s Case when allowed", async (status) => {
    const saved = { ...mocks.load(), prospect_workflow_id: null };
    const existingCase = crypto.randomUUID();
    mocks.load.mockReturnValue(saved);
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/v2/cases") return Response.json({ error: { code: "CASE_ALREADY_EXISTS", case_id: existingCase, status } }, { status: 409 });
      if (url === "/api/v2/credits") return Response.json({ credit_balance: 3 });
      throw new Error(`Unexpected request: ${url}`);
    });
    await act(async () => { render(<NewCaseWorkspace />); });
    const button = screen.getByRole("button", { name: "Start analysis · uses 1 credit" });
    if (status === "active") {
      expect(button).toBeEnabled();
      expect(screen.getByText(/Existing Case found for this business/)).toBeVisible();
    } else expect(button).toBeDisabled();
    expect(mocks.fetch.mock.calls.filter(([url]) => url.includes("/tasks/latest"))).toHaveLength(0);
    expect(mocks.fetch.mock.calls.filter(([url]) => url.includes("/prospect-workflow"))).toHaveLength(0);
  });
});
