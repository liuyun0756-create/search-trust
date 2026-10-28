// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewCaseWorkspace } from "./new-case-workspace";
import { createNewCaseDraft, type NewCaseDraft } from "@/lib/preflight-v22";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), discovery: vi.fn(), load: vi.fn(),
}));
vi.mock("@/lib/client-auth", () => ({ useAppUser: () => ({ isLoaded: true, isSignedIn: true }) }));
vi.mock("@/components/common/AuditModalProvider", () => ({ useAuditModal: () => ({ openLogin: vi.fn() }) }));
vi.mock("@/lib/use-authenticated-fetch", () => ({ useAuthenticatedFetch: () => mocks.fetch }));
vi.mock("@/lib/preflight-v22", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/preflight-v22")>(),
  loadDraft: mocks.load,
  saveDraft: vi.fn(),
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
    if (url === "/api/v2/cases") return Promise.resolve(Response.json({ id: draft.draft_case_id }));
    if (url.endsWith("/prospect-workflow")) return new Promise<Response>((resolve) => { resolveStart = resolve; });
    if (url.endsWith("/credits")) return Promise.resolve(Response.json({ credit_balance: 4 }));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

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
