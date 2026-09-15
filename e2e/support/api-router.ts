import type { Page, Route } from "@playwright/test";

import { parseAnalyzeRequest } from "../../src/lib/analysis-v22/validate";
import { validateCreateCaseRequest } from "../../src/lib/cases/contracts";
import { parseDiscoveryRequest, parsePreflightRequest } from "../../src/lib/preflight-v22/validate";
import { assertSyntheticFixtureValue, E2E_IDS } from "../fixtures/ids";
import { analysisStatusFixture, prospectReportFixture, verifiedAnalysisStatusFixture, verifiedReportFixture } from "../fixtures/report";
import {
  caseFixture,
  checkoutConfirmedFixture,
  checkoutCreatedFixture,
  checkoutProviderErrorFixture,
  checkoutStateFixture,
  VERIFIED_DODO_CHECKOUT_URL,
  VERIFIED_PAYMENT_ID,
  verifiedCreditCheckoutConfirmedFixture,
  verifiedCreditCheckoutCreatedFixture,
  verifiedDodoCheckoutFixture,
} from "../fixtures/checkout";
import {
  competitorCandidates,
  discoveryStatusFixture,
  preflightFixture,
} from "../fixtures/preflight";
import {
  connectionCenterFixture,
  googleAuthorizationFixture,
  googleConnectionFixture,
  googleDeniedFixture,
  googleMismatchFixture,
  googleResourcePage,
  syncStatusFixture,
} from "../fixtures/google";
import {
  activeShareFixture,
  createdShareFixture,
  resolvedShareFixture,
  revokedShareFixture,
} from "../fixtures/share";

export type CompetitorScenario = "success" | "zero" | "failure";
export type CheckoutScenario = "success" | "cancelled" | "provider_error";
export type AnalysisScenario = "success" | "failure" | "interrupted";
export type GoogleScenario = "success" | "denied" | "mismatch" | "revoked";
export type ShareScenario = "active" | "revoked";
export type VerifiedScenario = "success" | "first_failure";

export interface LocalApiScenarioOptions {
  competitors?: CompetitorScenario;
  checkout?: CheckoutScenario;
  analysis?: AnalysisScenario;
  google?: GoogleScenario;
  share?: ShareScenario;
  verified?: VerifiedScenario;
  verifiedBalance?: number;
}

export interface FixtureRequest {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FixtureResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function valid<T>(result: { ok: true; value: T } | { ok: false }, label: string): void {
  if (!result.ok) throw new Error(`Local fixture rejected invalid ${label} request.`);
}

function routeKey(request: FixtureRequest): string {
  const url = new URL(request.url, "http://127.0.0.1:3100");
  return `${request.method.toUpperCase()} ${url.pathname}`;
}

function jsonBody(request: FixtureRequest): unknown {
  if (request.body !== undefined) return request.body;
  throw new Error(`Local fixture expected a JSON body for ${routeKey(request)}.`);
}

export class LocalApiScenario {
  readonly options: Required<LocalApiScenarioOptions>;
  private discoveryPoll = 0;
  private analysisPoll = 0;
  private syncPoll = 0;
  private checkoutUnlocked = false;
  private shareRevoked: boolean;
  private caseId: string = E2E_IDS.caseId;
  private discoveryJobId: string = E2E_IDS.discoveryJobId;
  private analysisJobId: string = E2E_IDS.analysisJobId;
  private verifiedBalance: number;
  private verifiedCheckoutPaid = false;
  private verifiedAttempt = 0;
  private verifiedFailureCompensated = false;
  private verifiedPoll = 0;
  private verifiedJobIds: string[] = [];
  private verifiedPreviousJobId: string | null = null;
  private verifiedJobStatus: "queued" | "running" | "succeeded" | "failed" | null = null;
  private verifiedChargeState: "reserved" | "consumed" | "compensated" | null = null;

  constructor(options: LocalApiScenarioOptions = {}) {
    this.options = {
      competitors: options.competitors ?? "success",
      checkout: options.checkout ?? "success",
      analysis: options.analysis ?? "success",
      google: options.google ?? "success",
      share: options.share ?? "active",
      verified: options.verified ?? "success",
      verifiedBalance: options.verifiedBalance ?? 1,
    };
    this.shareRevoked = this.options.share === "revoked";
    this.verifiedBalance = this.options.verifiedBalance;
  }

