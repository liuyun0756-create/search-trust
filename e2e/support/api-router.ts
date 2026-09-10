import type { Page, Route } from "@playwright/test";

import { parseAnalyzeRequest } from "../../src/lib/analysis-v22/validate";
import { validateCreateCaseRequest } from "../../src/lib/cases/contracts";
import { parseDiscoveryRequest, parsePreflightRequest } from "../../src/lib/preflight-v22/validate";
import { E2E_IDS } from "../fixtures/ids";
import { analysisStatusFixture, prospectReportFixture, verifiedReportFixture } from "../fixtures/report";
import {
  caseFixture,
  checkoutConfirmedFixture,
  checkoutCreatedFixture,
  checkoutProviderErrorFixture,
  checkoutStateFixture,
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

export interface LocalApiScenarioOptions {
  competitors?: CompetitorScenario;
  checkout?: CheckoutScenario;
  analysis?: AnalysisScenario;
  google?: GoogleScenario;
  share?: ShareScenario;
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

  constructor(options: LocalApiScenarioOptions = {}) {
    this.options = {
      competitors: options.competitors ?? "success",
      checkout: options.checkout ?? "success",
      analysis: options.analysis ?? "success",
      google: options.google ?? "success",
      share: options.share ?? "active",
    };
    this.shareRevoked = this.options.share === "revoked";
  }

  snapshot() {
    return Object.freeze({
      discoveryPoll: this.discoveryPoll,
      analysisPoll: this.analysisPoll,
      syncPoll: this.syncPoll,
      checkoutUnlocked: this.checkoutUnlocked,
      shareRevoked: this.shareRevoked,
    });
  }

  resolve(request: FixtureRequest): FixtureResponse {
    const key = routeKey(request);
    const url = new URL(request.url, "http://127.0.0.1:3100");

    if (key === "POST /api/v2/preflight") {
      valid(parsePreflightRequest(jsonBody(request)), "preflight");
      return { status: 200, body: preflightFixture };
    }
    if (key === "POST /api/v2/competitors/discover") {
      valid(parseDiscoveryRequest(jsonBody(request)), "competitor discovery");
      return { status: 202, body: { discovery_job_id: E2E_IDS.discoveryJobId, status: "queued", estimated_seconds: 2 } };
    }
    if (key === `GET /api/v2/competitors/tasks/${E2E_IDS.discoveryJobId}`) {
      const poll = this.discoveryPoll++;
      if (this.options.competitors === "failure" && poll >= 1) return { status: 200, body: discoveryStatusFixture("failed") };
      if (poll === 0) return { status: 200, body: discoveryStatusFixture("running") };
      return { status: 200, body: discoveryStatusFixture(this.options.competitors === "zero" ? "zero" : "succeeded") };
    }
    if (key === `POST /api/v2/competitors/tasks/${E2E_IDS.discoveryJobId}/retry`) {
      this.discoveryPoll = 0;
      return { status: 202, body: { discovery_job_id: E2E_IDS.discoveryJobId, status: "queued", attempt_count: 2 } };
    }
    if (key === "POST /api/v2/cases") {
      valid(validateCreateCaseRequest(jsonBody(request)), "Case creation");
      return { status: 201, body: caseFixture };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/tasks/latest`) return { status: 204 };
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/checkout`) {
      return { status: 200, body: checkoutStateFixture(this.checkoutUnlocked) };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/checkout`) {
      if (this.options.checkout === "provider_error") return { status: 503, body: checkoutProviderErrorFixture };
      if (this.options.checkout === "cancelled") {
        return {
          status: 201,
          body: {
            ...checkoutCreatedFixture,
            checkout_url: `http://127.0.0.1:3100/cases/new?payment=cancelled&case_id=${E2E_IDS.caseId}`,
          },
        };
      }
      return { status: 201, body: checkoutCreatedFixture };
    }
    if (key === `POST /api/v2/cases/${E2E_IDS.caseId}/checkout/confirm`) {
      if (this.options.checkout === "provider_error") return { status: 503, body: checkoutProviderErrorFixture };
      const alreadyConfirmed = this.checkoutUnlocked;
      this.checkoutUnlocked = true;
      return { status: 200, body: { ...checkoutConfirmedFixture, already_confirmed: alreadyConfirmed } };
    }
    if (key === "POST /api/v2/analyze") {
      valid(parseAnalyzeRequest(jsonBody(request)), "analysis");
      return { status: 202, body: { job_id: E2E_IDS.analysisJobId, status: "queued", estimated_seconds: 3 } };
    }
    if (key === `GET /api/v2/tasks/${E2E_IDS.analysisJobId}`) {
      const poll = this.analysisPoll++;
      if (this.options.analysis === "failure" && poll >= 1) return { status: 200, body: analysisStatusFixture("failed") };
      if (poll === 0) return { status: 200, body: analysisStatusFixture("running") };
      return { status: 200, body: { ...analysisStatusFixture("succeeded"), database_report_id: E2E_IDS.reportId } };
    }
    if (key === `GET /api/v2/tasks/${E2E_IDS.analysisJobId}/stream`) {
      if (this.options.analysis === "interrupted") return { status: 503, body: { error: { code: "E2E_STREAM_INTERRUPTED", message: "Use polling fallback." } } };
      return {
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: `event: state\ndata: ${JSON.stringify(analysisStatusFixture("running"))}\n\n`,
      };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/reports/${E2E_IDS.reportId}`) {
      return { status: 200, body: prospectReportFixture };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/reports/e2000000-0000-4000-8000-000000000016`) {
      return { status: 200, body: verifiedReportFixture };
    }
    if (key === `GET /api/v2/cases/${E2E_IDS.caseId}/connection-center`) {
      const state = this.options.google === "mismatch" ? "mismatch" : this.options.google === "success" ? "healthy" : "needs_resources";
      return { status: 200, body: connectionCenterFixture(state) };
    }
    if (key === "GET /api/v2/google/connections") {
      if (this.options.google === "revoked") return { status: 200, body: { connections: [{ ...googleConnectionFixture, status: "revoked" }] } };
      return { status: 200, body: { connections: [googleConnectionFixture] } };
    }
    if (key === "POST /api/v2/google/connections/authorize" || key === `POST /api/v2/google/connections/${E2E_IDS.connectionId}/authorize`) {
      if (this.options.google === "denied") return { status: 400, body: googleDeniedFixture };
      return { status: 201, body: googleAuthorizationFixture };
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
  await page.route("**/api/**", async (route) => {
    const request = route.request();
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
