import type { ConnectionCenterResponse, ConnectionCenterSource } from "../../src/lib/connection-center/contracts";
import type { GoogleConnectionSummary } from "../../src/lib/google-connections/contracts";
import type { GoogleResource, ResourcePage } from "../../src/lib/google-resources/contracts";

import { E2E_IDS } from "./ids";
import { E2E_NOW } from "./preflight";

const healthySnapshot = (id: string) => ({
  id,
  health_status: "healthy",
  effective_health_status: "healthy",
  health_reasons: [],
  fetched_at: E2E_NOW,
  expires_at: "2026-10-10T08:00:00.000Z",
  coverage_start: "2026-06-10",
  coverage_end: "2026-09-09",
  content_available: true,
});

const publicGbp: ConnectionCenterSource = {
  source_key: "public_gbp",
  title: "Public Business Profile",
  required_for_verified_core: true,
  user_status: "healthy",
  ready: true,
  summary: "Public profile evidence is healthy.",
  action: { code: "view_evidence", label: "View evidence", source_key: "public_gbp" },
  technical_status: { connection_status: null, binding_id: null, resource_id: null, resource_name: E2E_IDS.gbpUrl, identity_match_status: "matched", job: null, snapshot: healthySnapshot(E2E_IDS.gbpSnapshotId), warnings: [] },
};

function googleSource(source: "gsc" | "ga4", ready: boolean): ConnectionCenterSource {
  const binding = source === "gsc" ? E2E_IDS.gscBindingId : E2E_IDS.ga4BindingId;
  const snapshot = source === "gsc" ? E2E_IDS.gscSnapshotId : E2E_IDS.ga4SnapshotId;
  return {
    source_key: source,
    title: source === "gsc" ? "Search Console" : "Google Analytics",
    required_for_verified_core: true,
    user_status: ready ? "healthy" : "needs_resource",
    ready,
    summary: ready ? "The synthetic source is healthy." : "Select a synthetic resource.",
    action: ready ? { code: "view_evidence", label: "View evidence", source_key: source } : { code: "select_resource", label: "Select resource", source_key: source },
    technical_status: {
      connection_status: "active",
      binding_id: ready ? binding : null,
      resource_id: ready ? `${source}-resource-e2e` : null,
      resource_name: ready ? `SearchTrust E2E ${source.toUpperCase()}` : null,
      identity_match_status: ready ? "matched" : "not_checked",
      job: null,
      snapshot: ready ? healthySnapshot(snapshot) : null,
      warnings: [],
    },
  };
}

const optionalGbp: ConnectionCenterSource = {
  source_key: "official_gbp_performance",
  title: "Business Profile Performance",
  required_for_verified_core: false,
  user_status: "optional_unavailable",
  ready: false,
  summary: "Official GBP performance is optional in this fixture.",
  action: null,
  technical_status: { connection_status: null, binding_id: null, resource_id: null, resource_name: null, identity_match_status: "not_checked", job: null, snapshot: null, warnings: [] },
};