  snapshot() {
    return Object.freeze({
      discoveryPoll: this.discoveryPoll,
      analysisPoll: this.analysisPoll,
      syncPoll: this.syncPoll,
      checkoutUnlocked: this.checkoutUnlocked,
      shareRevoked: this.shareRevoked,
      caseId: this.caseId,
      discoveryJobId: this.discoveryJobId,
      analysisJobId: this.analysisJobId,
      verifiedBalance: this.verifiedBalance,
      verifiedCheckoutPaid: this.verifiedCheckoutPaid,
      verifiedAttempt: this.verifiedAttempt,
      verifiedFailureCompensated: this.verifiedFailureCompensated,
      verifiedJobIds: Object.freeze([...this.verifiedJobIds]),
      verifiedPreviousJobId: this.verifiedPreviousJobId,
      verifiedJobStatus: this.verifiedJobStatus,
    });
  }

  resolve(request: FixtureRequest): FixtureResponse {
    const key = routeKey(request);
    const url = new URL(request.url, "http://127.0.0.1:3100");

    if (key === "GET /api/user/credits") return { status: 200, body: { credits: 3 } };
    if (key === "POST /api/v2/preflight") {
      valid(parsePreflightRequest(jsonBody(request)), "preflight");
      return { status: 200, body: preflightFixture };
    }
    if (key === "POST /api/v2/competitors/discover") {
      const input = jsonBody(request) as { case_id?: string };
      valid(parseDiscoveryRequest(input), "competitor discovery");
      this.caseId = input.case_id!;
      this.discoveryJobId = request.headers?.["x-searchtrust-discovery-job-id"] ?? E2E_IDS.discoveryJobId;
      return { status: 202, body: { discovery_job_id: this.discoveryJobId, status: "queued", estimated_seconds: 2 } };
    }
    if (key === `GET /api/v2/competitors/tasks/${this.discoveryJobId}`) {
      const poll = this.discoveryPoll++;
      const state = this.options.competitors === "failure" && poll >= 1 ? "failed" : poll === 0 ? "running" : this.options.competitors === "zero" ? "zero" : "succeeded";
      const fixture = discoveryStatusFixture(state);
      return { status: 200, body: { ...fixture, discovery_job_id: this.discoveryJobId, result: fixture.result ? { ...fixture.result, case_id: this.caseId } : null } };
    }
    if (key === `POST /api/v2/competitors/tasks/${this.discoveryJobId}/retry`) {
      this.discoveryPoll = 0;
      return { status: 202, body: { discovery_job_id: this.discoveryJobId, status: "queued", attempt_count: 2 } };
    }
    if (key === "POST /api/v2/cases") {
      const input = jsonBody(request) as { draft_case_id?: string };
      valid(validateCreateCaseRequest(input), "Case creation");
      this.caseId = input.draft_case_id ?? E2E_IDS.caseId;
      return { status: 201, body: { ...caseFixture, id: this.caseId } };
    }
    if (key === `GET /api/v2/cases/${this.caseId}/tasks/latest`) return { status: 204 };
    if (key === `GET /api/v2/cases/${this.caseId}/checkout`) {
      return { status: 200, body: checkoutStateFixture(this.checkoutUnlocked) };
    }
    if (key === `POST /api/v2/cases/${this.caseId}/checkout`) {
      if (this.options.checkout === "provider_error") return { status: 503, body: checkoutProviderErrorFixture };
      if (this.options.checkout === "cancelled") {
        return {
          status: 201,
          body: {
            ...checkoutCreatedFixture,
            case_id: this.caseId,
            checkout_url: `http://127.0.0.1:3100/cases/new?payment=cancelled&case_id=${this.caseId}`,
          },
        };
      }
      return { status: 201, body: { ...checkoutCreatedFixture, case_id: this.caseId, checkout_url: `http://127.0.0.1:3100/cases/new?payment=return&case_id=${this.caseId}&payment_id=searchtrust_e2e_payment` } };
    }
    if (key === `POST /api/v2/cases/${this.caseId}/checkout/confirm`) {
      if (this.options.checkout === "provider_error") return { status: 503, body: checkoutProviderErrorFixture };
      const alreadyConfirmed = this.checkoutUnlocked;
      this.checkoutUnlocked = true;
      return { status: 200, body: { ...checkoutConfirmedFixture, case_id: this.caseId, already_confirmed: alreadyConfirmed } };
    }
    if (key === "POST /api/v2/analyze") {
      valid(parseAnalyzeRequest(jsonBody(request)), "analysis");
      this.analysisJobId = request.headers?.["x-searchtrust-job-id"] ?? E2E_IDS.analysisJobId;
      return { status: 202, body: { job_id: this.analysisJobId, status: "queued", estimated_seconds: 3 } };
    }
    if (key === `GET /api/v2/tasks/${this.analysisJobId}`) {
      const poll = this.analysisPoll++;
      const state = this.options.analysis === "failure" && poll >= 1 ? "failed" : poll === 0 ? "running" : "succeeded";
      return { status: 200, body: { ...analysisStatusFixture(state), job_id: this.analysisJobId, ...(state === "succeeded" ? { database_report_id: E2E_IDS.reportId } : {}) } };
    }
    if (key === `GET /api/v2/tasks/${this.analysisJobId}/stream`) {
      if (this.options.analysis === "interrupted") return { status: 503, body: { error: { code: "E2E_STREAM_INTERRUPTED", message: "Use polling fallback." } } };
      return {
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: `event: state\ndata: ${JSON.stringify({ ...analysisStatusFixture("running"), job_id: this.analysisJobId })}\n\n`,
      };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`) {
      return { status: 200, body: prospectReportFixture };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.verifiedReportId}`) {
      return { status: 200, body: verifiedReportFixture };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/connection-center`) {
      const state = this.options.google === "mismatch" ? "mismatch" : this.options.google === "success" ? "healthy" : "needs_resources";
      if (url.searchParams.has("tracked_job_id") && this.verifiedJobStatus === "failed") {
        this.verifiedFailureCompensated = true;
        this.verifiedChargeState = "compensated";
        this.verifiedBalance = 1;
      }
      const latestJobId = this.verifiedJobIds.at(-1) ?? null;
      const verifiedJob = latestJobId && this.verifiedJobStatus && this.verifiedChargeState
        ? {
          id: latestJobId,
          status: this.verifiedJobStatus,
          report_id: this.verifiedJobStatus === "succeeded" ? E2E_IDS.verifiedReportId : null,
          charge_state: this.verifiedChargeState,
          error_code: this.verifiedJobStatus === "failed" ? "V22_PROVIDER_FAILED" : null,
        }
        : null;
      return { status: 200, body: connectionCenterFixture(state, { balance: this.verifiedBalance, job: verifiedJob }) };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/verified-credit/checkout`) {
      return { status: 201, body: verifiedCreditCheckoutCreatedFixture };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/verified-credit/checkout/confirm`) {
      const input = jsonBody(request) as { payment_id?: unknown };
      if (input.payment_id !== VERIFIED_PAYMENT_ID) throw new Error("Local fixture rejected invalid Verified payment confirmation.");
      const alreadyConfirmed = this.verifiedCheckoutPaid;
      this.verifiedCheckoutPaid = true;
      if (!alreadyConfirmed) this.verifiedBalance += 1;
      return {
        status: 200,
        body: {
          ...verifiedCreditCheckoutConfirmedFixture,
          audit_credits: this.verifiedBalance,
          credits_added: alreadyConfirmed ? 0 : 1,
          already_confirmed: alreadyConfirmed,
        },
      };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/verified-analysis`) {
      const input = jsonBody(request);
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 0) {
        throw new Error("Local fixture rejected invalid Verified analysis request.");
      }
      const jobId = request.headers?.["x-searchtrust-job-id"] ?? "";
      assertSyntheticFixtureValue(jobId);
      if (request.headers?.["idempotency-key"] !== `verified:${this.caseId}:${jobId}`) {
        throw new Error("Local fixture rejected an invalid Verified idempotency key.");
      }
      if (this.verifiedJobIds.includes(jobId)) {
        return { status: 202, body: { job_id: jobId, status: this.verifiedJobStatus ?? "queued", estimated_seconds: 3 } };
      }
      if (this.verifiedBalance < 1) return { status: 409, body: { error: { code: "VERIFIED_ANALYSIS_UNAVAILABLE", message: "No credit is available." } } };
      const expectedPrevious = this.verifiedJobIds.at(-1) ?? null;
      const previousJobId = request.headers?.["x-searchtrust-previous-job-id"] ?? null;
      if (this.verifiedAttempt > 0 && previousJobId !== expectedPrevious) {
        throw new Error("Local fixture rejected a Verified retry without its previous job.");
      }
      this.verifiedPreviousJobId = previousJobId;
      this.verifiedAttempt += 1;
      this.verifiedBalance -= 1;
      this.verifiedPoll = 0;
      this.verifiedFailureCompensated = false;
      this.verifiedJobIds.push(jobId);
      this.verifiedJobStatus = "queued";
      this.verifiedChargeState = "reserved";
      return { status: 202, body: { job_id: jobId, status: "queued", estimated_seconds: 3 } };
    }
    if (key.startsWith("GET /api/v2/tasks/") && this.verifiedJobIds.includes(key.slice("GET /api/v2/tasks/".length))) {
      const jobId = key.slice("GET /api/v2/tasks/".length);
      const poll = this.verifiedPoll++;
      const shouldFail = this.options.verified === "first_failure" && this.verifiedAttempt === 1;
      const state = poll === 0 ? "queued" : poll === 1 ? "running" : shouldFail ? "failed" : "succeeded";
      this.verifiedJobStatus = state;
      if (state === "succeeded") this.verifiedChargeState = "consumed";
      return { status: 200, body: verifiedAnalysisStatusFixture(jobId, state) };
    }
    if (key === "GET /api/v2/google/connections") {
      if (this.options.google === "revoked") return { status: 200, body: { connections: [{ ...googleConnectionFixture, status: "revoked" }] } };
      return { status: 200, body: { connections: [googleConnectionFixture] } };
    }
    if (key === "POST /api/v2/google/connections/authorize" || key === `POST /api/v2/google/connections/${E2E_IDS.connectionId}/authorize`) {
      if (this.options.google === "denied") return { status: 400, body: googleDeniedFixture };
      const input = request.body as { return_path?: string } | undefined;
      const authorization = new URL(googleAuthorizationFixture.authorization_url);
      authorization.searchParams.set("return_to", input?.return_path ?? `/cases/${this.caseId}/connections`);
      return { status: 201, body: { ...googleAuthorizationFixture, authorization_url: authorization.toString() } };
    }
    if (key === `DELETE /api/v2/google/connections/${E2E_IDS.connectionId}`) {
      return { status: 200, body: { connection: { ...googleConnectionFixture, status: "revoked" } } };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/google-resources`) {
      if (!url.searchParams.has("source")) return { status: 200, body: { bindings: [] } };
      const source = url.searchParams.get("source");
      if (source !== "gsc" && source !== "ga4") throw new Error(`No local resource fixture for source ${source}.`);
      return { status: 200, body: googleResourcePage(source) };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/google-resources`) {
      if (this.options.google === "mismatch") return { status: 409, body: googleMismatchFixture };
      const input = jsonBody(request) as Record<string, unknown>;
      const source = input.source === "ga4" ? "ga4" : "gsc";
      return { status: 200, body: { binding: { id: source === "gsc" ? E2E_IDS.gscBindingId : E2E_IDS.ga4BindingId, source_type: source, identity_match_status: "matched" } } };
    }
    if (["gsc", "ga4", "gbp"].some((source) => key === `POST /api/v2/cases/${E2E_IDS.caseId}/${source}-sync`)) {
      this.syncPoll = 0;
      return { status: 202, body: { job_id: E2E_IDS.syncJobId, status: "queued" } };
    }
    if (["gsc", "ga4", "gbp"].some((source) => key === `GET /api/v2/cases/${E2E_IDS.caseId}/${source}-sync`)) {
      const poll = this.syncPoll++;
      return { status: 200, body: syncStatusFixture(poll === 0 ? "running" : "succeeded") };
    }
    const shareCollection = `/api/v2/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}/shares`;
    if (key === `GET ${shareCollection}`) return { status: 200, body: { shares: this.shareRevoked ? [] : [activeShareFixture] } };
    if (key === `POST ${shareCollection}`) {
      this.shareRevoked = false;
      return { status: 201, body: createdShareFixture };
    }
    if (key === `DELETE ${shareCollection}/${E2E_IDS.shareId}`) {
      this.shareRevoked = true;
      return { status: 204 };
    }
    if (key === "POST /api/share/resolve") {
      return this.shareRevoked ? { status: 404, body: revokedShareFixture } : { status: 200, body: resolvedShareFixture };
    }

