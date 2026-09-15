// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { connectionCenterFixture, googleConnectionFixture } from "../../../e2e/fixtures/google";
import { E2E_IDS } from "../../../e2e/fixtures/ids";
import { ConnectionCenter } from "./connection-center";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

function healthy() {
  const value = structuredClone(connectionCenterFixture("healthy"));
  value.billing.audit_credits = 1;
  value.verified_job = null;
  value.coverage.verified_generation_enabled = true;
  value.coverage.next_action = { code: "generate_verified_plan", label: "Generate Verified Action Plan · uses 1 credit", source_key: null };
  return value;
}

describe("ConnectionCenter interactions", () => {
  it("opens resource management from an identity-confirmation action", async () => {
    const user = userEvent.setup();
    const mismatch = connectionCenterFixture("mismatch");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(mismatch), { status: 200 });
      if (url.endsWith("/api/v2/google/connections")) return new Response(JSON.stringify({ connections: [googleConnectionFixture] }), { status: 200 });
      if (url.includes("google-resources")) return new Response(JSON.stringify({ bindings: [] }), { status: 200 });
      throw new Error(`Unexpected interaction-test request: ${url}`);
    }));
    const { container } = render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={mismatch} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const ga4Card = container.querySelector('[data-source-key="ga4"]');
    expect(ga4Card).not.toBeNull();
    await user.click(within(ga4Card as HTMLElement).getByRole("button", { name: /Review identity/ }));

    const manager = container.querySelector("#manage-google-sources");
    await waitFor(() => expect(manager).toHaveAttribute("open"));
    expect(await screen.findByLabelText("Google account")).toBeInTheDocument();
  });

  it("confirms generation and turns a double click into one Verified job", async () => {
    const user = userEvent.setup();
    const current = healthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let verifiedPosts = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(current), { status: 200 });
      if (url.endsWith("/verified-analysis")) {
        verifiedPosts += 1;
        const jobId = new Headers(init?.headers).get("x-searchtrust-job-id");
        expect(new Headers(init?.headers).get("idempotency-key")).toContain(jobId);
        expect(init?.body).toBe("{}");
        return new Response(JSON.stringify({ job_id: jobId, status: "queued", estimated_seconds: 30 }), { status: 202 });
      }
      if (url.includes("/api/v2/tasks/")) return new Response(JSON.stringify({ job_id: url.split("/").at(-1), status: "running", progress: 20, message: "Building verified evidence" }), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} />);
    const generate = screen.getByRole("button", { name: /Generate Verified Action Plan/ });
    generate.focus();
    await user.keyboard("{Enter}");
    await user.dblClick(generate);
    await waitFor(() => expect(verifiedPosts).toBe(1));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText(/Building verified evidence|Verified Action Plan queued/)).length).toBeGreaterThan(0);
  });

  it("turns a double click with zero balance into one checkout and navigates to Dodo", async () => {
    const user = userEvent.setup();
    const current = healthy();
    current.billing.audit_credits = 0;
    current.coverage.next_action = { code: "buy_verified_credit", label: "Buy 1 credit · $19", source_key: null };
    const navigate = vi.fn();
    let checkoutPosts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(current), { status: 200 });
      if (url.endsWith("/verified-credit/checkout")) {
        checkoutPosts += 1;
        return new Response(JSON.stringify({ checkout_url: "https://checkout.dodopayments.com/session/one" }), { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} navigate={navigate} />);
    await user.dblClick(screen.getByRole("button", { name: /Buy 1 credit/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://checkout.dodopayments.com/session/one"));
    expect(checkoutPosts).toBe(1);
  });

  it("resumes an active job and opens the persisted database report on success", async () => {
    const current = healthy();
    current.verified_job = { id: E2E_IDS.analysisJobId, status: "running", report_id: null, charge_state: "reserved", error_code: null };
    current.coverage.next_action = { code: "wait_for_verified_analysis", label: "Verified Action Plan in progress", source_key: null };
    const navigate = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(current), { status: 200 });
      if (url.includes("/api/v2/tasks/")) return new Response(JSON.stringify({
        job_id: E2E_IDS.analysisJobId, status: "succeeded", progress: 100, message: "Complete",
        database_report_id: E2E_IDS.reportId, report: null,
      }), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} navigate={navigate} />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`));
  });

  it("shows returned credit only when the database charge is compensated", () => {
    const compensated = healthy();
    compensated.verified_job = { id: E2E_IDS.analysisJobId, status: "failed", report_id: null, charge_state: "compensated", error_code: "V22_PROVIDER_FAILED" };
    const { unmount } = render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={compensated} />);
    expect(screen.getByText(/1 credit returned/)).toBeInTheDocument();
    unmount();
    const reserved = structuredClone(compensated);
    reserved.verified_job!.charge_state = "reserved";
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={reserved} />);
    expect(screen.queryByText(/1 credit returned/)).not.toBeInTheDocument();
  });

  it.each(["compensated", "consumed"] as const)("keeps a failed reserved job locked until DB settlement becomes %s", async (settledState) => {
    vi.useFakeTimers();
    const reserved = healthy();
    reserved.billing.audit_credits = 0;
    reserved.verified_job = { id: E2E_IDS.analysisJobId, status: "failed", report_id: null, charge_state: "reserved", error_code: "V22_PROVIDER_FAILED" };
    reserved.coverage.next_action = { code: "wait_for_verified_analysis", label: "Finalizing credit return", source_key: null };
    const settled = structuredClone(reserved);
    settled.verified_job!.charge_state = settledState;
    settled.billing.audit_credits = settledState === "compensated" ? 1 : 0;
    settled.coverage.next_action = settledState === "compensated"
      ? { code: "generate_verified_plan", label: "Generate Verified Action Plan · uses 1 credit", source_key: null }
      : { code: "buy_verified_credit", label: "Buy 1 credit · $19", source_key: null };
    let releaseSettlement = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(releaseSettlement ? settled : reserved), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={reserved} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: /Generating Verified Action Plan/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Buy 1 credit/ })).not.toBeInTheDocument();
    releaseSettlement = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    if (settledState === "compensated") {
      expect(screen.getByText(/1 credit returned/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Generate Verified Action Plan/ })).toBeEnabled();
    } else {
      expect(screen.queryByText(/1 credit returned/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Buy 1 credit/ })).toBeEnabled();
    }
  });

  it("falls back from a task 404 to DB recovery polling and unlocks only after compensation", async () => {
    vi.useFakeTimers();
    const running = healthy();
    running.billing.audit_credits = 0;
    running.verified_job = { id: E2E_IDS.analysisJobId, status: "running", report_id: null, charge_state: "reserved", error_code: null };
    running.coverage.next_action = { code: "wait_for_verified_analysis", label: "Verified Action Plan in progress", source_key: null };
    const recovered = structuredClone(running);
    recovered.billing.audit_credits = 1;
    recovered.verified_job = { id: E2E_IDS.analysisJobId, status: "failed", report_id: null, charge_state: "compensated", error_code: "V22_VERIFIED_ENQUEUE_TIMEOUT" };
    recovered.coverage.next_action = { code: "generate_verified_plan", label: "Generate Verified Action Plan · uses 1 credit", source_key: null };
    let recoveredInDb = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v2/tasks/")) return new Response(JSON.stringify({ error: { code: "ANALYSIS_NOT_FOUND" } }), { status: 404 });
      if (url.includes("connection-center")) return new Response(JSON.stringify(recoveredInDb ? recovered : running), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={running} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: /Generating Verified Action Plan/ })).toBeDisabled();
    recoveredInDb = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByText(/1 credit returned/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Verified Action Plan/ })).toBeEnabled();
  });

  it("confirms a returned payment, refreshes balance and never auto-generates", async () => {
    window.history.replaceState(null, "", "/connections?payment=return&payment_id=pay_123");
    const current = healthy();
    current.billing.audit_credits = 0;
    const refreshed = healthy();
    let generated = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/verified-credit/checkout/confirm")) {
        expect(init?.body).toBe(JSON.stringify({ payment_id: "pay_123" }));
        return new Response(JSON.stringify({ ok: true, audit_credits: 1 }), { status: 200 });
      }
      if (url.includes("connection-center")) return new Response(JSON.stringify(refreshed), { status: 200 });
      if (url.endsWith("/verified-analysis")) { generated += 1; return new Response(null, { status: 500 }); }
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} />);
    expect(window.location.search).toBe("");
    expect(await screen.findByText("1 credit added. You can generate when you are ready.")).toBeInTheDocument();
    expect(generated).toBe(0);
  });

  it.each([
    ["pending", () => new Response(JSON.stringify({ error: { code: "PAYMENT_NOT_COMPLETED" } }), { status: 409, headers: { "retry-after": "2" } }), 2000],
    ["rate limited", () => new Response(null, { status: 429, headers: { "retry-after": "1" } }), 1000],
    ["unavailable", () => new Response(null, { status: 503 }), 2000],
    ["network failure", () => Promise.reject(new TypeError("offline")), 2000],
  ])("keeps the scrubbed payment ID in memory and retries after %s", async (_scenario, firstFailure, retryDelay) => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/connections?payment=return&payment_id=pay_private&order_id=order_private");
    const current = healthy();
    current.billing.audit_credits = 0;
    let confirms = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(current), { status: 200 });
      if (url.endsWith("/verified-credit/checkout/confirm")) {
        confirms += 1;
        expect(init?.body).toBe(JSON.stringify({ payment_id: "pay_private" }));
        if (confirms === 1) return firstFailure();
        return new Response(JSON.stringify({ ok: true, audit_credits: 1 }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} />);
    expect(window.location.search).toBe("");
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const retry = screen.getByRole("button", { name: "Retry payment confirmation" });
    expect(retry).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(retryDelay - 1); });
    expect(retry).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(retry).toBeEnabled();
    retry.focus();
    expect(document.activeElement).toBe(retry);
    await act(async () => { retry.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(confirms).toBe(2);
    expect(screen.getByText("1 credit added. You can generate when you are ready.")).toBeInTheDocument();
  });

  it("aborts an in-flight payment confirmation on unmount after scrubbing the URL", () => {
    window.history.replaceState(null, "", "/connections?payment=return&payment_id=pay_private");
    const current = healthy();
    const observed: { signal?: AbortSignal } = {};
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("connection-center")) return Promise.resolve(new Response(JSON.stringify(current), { status: 200 }));
      if (url.endsWith("/verified-credit/checkout/confirm")) {
        observed.signal = init?.signal as AbortSignal;
        return new Promise<Response>(() => undefined);
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    const { unmount } = render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={current} />);
    expect(window.location.search).toBe("");
    unmount();
    expect(observed.signal?.aborted).toBe(true);
  });
});
