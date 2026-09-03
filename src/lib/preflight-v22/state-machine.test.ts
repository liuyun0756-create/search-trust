import { describe, expect, it } from "vitest";

import type { CompetitorDiscoveryStatusResponse, PreflightResponse } from "./contracts";
import { canConfirmCompetitors, createNewCaseDraft, reduceWorkspaceState } from "./state-machine";

const draftId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const discoveryId = "33333333-3333-4333-8333-333333333333";
const snapshotId = "44444444-4444-4444-8444-444444444444";
const market = { display_name: "Austin, TX, US", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const business = { business_name: "Acme Plumbing", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "hybrid" as const, primary_location: market, public_gbp_url: null };
const confirmation = { business_identity: business, primary_service: "Plumbing", target_market: market };

const preflight: PreflightResponse = {
  preflight_id: "55555555-5555-4555-8555-555555555555", normalized_site_url: "https://example.com/",
  identity_candidates: [], service_candidates: [], market_candidates: [], competitor_candidates: [],
  module_availability: [{ module_key: "site_inventory", available: true, reason: "Available." }], data_gaps: [],
  estimated_duration_bucket: "under_5_minutes", coverage_summary: "Ready.",
};

function succeeded(candidateIds = ["cp_alpha", "cp_beta", "cp_gamma", "cp_delta"]): CompetitorDiscoveryStatusResponse {
  return {
    discovery_job_id: jobId, status: "succeeded", stage: "completed", progress: 100, message: "Complete.",
    result: {
      discovery_id: discoveryId, case_id: draftId,
      input_digest: `sha256:${"a".repeat(64)}`, candidate_digest: `sha256:${"b".repeat(64)}`,
      market_snapshot_id: snapshotId, market_snapshot_checksum: `sha256:${"c".repeat(64)}`,
      candidates: candidateIds.map((id, index) => ({
        competitor_id: id, business_name: `Competitor ${index + 1}`, website_url: `https://competitor${index + 1}.example/`,
        public_gbp_url: null, query_appearance_count: 3, best_position: index + 1,
        relevance_reason: "Appears for target queries.", confidence: "high",
      })),
      ready_for_confirmation: candidateIds.length > 0, data_gaps: candidateIds.length ? [] : [{ gap_code: "NO_COMPETITORS", message: "None found.", blocking: true, resolution: "Add one website." }],
      limitations: [], created_at: "2026-09-03T08:00:00Z", expires_at: "2026-09-04T08:00:00Z",
    },
    error: null, created_at: "2026-09-03T08:00:00Z", updated_at: "2026-09-03T08:01:00Z",
  };
}

function readyState() {
  let state = createNewCaseDraft(new Date("2026-09-03T08:00:00Z"), draftId);
  state = reduceWorkspaceState(state, { type: "CHANGE_SOURCE", goal: "win_new_client", site_url: "example.com", gbp_url: null });
  state = reduceWorkspaceState(state, { type: "START_PREFLIGHT" });
  state = reduceWorkspaceState(state, { type: "PREFLIGHT_SUCCEEDED", response: preflight });
  state = reduceWorkspaceState(state, { type: "CONFIRM_BUSINESS", confirmation });
  state = reduceWorkspaceState(state, { type: "START_DISCOVERY", job_id: jobId, idempotency_key: `discover:${jobId}` });
  return reduceWorkspaceState(state, { type: "DISCOVERY_UPDATED", status: succeeded() });
}

describe("new Case workspace state machine", () => {
  it("uses a draft Case UUID independent from the preflight ID", () => {
    const state = reduceWorkspaceState(createNewCaseDraft(new Date(), draftId), { type: "PREFLIGHT_SUCCEEDED", response: preflight });
    expect(state.draft_case_id).toBe(draftId);
    expect(state.draft_case_id).not.toBe(preflight.preflight_id);
  });

  it("clears all dependent state when website or GBP changes", () => {
    const state = reduceWorkspaceState(readyState(), { type: "CHANGE_SOURCE", goal: "work_existing_client", site_url: "other.example", gbp_url: "https://maps.google.com/x" });
    expect(state.stage).toBe("goal_website");
    expect(state.preflight).toBeNull();
    expect(state.business_confirmation).toBeNull();
    expect(state.discovery_job_id).toBeNull();
    expect(state.selected_competitor_ids).toEqual([]);
  });

  it("clears discovery but preserves source and preflight when business scope changes", () => {
    const before = readyState();
    const state = reduceWorkspaceState(before, { type: "CONFIRM_BUSINESS", confirmation: { ...confirmation, primary_service: "Drain cleaning" } });
    expect(state.site_url).toBe(before.site_url);
    expect(state.preflight).toBe(preflight);
    expect(state.discovery_job_id).toBeNull();
    expect(state.selected_competitor_ids).toEqual([]);
  });

  it("defaults to the top three and allows one to three from the same discovery", () => {
    let state = readyState();
    expect(state.selected_competitor_ids).toEqual(["cp_alpha", "cp_beta", "cp_gamma"]);
    const discovery = state.discovery_status;
    state = reduceWorkspaceState(state, { type: "SELECT_COMPETITORS", competitor_ids: ["cp_delta"] });
    expect(state.discovery_status).toBe(discovery);
    expect(canConfirmCompetitors(state)).toBe(true);
    expect(reduceWorkspaceState(state, { type: "CONFIRM_COMPETITORS" }).stage).toBe("coverage");
  });

  it("strictly blocks coverage when no competitor is selected", () => {
    let state = reduceWorkspaceState(readyState(), { type: "SELECT_COMPETITORS", competitor_ids: [] });
    expect(canConfirmCompetitors(state)).toBe(false);
    state = reduceWorkspaceState(state, { type: "CONFIRM_COMPETITORS" });
    expect(state.stage).toBe("competitor_confirmation");
  });

  it("does not create a second task while the current discovery is active", () => {
    let initial = readyState();
    initial = { ...initial, stage: "competitor_discovery_running" };
    const state = reduceWorkspaceState(initial, { type: "START_DISCOVERY", job_id: crypto.randomUUID(), idempotency_key: "different-key" });
    expect(state).toBe(initial);
    expect(state.discovery_job_id).toBe(jobId);
  });

  it("invalidates an expired discovery and returns to business confirmation", () => {
    const state = reduceWorkspaceState(readyState(), { type: "DISCOVERY_EXPIRED" });
    expect(state.stage).toBe("business_confirmation");
    expect(state.discovery_status).toBeNull();
    expect(state.selected_competitor_ids).toEqual([]);
  });
});