    throw new Error(`Unexpected local API request: ${key}`);
  }
}

async function requestBody(route: Route): Promise<unknown> {
  const raw = route.request().postData();
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function installLocalApiRouter(page: Page, scenario = new LocalApiScenario()): Promise<LocalApiScenario> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    if (request.url() === VERIFIED_DODO_CHECKOUT_URL) {
      const returnUrl = `http://127.0.0.1:3100/cases/${E2E_IDS.caseId}/connections?payment=return&payment_id=${VERIFIED_PAYMENT_ID}`;
      await route.fulfill({
        status: 200,
        body: verifiedDodoCheckoutFixture(returnUrl),
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
      return;
    }
    if (requestUrl.hostname.includes("posthog")) {
      await route.fulfill({ status: 204, body: "", headers: { "cache-control": "no-store" } });
      return;
    }
    if (!pathname.startsWith("/api/") || pathname === "/api/user/credits") {
      await route.fallback();
      return;
    }
    const response = scenario.resolve({
      method: request.method(),
      url: request.url(),
      body: await requestBody(route),
      headers: request.headers(),
    });
    const body = typeof response.body === "string" ? response.body : response.body === undefined ? "" : JSON.stringify(response.body);
    await route.fulfill({
      status: response.status,
      body,
      headers: { ...response.headers, ...(typeof response.body === "string" ? {} : { "content-type": "application/json" }) },
    });
  });
  return scenario;
}

export { competitorCandidates };
