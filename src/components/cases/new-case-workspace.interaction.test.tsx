// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewCaseWorkspace } from "./new-case-workspace";
import { createNewCaseDraft, type NewCaseDraft } from "@/lib/preflight-v22";
import { defaultPlanningSettings } from "@/lib/planning-settings/contracts";

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
  mocks.save.mockImplementation(() => {});
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
    expect(screen.getAllByText("1 credit covered · no extra charge").length).toBeGreaterThan(0);
    expect(screen.queryByText("Before any credit")).not.toBeInTheDocument();
    expect(screen.queryByText(/20% complete/)).not.toBeInTheDocument();
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
    expect(screen.queryByText("1 credit covered · no extra charge")).not.toBeInTheDocument();
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


describe("recoverable draft persistence", () => {
  it.each(["NEW_CASE_DRAFT_EXPIRED", "storage contains sensitive data"])("keeps persistence failure %s recoverable and logs only a code", async message => {
    const base = mocks.load() as NewCaseDraft;
    const discoveryId = crypto.randomUUID();
    const draft: NewCaseDraft = {
      ...base, stage: "coverage", discovery_job_id: discoveryId,
      selected_competitor_ids: ["cp_synthetic"],
      preflight: {
        preflight_id: crypto.randomUUID(), normalized_site_url: base.site_url,
        identity_candidates: [], service_candidates: [], market_candidates: [], competitor_candidates: [],
        module_availability: [{module_key:"site_inventory",available:true,reason:"Saved website evidence."}],
        data_gaps: [], estimated_duration_bucket: "under_5_minutes", coverage_summary: "Ready.",
      },
      discovery_status: {
        discovery_job_id: discoveryId, status: "succeeded", stage: "completed", progress: 100, message: "Complete.",
        created_at: base.created_at, updated_at: base.updated_at, error: null,
        result: {
          discovery_id: crypto.randomUUID(), case_id: base.draft_case_id,
          input_digest: `sha256:${"a".repeat(64)}`, candidate_digest: `sha256:${"b".repeat(64)}`,
          market_snapshot_id: crypto.randomUUID(), market_snapshot_checksum: `sha256:${"c".repeat(64)}`,
          candidates: [{competitor_id:"cp_synthetic",business_name:"Synthetic rival",website_url:"https://rival.example/",
            public_gbp_url:null,query_appearance_count:3,best_position:1,relevance_reason:"Same service and market.",confidence:"high"}],
          ready_for_confirmation:true,data_gaps:[],limitations:[],created_at:base.created_at,
          expires_at:new Date(Date.now()+1_200_000).toISOString(),
        },
      },
    };
    mocks.load.mockReturnValue(draft);
    mocks.fetch.mockImplementation(async (url:string) => {
      if(url===`/api/v2/prospect-workflows/${draft.prospect_workflow_id}`)return Response.json({
        workflow_id:draft.prospect_workflow_id,case_id:draft.draft_case_id,discovery_job_id:discoveryId,
        analysis_job_id:null,state:"reserved",
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    mocks.save.mockImplementation((_storage:unknown,value:NewCaseDraft) => {
      if(value.stage==="auth_handoff")throw new Error(message);
    });
    sessionStorage.setItem("searchtrust:v2.2:new-case-draft","old draft");
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      await act(async()=>{render(<NewCaseWorkspace/>);});
      const generate = screen.getByRole("button",{name:"Generate Prospect report"});
      expect(generate).toBeVisible();
      expect(generate).toBeEnabled();
      await act(async()=>{fireEvent.click(generate);});
      expect(screen.getByRole("alert")).toHaveTextContent(message==="NEW_CASE_DRAFT_EXPIRED"
        ? "This session draft expired. Start a new Case check."
        : "This session draft could not be saved. Start a new Case check.");
      expect(error.mock.calls).toEqual([[message==="NEW_CASE_DRAFT_EXPIRED"?"NEW_CASE_DRAFT_EXPIRED":"NEW_CASE_DRAFT_SAVE_FAILED"]]);
      if(message==="NEW_CASE_DRAFT_EXPIRED")expect(sessionStorage.getItem("searchtrust:v2.2:new-case-draft")).toBeNull();
      expect(mocks.fetch.mock.calls.some(([url])=>url==="/api/v2/analyze")).toBe(false);
      fireEvent.click(screen.getByRole("button",{name:"Start a new Case check"}));
      expect(screen.getByRole("button",{name:"Check this prospect · free"})).toBeVisible();
    } finally {error.mockRestore();sessionStorage.clear();}
  });
  it("replaces Generate with a restart prompt for a compensated coverage workflow", async()=>{
    const draft={...mocks.load(),stage:"coverage" as const};mocks.load.mockReturnValue(draft);
    mocks.fetch.mockResolvedValue(Response.json({workflow_id:draft.prospect_workflow_id,case_id:draft.draft_case_id,discovery_job_id:crypto.randomUUID(),analysis_job_id:null,state:"compensated"}));
    await act(async()=>{render(<NewCaseWorkspace/>);});
    expect(screen.getByRole("alert")).toHaveTextContent("This workflow is closed. Start a new Case check.");
    expect(screen.queryByRole("button",{name:"Generate Prospect report"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Start a new Case check"})).toBeVisible();
    expect(mocks.fetch.mock.calls.every(([,init])=>!init?.method||init.method==="GET")).toBe(true);
  });
});

function planningCoverageDraft(): NewCaseDraft {
  const base = mocks.load() as NewCaseDraft;
  const discoveryId = crypto.randomUUID();
  return {
    ...base, stage: "coverage", site_url: "https://example.com/", discovery_job_id: discoveryId,
    selected_competitor_ids: ["cp_planning_rival"],
    preflight: {
      preflight_id: crypto.randomUUID(), normalized_site_url: "https://example.com/",
      identity_candidates: [], service_candidates: [], market_candidates: [], competitor_candidates: [],
      module_availability: [{ module_key: "site_inventory", available: true, reason: "Saved evidence." }],
      data_gaps: [], estimated_duration_bucket: "under_5_minutes", coverage_summary: "Ready.",
    },
    discovery_status: {
      discovery_job_id: discoveryId, status: "succeeded", stage: "completed", progress: 100, message: "Complete.",
      created_at: base.created_at, updated_at: base.updated_at, error: null,
      result: {
        discovery_id: discoveryId, case_id: base.draft_case_id,
        input_digest: `sha256:${"a".repeat(64)}`, candidate_digest: `sha256:${"b".repeat(64)}`,
        market_snapshot_id: crypto.randomUUID(), market_snapshot_checksum: `sha256:${"c".repeat(64)}`,
        candidates: [{ competitor_id: "cp_planning_rival", business_name: "Planning rival", website_url: "https://rival.example/",
          public_gbp_url: null, query_appearance_count: 3, best_position: 1, relevance_reason: "Same service and market.", confidence: "high" }],
        ready_for_confirmation: true, data_gaps: [], limitations: [], created_at: base.created_at,
        expires_at: new Date(Date.now() + 1_200_000).toISOString(),
      },
    },
  };
}

function planningView(draft: NewCaseDraft) {
  return { caseId: draft.draft_case_id, siteUrl: draft.site_url, revision: 0, settings: defaultPlanningSettings() };
}

function queuedTask(jobId: string) {
  return { job_id: jobId, revision: 1, run_generation: 1, status: "queued", stage: "queued", progress: 0,
    message: "Queued report task", report: null, error: null, created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 1_200_000).toISOString() };
}

function mockPlanningWorkflow(draft: NewCaseDraft, conflict?: { code: string; state?: "reserved" | "compensated" | "consumed"; boundJob?: string; unavailable?: boolean }) {
  let reads = 0;
  mocks.load.mockReturnValue(draft);
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === `/api/v2/prospect-workflows/${draft.prospect_workflow_id}`) {
      reads++;
      if (reads > 1 && conflict?.unavailable) return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 });
      return Response.json({ workflow_id: draft.prospect_workflow_id, case_id: draft.draft_case_id,
        discovery_job_id: draft.discovery_job_id, analysis_job_id: reads > 1 ? conflict?.boundJob ?? null : null,
        state: reads > 1 ? conflict?.state ?? "reserved" : "reserved" });
    }
    if (url === "/api/v2/analyze") return conflict
      ? Response.json({ error: { code: conflict.code, message: "Intake unavailable." } }, { status: 409 })
      : Response.json(queuedTask(new Headers(init?.headers).get("x-searchtrust-job-id")!), { status: 202 });
    if (url.startsWith("/api/v2/tasks/")) return Response.json(queuedTask(url.split("/").at(-1)!));
    throw new Error(`Unexpected request: ${url}`);
  });
}

