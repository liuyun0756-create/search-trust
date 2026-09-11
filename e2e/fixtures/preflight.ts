import type {
  CompetitorDiscoveryStatusResponse,
  PreflightResponse,
} from "../../src/lib/preflight-v22/contracts";

import { E2E_IDS } from "./ids";

export const E2E_NOW = "2026-09-10T08:00:00.000Z";
// Keep expiry-based browser journeys deterministic as wall-clock time advances.
export const E2E_LATER = "2099-09-11T08:00:00.000Z";
export const E2E_DIGEST = `sha256:${"a".repeat(64)}`;
export const E2E_CANDIDATE_DIGEST = `sha256:${"b".repeat(64)}`;
export const E2E_MARKET_DIGEST = `sha256:${"c".repeat(64)}`;

export const E2E_MARKET = Object.freeze({
  display_name: "Austin, TX, US",
  country_code: "US",
  region: "TX",
  city: "Austin",
  postal_code: "78701",
  latitude: 30.2672,
  longitude: -97.7431,
});

export const E2E_BUSINESS = Object.freeze({
  business_name: "SearchTrust E2E Plumbing",
  site_url: E2E_IDS.siteUrl,
  normalized_domain: "searchtrust-e2e.example.invalid",
  operating_model: "service_area" as const,
  primary_location: E2E_MARKET,
  public_gbp_url: E2E_IDS.gbpUrl,
});

export const preflightFixture: PreflightResponse = {
  preflight_id: E2E_IDS.preflightId,
  normalized_site_url: E2E_IDS.siteUrl,
  identity_candidates: [{
    business: E2E_BUSINESS,
    confidence: "high",
    match_reasons: ["Synthetic website and public profile agree."],
    requires_confirmation: false,
    field_comparisons: [
      { field: "business_name", site_value: E2E_BUSINESS.business_name, gbp_value: E2E_BUSINESS.business_name, status: "exact_match", reason: "Names match." },
      { field: "phone", site_value: "+1 555 010 0200", gbp_value: "+1 555 010 0200", status: "exact_match", reason: "Phone numbers match." },
      { field: "address", site_value: "Austin, TX", gbp_value: "Austin, TX", status: "exact_match", reason: "Locations match." },
      { field: "service_area", site_value: "Austin metro", gbp_value: "Austin metro", status: "exact_match", reason: "Service areas match." },
    ],
  }],
  service_candidates: [{ value: "Emergency plumbing", confidence: "high", evidence_summary: "Synthetic service evidence." }],
  market_candidates: [{ market: E2E_MARKET, confidence: "high", evidence_summary: "Synthetic market evidence." }],
  competitor_candidates: [],
  module_availability: [
    "site_inventory", "site_deep_analysis", "serp_maps", "serp_local_pack", "serp_organic",
    "public_gbp", "competitor_analysis", "pagespeed",
  ].map((module_key) => ({ module_key: module_key as PreflightResponse["module_availability"][number]["module_key"], available: true, reason: "Available in the local fixture." })),
  data_gaps: [],
  estimated_duration_bucket: "under_5_minutes",
  coverage_summary: "Public evidence is ready for a deterministic local test.",
};

export const competitorCandidates = E2E_IDS.competitorIds.map((competitor_id, index) => ({
  competitor_id,
  business_name: `Synthetic Competitor ${index + 1}`,
  website_url: `https://competitor-${index + 1}.searchtrust-e2e.example.invalid/`,
  public_gbp_url: `https://gbp-${index + 1}.searchtrust-e2e.example.invalid/location`,
  query_appearance_count: 3 - index,
  best_position: index + 1,
  relevance_reason: "Appears in the synthetic local market.",
  confidence: "high" as const,
}));

export function discoveryStatusFixture(
  state: "queued" | "running" | "succeeded" | "zero" | "failed",
): CompetitorDiscoveryStatusResponse {
  const base = {
    discovery_job_id: E2E_IDS.discoveryJobId,
    created_at: E2E_NOW,
    updated_at: E2E_NOW,
  };
  if (state === "queued") return { ...base, status: "queued", stage: "queued", progress: 0, message: "Discovery queued.", result: null, error: null };
  if (state === "running") return { ...base, status: "running", stage: "ranking_candidates", progress: 60, message: "Ranking synthetic candidates.", result: null, error: null };
  if (state === "failed") return {
    ...base, status: "failed", stage: "failed", progress: 60, message: "Discovery stopped safely.", result: null,
    error: { error_code: "E2E_DISCOVERY_INTERRUPTED", user_message: "Competitor discovery was interrupted. Try again.", retryable: true, stage: "failed", diagnostic_id: E2E_IDS.marketSnapshotId },
  };
  const candidates = state === "zero" ? [] : competitorCandidates;
  return {
    ...base,
    status: "succeeded",
    stage: "completed",
    progress: 100,
    message: candidates.length ? "Competitors ready for confirmation." : "No qualified competitors were found.",
    result: {
      discovery_id: E2E_IDS.discoveryId,
      case_id: E2E_IDS.caseId,
      input_digest: E2E_DIGEST,
      candidate_digest: E2E_CANDIDATE_DIGEST,
      market_snapshot_id: E2E_IDS.marketSnapshotId,
      market_snapshot_checksum: E2E_MARKET_DIGEST,
      candidates,
      ready_for_confirmation: candidates.length > 0,
      data_gaps: candidates.length ? [] : [{ gap_code: "NO_COMPETITORS", message: "Provide at least one real competitor.", blocking: true, resolution: "Add a competitor website." }],
      limitations: candidates.length ? [] : ["Automated discovery returned no qualified businesses."],
      created_at: E2E_NOW,
      expires_at: E2E_LATER,
    },
    error: null,
  };
}