export function connectionCenterFixture(state: "needs_resources" | "healthy" | "mismatch" = "healthy"): ConnectionCenterResponse {
  const gsc = googleSource("gsc", state !== "needs_resources");
  const ga4 = googleSource("ga4", state === "healthy");
  if (state === "mismatch") {
    ga4.user_status = "needs_identity_confirmation";
    ga4.summary = "Review the resource identity before saving.";
    ga4.action = { code: "confirm_identity", label: "Review identity", source_key: "ga4" };
    ga4.technical_status.identity_match_status = "needs_confirmation";
  }
  const ready = state === "healthy";
  return {
    schema_version: "connection_center_v1",
    case: { id: E2E_IDS.caseId, business_name: "SearchTrust E2E Plumbing", site_url: E2E_IDS.siteUrl, updated_at: E2E_NOW },
    coverage: {
      verified_core_ready: ready,
      full_evidence_ready: false,
      verified_generation_enabled: ready,
      ready_source_count: ready ? 3 : state === "mismatch" ? 2 : 1,
      required_source_count: 3,
      parent_report_id: E2E_IDS.reportId,
      eligible_snapshot_ids: { gsc: gsc.ready ? E2E_IDS.gscSnapshotId : null, ga4: ga4.ready ? E2E_IDS.ga4SnapshotId : null, gbp_performance: null },
      blockers: ready ? [] : [{
        code: state === "mismatch" ? "GA4_IDENTITY_CONFIRMATION_REQUIRED" : "GOOGLE_RESOURCE_REQUIRED",
        message: state === "mismatch" ? "Confirm the Analytics resource identity." : "Select Search Console and Analytics resources.",
        source_key: state === "mismatch" ? "ga4" : "gsc",
        action: state === "mismatch"
          ? { code: "confirm_identity", label: "Review identity", source_key: "ga4" }
          : { code: "select_resource", label: "Select resource", source_key: "gsc" },
      }],
      next_action: ready
        ? { code: "generate_verified_plan", label: "Generate verified plan", source_key: null }
        : state === "mismatch"
          ? { code: "confirm_identity", label: "Review identity", source_key: "ga4" }
          : { code: "select_resource", label: "Select resource", source_key: "gsc" },
    },
    sources: [publicGbp, gsc, ga4],
    optional_sources: [optionalGbp],
  };
}

export const googleConnectionFixture: GoogleConnectionSummary = {
  id: E2E_IDS.connectionId,
  account_email: "browser-tests@searchtrust.example.invalid",
  account_display_name: "SearchTrust Browser Test",
  granted_scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"],
  covered_sources: ["gsc", "ga4"],
  status: "active",
  last_error_code: null,
  connected_at: E2E_NOW,
  updated_at: E2E_NOW,
};

export const gscResourceFixture: GoogleResource = {
  id: "sc-domain:searchtrust-e2e.example.invalid",
  name: "searchtrust-e2e.example.invalid",
  source: "gsc",
  kind: "site",
  parent: null,
  account_name: "SearchTrust Browser Test",
  website_urls: [E2E_IDS.siteUrl],
  address: null,
  service_areas: [],
  permission: "siteOwner",
  selectable: true,
  identity_assessment: { version: "v22-052.1", status: "matched", confidence: "high", reasons: ["DOMAIN_EXACT"] },
  identity_review_token: "a".repeat(64),
};

export const ga4ResourceFixture: GoogleResource = {
  ...gscResourceFixture,
  id: "properties/searchtrust-e2e",
  name: "SearchTrust E2E Analytics",
  source: "ga4",
  kind: "property",
  permission: "READ_ONLY",
};

export function googleResourcePage(source: "gsc" | "ga4"): ResourcePage {
  return {
    resources: [source === "gsc" ? gscResourceFixture : ga4ResourceFixture],
    next_page_token: null,
    case_identity: { business_name: "SearchTrust E2E Plumbing", site_url: E2E_IDS.siteUrl, operating_model: "service_area", location: "Austin, TX, US" },
  };
}

export function syncStatusFixture(state: "queued" | "running" | "succeeded" | "failed") {
  return {
    job: {
      id: E2E_IDS.syncJobId,
      status: state,
      attempt_count: state === "failed" ? 3 : 1,
      error_code: state === "failed" ? "E2E_PROVIDER_INTERRUPTED" : null,
      created_at: E2E_NOW,
      completed_at: ["succeeded", "failed"].includes(state) ? E2E_NOW : null,
      snapshot_id: state === "succeeded" ? E2E_IDS.gscSnapshotId : null,
    },
    snapshot: state === "succeeded" ? healthySnapshot(E2E_IDS.gscSnapshotId) : null,
  };
}

export const googleAuthorizationFixture = {
  authorization_url: `http://127.0.0.1:3100/e2e/google-consent?connection_id=${E2E_IDS.connectionId}`,
  expires_at: "2099-09-10T08:10:00.000Z",
} as const;

export const googleDeniedFixture = { error: { code: "GOOGLE_AUTHORIZATION_DENIED", message: "Google authorization was cancelled.", retryable: true } } as const;
export const googleMismatchFixture = { error: { code: "IDENTITY_CONFIRMATION_REQUIRED", message: "Review the resource identity before saving." } } as const;
