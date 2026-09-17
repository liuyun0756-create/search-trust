import { describe, expect, it } from "vitest";

import {
  checkoutCreatedFixture,
  caseFixture,
  VERIFIED_DODO_CHECKOUT_URL,
  VERIFIED_PAYMENT_ID,
  verifiedCreditCheckoutCreatedFixture,
  verifiedDodoCheckoutFixture,
} from "../../../e2e/fixtures/checkout";
import {
  connectionCenterFixture,
  ga4ResourceFixture,
  googleAuthorizationFixture,
  googleConnectionFixture,
  googleResourcePage,
  gscResourceFixture,
  syncStatusFixture,
} from "../../../e2e/fixtures/google";
import { assertSyntheticFixtureValue, E2E_IDS } from "../../../e2e/fixtures/ids";
import {
  competitorCandidates,
  discoveryStatusFixture,
  E2E_BUSINESS,
  E2E_MARKET,
  preflightFixture,
} from "../../../e2e/fixtures/preflight";
import {
  analysisStatusFixture,
  assertVerifiedChangesMatchProspect,
  prospectReportFixture,
  verifiedAnalysisStatusFixture,
  verifiedReportFixture,
} from "../../../e2e/fixtures/report";
import { createdShareFixture, E2E_SHARE_TOKEN } from "../../../e2e/fixtures/share";
import { LocalApiScenario } from "../../../e2e/support/api-router";
import { parseTaskStatusResponse } from "../analysis-v22/validate";
import { validateReportV22 } from "../report-v22/validate";
import { isReportShareToken } from "../report-shares/tokens";
import { parseDiscoveryStatusResponse, parsePreflightResponse } from "../preflight-v22/validate";

const discoveryRequest = {
  case_id: E2E_IDS.caseId,
  business_identity: E2E_BUSINESS,
  primary_service: "Emergency plumbing",
  target_market: E2E_MARKET,
  queries: ["emergency plumbing Austin", "best emergency plumbing Austin", "emergency plumbing near me"],
};

