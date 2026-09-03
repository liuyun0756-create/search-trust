import { describe, expect, it } from "vitest";

import { parseDiscoveryRequest, parseDiscoveryStatusResponse, parsePreflightRequest, parsePreflightResponse } from "./validate";

const uuid = "11111111-1111-4111-8111-111111111111";
const market = { display_name: "Austin, TX, US", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const business = {
  business_name: "Acme Plumbing", site_url: "https://example.com/", normalized_domain: "example.com",
  operating_model: "hybrid", primary_location: market, public_gbp_url: "https://www.google.com/maps?cid=123",
};

function preflightResponse() {
  return {
    preflight_id: uuid,
    normalized_site_url: "https://example.com/",
    identity_candidates: [{
      business, confidence: "high", match_reasons: ["website domain matched"], requires_confirmation: false,
      field_comparisons: [
        { field: "business_name", site_value: "Acme Plumbing", gbp_value: "Acme Plumbing", status: "exact_match", reason: "Matched." },
        { field: "phone", site_value: "+1 512 555 0100", gbp_value: "512-555-0100", status: "exact_match", reason: "Matched." },
        { field: "address", site_value: "Austin, TX", gbp_value: "100 Main St, Austin, TX", status: "partial_match", reason: "Overlaps." },
        { field: "service_area", site_value: "hybrid", gbp_value: "storefront", status: "partial_match", reason: "Overlaps." },
      ],
    }],
    service_candidates: [], market_candidates: [], competitor_candidates: [],
    module_availability: [{ module_key: "public_gbp", available: true, reason: "Available." }],
    data_gaps: [], estimated_duration_bucket: "under_5_minutes", coverage_summary: "Coverage ready.",
  };
}

describe("v2.2 preflight contracts", () => {
  it("accepts a strict preflight request and rejects extra fields", () => {
    expect(parsePreflightRequest({ site_url: "https://example.com", gbp_url: null }).ok).toBe(true);
    expect(parsePreflightRequest({ site_url: "https://example.com", user_id: uuid }).ok).toBe(false);
  });

  it("requires all four identity comparisons in canonical order", () => {
    expect(parsePreflightResponse(preflightResponse()).ok).toBe(true);
    const invalid = preflightResponse();
    [invalid.identity_candidates[0].field_comparisons[0], invalid.identity_candidates[0].field_comparisons[1]] =
      [invalid.identity_candidates[0].field_comparisons[1], invalid.identity_candidates[0].field_comparisons[0]];
    expect(parsePreflightResponse(invalid)).toEqual(expect.objectContaining({ ok: false }));
  });

  it("rejects duplicate discovery queries and supplemental domains", () => {
    const base = { case_id: uuid, business_identity: business, primary_service: "Plumbing", target_market: market, queries: ["plumber", "emergency plumber", "local plumber"] };
    expect(parseDiscoveryRequest(base).ok).toBe(true);
    expect(parseDiscoveryRequest({ ...base, queries: ["plumber", "PLUMBER", "local plumber"] }).ok).toBe(false);
    expect(parseDiscoveryRequest({ ...base, supplemental_website_urls: ["https://a.example/x", "https://www.a.example/y"] }).ok).toBe(false);
  });

  it("rejects inconsistent discovery terminal states", () => {
    const queued = {
      discovery_job_id: uuid, status: "queued", stage: "queued", progress: 0, message: "Queued.",
      result: null, error: null, created_at: "2026-09-03T08:00:00Z", updated_at: "2026-09-03T08:00:00Z",
    };
    expect(parseDiscoveryStatusResponse(queued).ok).toBe(true);
    expect(parseDiscoveryStatusResponse({ ...queued, status: "succeeded", stage: "completed", progress: 100 }).ok).toBe(false);
  });
});