const analyzeCalls = () => mocks.fetch.mock.calls.filter(([url]) => url === "/api/v2/analyze");

describe("planning readiness and analysis conflicts", () => {
  it("disables Generate with a nearby waiting reason until planning finishes loading", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft);
    let resolvePlanning!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolvePlanning = resolve; })));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    const generate = screen.getByRole("button", { name: "Generate Prospect report" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription("Loading saved planning settings. Please wait before generating the report.");
    fireEvent.click(generate);
    expect(analyzeCalls()).toHaveLength(0);
    await act(async () => { resolvePlanning(Response.json(planningView(draft))); });
    expect(generate).toBeEnabled();
    expect(generate).not.toHaveAttribute("aria-describedby");
    expect(analyzeCalls()).toHaveLength(0);
  });

  it("shows a planning load failure and enables Generate only after an explicit successful reload", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft);
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValue(Response.json(planningView(draft)));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    const generate = screen.getByRole("button", { name: "Generate Prospect report" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription("Saved planning settings could not be loaded. Use Reload saved settings to retry before generating the report.");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load the saved settings.");
    const reload = screen.getByRole("button", { name: "Reload saved settings · replaces these unsaved edits" });
    expect(reload).toBeEnabled();
    await act(async () => { fireEvent.click(reload); });
    expect(generate).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    expect(analyzeCalls()).toHaveLength(0);
  });

  it("describes unsaved planning edits instead of calling them loading", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    fireEvent.change(screen.getByLabelText("Client's confirmed business focus"), { target: { value: "contact_path" } });
    expect(screen.getByRole("button", { name: "Generate Prospect report" })).toBeDisabled();
    expect(screen.getByText("Save or reload your planning settings before generating the report.")).toBeVisible();
    expect(analyzeCalls()).toHaveLength(0);
  });

  it("keeps a remounted handoff planning failure visible and retries its load without another Generate click", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft);
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(planningView(draft)))
      .mockResolvedValueOnce(Response.json({}, { status: 503 })).mockImplementation(async () => Response.json(planningView(draft)));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(analyzeCalls()).toHaveLength(0);
    expect(screen.getAllByText(/Saved planning settings could not be loaded/).length).toBeGreaterThan(0);
    const reload = screen.getByRole("button", { name: "Reload saved settings · replaces these unsaved edits" });
    expect(reload).toBeEnabled();
    const before = mocks.save.mock.lastCall![1] as NewCaseDraft;
    expect(before.analysis_job_id).not.toBeNull();
    await act(async () => { fireEvent.click(reload); });
    expect(analyzeCalls()).toHaveLength(1);
    const headers = new Headers(analyzeCalls()[0][1].headers);
    expect(headers.get("x-searchtrust-job-id")).toBe(before.analysis_job_id);
    expect(headers.get("idempotency-key")).toBe(before.analysis_idempotency_key);
    expect(headers.get("x-searchtrust-planning-revision")).toBe("0");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it.each(["V22_ANALYSIS_UNAVAILABLE", "CAPABILITY_INTAKE_UNAVAILABLE"])("closes a compensated workflow after ambiguous 409 %s instead of looping to coverage", async code => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft, { code, state: "compensated" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("This workflow is closed. Start a new Case check.");
    expect(screen.getByRole("button", { name: "Start a new Case check" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Generate Prospect report" })).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([url]) => url.startsWith("/api/v2/prospect-workflows/"))).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(analyzeCalls()).toHaveLength(1);
  });

  it.each(["V22_ANALYSIS_UNAVAILABLE", "PLANNING_SETTINGS_REQUIRED"])("returns an unbound reserved workflow to coverage with a visible explanation for %s", async code => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft, { code, state: "reserved" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(screen.getByRole("button", { name: "Generate Prospect report" })).toBeEnabled();
    expect(screen.getByText(/Scope or planning settings changed\. Review the saved settings and confirm again\./)).toBeVisible();
    expect(mocks.fetch.mock.calls.filter(([url]) => url.startsWith("/api/v2/prospect-workflows/"))).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(analyzeCalls()).toHaveLength(1);
  });

  it("treats a consumed workflow as closed instead of calling it a planning revision conflict", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft, { code: "V22_ANALYSIS_UNAVAILABLE", state: "consumed" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("This workflow is closed.");
    expect(screen.queryByText(/Scope or planning settings changed/)).not.toBeInTheDocument();
    expect(analyzeCalls()).toHaveLength(1);
  });

  it("stops with a Cases & reports link when the 409 workflow check is unavailable", async () => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft, { code: "V22_ANALYSIS_UNAVAILABLE", unavailable: true });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(screen.getAllByText(/The workflow status could not be checked/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Cases & reports" })).toHaveAttribute("href", "/reports");
    expect(screen.queryByText(/Scope or planning settings changed/)).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(analyzeCalls()).toHaveLength(1);
    expect(mocks.fetch.mock.calls.filter(([url]) => url.startsWith("/api/v2/prospect-workflows/"))).toHaveLength(2);
  });

  it("reconnects an already bound reserved job using reads instead of returning to Generate", async () => {
    const draft = planningCoverageDraft();
    const boundJob = crypto.randomUUID();
    mockPlanningWorkflow(draft, { code: "V22_ANALYSIS_UNAVAILABLE", state: "reserved", boundJob });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(mocks.fetch.mock.calls.some(([url]) => url === `/api/v2/tasks/${boundJob}`)).toBe(true);
    expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ analysis_job_id: boundJob }));
    expect(screen.queryByRole("button", { name: "Generate Prospect report" })).not.toBeInTheDocument();
    expect(analyzeCalls()).toHaveLength(1);
  });

  it.each(["PROSPECT_WORKFLOW_NOT_RESERVED", "PROSPECT_WORKFLOW_UNAVAILABLE"])("uses the existing closed path directly for %s", async code => {
    const draft = planningCoverageDraft();
    mockPlanningWorkflow(draft, { code });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(planningView(draft))));
    await act(async () => { render(<NewCaseWorkspace planningEnabled />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generate Prospect report" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("This workflow is closed.");
    expect(mocks.fetch.mock.calls.filter(([url]) => url.startsWith("/api/v2/prospect-workflows/"))).toHaveLength(1);
    expect(analyzeCalls()).toHaveLength(1);
  });
});