describe("V22-090 browser fixtures", () => {
  it("validates preflight and every discovery lifecycle state with production parsers", () => {
    expect(parsePreflightResponse(preflightFixture)).toEqual(expect.objectContaining({ ok: true }));
    for (const state of ["queued", "running", "succeeded", "zero", "failed"] as const) {
      expect(parseDiscoveryStatusResponse(discoveryStatusFixture(state))).toEqual(expect.objectContaining({ ok: true }));
    }
    expect(competitorCandidates).toHaveLength(3);
  });

  it("validates report payloads and every analysis lifecycle state", () => {
    expect(validateReportV22(prospectReportFixture)).toEqual(expect.objectContaining({ ok: true }));
    expect(validateReportV22(verifiedReportFixture)).toEqual(expect.objectContaining({ ok: true }));
    for (const state of ["queued", "running", "succeeded", "failed"] as const) {
      expect(parseTaskStatusResponse(analysisStatusFixture(state))).toEqual(expect.objectContaining({ ok: true }));
    }
  });

  it("keeps payment, Google, sync and sharing fixtures structurally bounded", () => {
    expect(caseFixture).toMatchObject({ id: E2E_IDS.caseId, site_url: E2E_IDS.siteUrl, status: "active" });
    expect(new URL(checkoutCreatedFixture.checkout_url).origin).toBe("http://127.0.0.1:3100");
    expect(connectionCenterFixture("healthy").coverage).toMatchObject({ verified_core_ready: true, ready_source_count: 3 });
    expect(connectionCenterFixture("mismatch").coverage.verified_core_ready).toBe(false);
    expect(googleConnectionFixture.account_email).toMatch(/\.invalid$/);
    expect(googleResourcePage("gsc").resources).toEqual([gscResourceFixture]);
    expect(googleResourcePage("ga4").resources).toEqual([ga4ResourceFixture]);
    expect(syncStatusFixture("succeeded")).toMatchObject({ job: { status: "succeeded" }, snapshot: { effective_health_status: "healthy" } });
    expect(new URL(googleAuthorizationFixture.authorization_url).origin).toBe("http://127.0.0.1:3100");
    expect(isReportShareToken(E2E_SHARE_TOKEN)).toBe(true);
    const shareUrl = new URL(createdShareFixture.url);
    expect(shareUrl.search).toBe("");
    expect(shareUrl.hash).toBe(`#${E2E_SHARE_TOKEN}`);
  });

  it("fails closed for unknown paths, methods, and invalid request bodies", () => {
    const scenario = new LocalApiScenario();
    expect(() => scenario.resolve({ method: "GET", url: "/api/v2/not-registered" })).toThrow("Unexpected local API request");
    expect(() => scenario.resolve({ method: "PATCH", url: "/api/v2/preflight", body: {} })).toThrow("Unexpected local API request");
    expect(() => scenario.resolve({ method: "POST", url: "/api/v2/preflight", body: { site_url: E2E_IDS.siteUrl, unexpected: true } })).toThrow("invalid preflight");
  });

  it("advances polling monotonically and keeps terminal mutations idempotent", () => {
    const scenario = new LocalApiScenario();
    scenario.resolve({ method: "POST", url: "/api/v2/competitors/discover", body: discoveryRequest });
    const first = scenario.resolve({ method: "GET", url: `/api/v2/competitors/tasks/${E2E_IDS.discoveryJobId}` }).body as { progress: number };
    const second = scenario.resolve({ method: "GET", url: `/api/v2/competitors/tasks/${E2E_IDS.discoveryJobId}` }).body as { progress: number };
    const third = scenario.resolve({ method: "GET", url: `/api/v2/competitors/tasks/${E2E_IDS.discoveryJobId}` }).body as { progress: number };
    expect([first.progress, second.progress, third.progress]).toEqual([60, 100, 100]);

    const confirmUrl = `/api/v2/cases/${E2E_IDS.caseId}/checkout/confirm`;
    const firstConfirmation = scenario.resolve({ method: "POST", url: confirmUrl, body: { payment_id: "searchtrust_e2e_payment" } }).body;
    const secondConfirmation = scenario.resolve({ method: "POST", url: confirmUrl, body: { payment_id: "searchtrust_e2e_payment" } }).body;
    expect(scenario.snapshot().checkoutUnlocked).toBe(true);
    expect(firstConfirmation).toEqual(expect.objectContaining({ already_confirmed: false }));
    expect(secondConfirmation).toEqual(expect.objectContaining({ already_confirmed: true }));

    const revokeUrl = `/api/v2/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}/shares/${E2E_IDS.shareId}`;
    expect(scenario.resolve({ method: "DELETE", url: revokeUrl }).status).toBe(204);
    expect(scenario.resolve({ method: "DELETE", url: revokeUrl }).status).toBe(204);
    expect(scenario.snapshot().shareRevoked).toBe(true);
  });

  it("models cancellation, provider failure, denial, mismatch, interruption and revocation explicitly", () => {
    const checkoutUrl = `/api/v2/cases/${E2E_IDS.caseId}/checkout`;
    const cancelled = new LocalApiScenario({ checkout: "cancelled" }).resolve({ method: "POST", url: checkoutUrl }).body as { checkout_url: string };
    expect(new URL(cancelled.checkout_url).searchParams.get("payment")).toBe("cancelled");
    expect(new LocalApiScenario({ checkout: "provider_error" }).resolve({ method: "POST", url: checkoutUrl }).status).toBe(503);

    expect(new LocalApiScenario({ google: "denied" }).resolve({ method: "POST", url: "/api/v2/google/connections/authorize", body: {} })).toMatchObject({ status: 400 });
    expect(new LocalApiScenario({ google: "mismatch" }).resolve({ method: "GET", url: `/api/v2/cases/${E2E_IDS.caseId}/connection-center` }).body).toMatchObject({ coverage: { verified_core_ready: false } });
    expect(new LocalApiScenario({ google: "revoked" }).resolve({ method: "GET", url: "/api/v2/google/connections" }).body).toMatchObject({ connections: [{ status: "revoked" }] });
    expect(new LocalApiScenario({ analysis: "interrupted" }).resolve({ method: "GET", url: `/api/v2/tasks/${E2E_IDS.analysisJobId}/stream` }).status).toBe(503);
    expect(new LocalApiScenario({ share: "revoked" }).resolve({ method: "POST", url: "/api/share/resolve", body: { token: E2E_SHARE_TOKEN } }).status).toBe(404);
  });

  it("contains no live credential or ordinary personal-data markers", () => {
    const payload = JSON.stringify({
      preflightFixture,
      competitorCandidates,
      caseFixture,
      prospectReportFixture,
      verifiedReportFixture,
      googleConnectionFixture,
      gscResourceFixture,
      ga4ResourceFixture,
      createdShareFixture,
    });
    for (const blocked of [/sk_live_/i, /sk_test_/i, /AIza[0-9A-Za-z_-]{20,}/, /@gmail\.com/i, /@outlook\.com/i, /authorization:\s*bearer/i]) {
      expect(payload).not.toMatch(blocked);
    }
    expect(payload).toContain("searchtrust-e2e.example.invalid");
  });

  it("models a Verified debit and queued/running/succeeded journey without external state", () => {
    const scenario = new LocalApiScenario({ verifiedBalance: 1, verified: "success" });
    const connectionUrl = `/api/v2/cases/${E2E_IDS.caseId}/connection-center`;
    expect(scenario.resolve({ method: "GET", url: connectionUrl }).body).toMatchObject({
      billing: { credit_balance: 1 },
      verified_job: null,
      coverage: { next_action: { code: "generate_verified_plan" } },
    });

    const analyze = `/api/v2/cases/${E2E_IDS.caseId}/verified-analysis`;
    const headers = {
      "x-searchtrust-job-id": E2E_IDS.verifiedJobId,
      "idempotency-key": `verified:${E2E_IDS.caseId}:${E2E_IDS.verifiedJobId}`,
    };
    expect(scenario.resolve({ method: "POST", url: analyze, body: {}, headers })).toMatchObject({
      status: 202,
      body: { job_id: E2E_IDS.verifiedJobId, status: "queued" },
    });
    expect(scenario.snapshot()).toMatchObject({ verifiedBalance: 0, verifiedAttempt: 1 });
    scenario.resolve({ method: "POST", url: analyze, body: {}, headers });
    expect(scenario.snapshot()).toMatchObject({ verifiedBalance: 0, verifiedAttempt: 1 });

    const statusUrl = `/api/v2/tasks/${E2E_IDS.verifiedJobId}`;
    const states = [0, 1, 2].map(() => (
      scenario.resolve({ method: "GET", url: statusUrl }).body as { status: string }
    ).status);
    expect(states).toEqual(["queued", "running", "succeeded"]);
    expect(scenario.resolve({ method: "GET", url: connectionUrl }).body).toMatchObject({
      billing: { credit_balance: 0 },
      verified_job: { status: "succeeded", charge_state: "consumed", report_id: E2E_IDS.verifiedReportId },
      coverage: { next_action: { code: "open_verified_report" } },
    });
    expect(verifiedAnalysisStatusFixture(E2E_IDS.verifiedJobId, "succeeded"))
      .toMatchObject({ database_report_id: E2E_IDS.verifiedReportId });
  });

  it("models purchase without generation, exact compensation, and a distinct retry", () => {
    const scenario = new LocalApiScenario({ verifiedBalance: 0, verified: "first_failure" });
    const connectionUrl = `/api/v2/cases/${E2E_IDS.caseId}/connection-center`;
    const checkoutUrl = "/api/v2/credits/checkout";
    expect(scenario.resolve({ method: "POST", url: checkoutUrl })).toMatchObject({
      status: 201,
      body: verifiedCreditCheckoutCreatedFixture,
    });
    expect(scenario.snapshot()).toMatchObject({ verifiedBalance: 0, verifiedCheckoutPaid: false, verifiedAttempt: 0 });

    const confirmUrl = `${checkoutUrl}/confirm`;
    const confirm = { method: "POST", url: confirmUrl, body: { payment_id: VERIFIED_PAYMENT_ID } } as const;
    expect(scenario.resolve(confirm).body).toMatchObject({ credits_added: 1, credit_balance: 1, already_confirmed: false });
    expect(scenario.resolve(confirm).body).toMatchObject({ credits_added: 0, credit_balance: 1, already_confirmed: true });
    expect(scenario.snapshot()).toMatchObject({ verifiedBalance: 1, verifiedCheckoutPaid: true, verifiedAttempt: 0 });

    const analyzeUrl = `/api/v2/cases/${E2E_IDS.caseId}/verified-analysis`;
    const firstHeaders = {
      "x-searchtrust-job-id": E2E_IDS.verifiedFailedJobId,
      "idempotency-key": `verified:${E2E_IDS.caseId}:${E2E_IDS.verifiedFailedJobId}`,
    };
    scenario.resolve({ method: "POST", url: analyzeUrl, body: {}, headers: firstHeaders });
    const firstStatusUrl = `/api/v2/tasks/${E2E_IDS.verifiedFailedJobId}`;
    scenario.resolve({ method: "GET", url: firstStatusUrl });
    scenario.resolve({ method: "GET", url: firstStatusUrl });
    expect(scenario.resolve({ method: "GET", url: firstStatusUrl }).body).toMatchObject({ status: "failed" });
    expect(scenario.resolve({ method: "GET", url: `${connectionUrl}?tracked_job_id=${E2E_IDS.verifiedFailedJobId}` }).body)
      .toMatchObject({ billing: { credit_balance: 1 }, verified_job: { charge_state: "compensated" } });

    const retryHeaders = {
      "x-searchtrust-job-id": E2E_IDS.verifiedRetryJobId,
      "x-searchtrust-previous-job-id": E2E_IDS.verifiedFailedJobId,
      "idempotency-key": `verified:${E2E_IDS.caseId}:${E2E_IDS.verifiedRetryJobId}`,
    };
    scenario.resolve({ method: "POST", url: analyzeUrl, body: {}, headers: retryHeaders });
    expect(scenario.snapshot()).toMatchObject({
      verifiedBalance: 0,
      verifiedAttempt: 2,
      verifiedFailureCompensated: false,
      verifiedJobIds: [E2E_IDS.verifiedFailedJobId, E2E_IDS.verifiedRetryJobId],
      verifiedPreviousJobId: E2E_IDS.verifiedFailedJobId,
    });
  });

  it("keeps every Verified fixture synthetic and the Dodo handoff script-free", () => {
    for (const id of [
      E2E_IDS.caseId,
      E2E_IDS.verifiedJobId,
      E2E_IDS.verifiedFailedJobId,
      E2E_IDS.verifiedRetryJobId,
      E2E_IDS.verifiedReportId,
      E2E_IDS.siteUrl,
      E2E_IDS.gbpUrl,
    ]) expect(() => assertSyntheticFixtureValue(id)).not.toThrow();
    expect(new URL(VERIFIED_DODO_CHECKOUT_URL).origin).toBe("http://127.0.0.1:3100");
    const html = verifiedDodoCheckoutFixture(
      `http://127.0.0.1:3100/cases/${E2E_IDS.caseId}/connections?payment=return&payment_id=${VERIFIED_PAYMENT_ID}`,
    );
    expect(html).not.toMatch(/<script|<iframe|fetch\(|XMLHttpRequest/i);
    expect(html).toContain("synthetic $19 purchase");
  });

  it("cross-checks every displayed Verified change against the original Prospect truth", () => {
    expect(() => assertVerifiedChangesMatchProspect(prospectReportFixture, verifiedReportFixture)).not.toThrow();
  });

  it("rejects an injected unchanged entry even when it has a valid report shape", () => {
    const injected = structuredClone(verifiedReportFixture);
    const parent = prospectReportFixture.findings[0];
    const currentIndex = injected.findings.findIndex((finding) => finding.finding_id === parent.finding_id);
    injected.findings[currentIndex] = structuredClone(parent);
    injected.version_diff.entries = [
      ...(injected.version_diff.entries ?? []),
      structuredClone((injected.version_diff.entries ?? [])[0]),
    ];
    expect(() => assertVerifiedChangesMatchProspect(prospectReportFixture, injected))
      .toThrow(/real semantic finding\/evidence difference/);
  });
});
