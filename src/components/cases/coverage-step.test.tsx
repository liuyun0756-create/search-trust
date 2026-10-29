import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createNewCaseDraft,
  type ModuleAvailability,
  type NewCaseDraft,
} from "@/lib/preflight-v22";

import { CoverageStep } from "./coverage-step";

function coverageDraft(): NewCaseDraft {
  const moduleKeys: ModuleAvailability["module_key"][] = [
    "site_inventory",
    "site_deep_analysis",
    "serp_maps",
    "serp_local_pack",
    "serp_organic",
    "public_gbp",
    "competitor_analysis",
    "pagespeed",
  ];

  return {
    ...createNewCaseDraft(new Date("2026-09-25T00:00:00.000Z"), "draft-1"),
    stage: "coverage",
    goal: "win_new_client",
    prospect_workflow_id: "workflow-1",
    selected_competitor_ids: ["competitor-1"],
    preflight: {
      preflight_id: "preflight-1",
      normalized_site_url: "https://example.com/",
      identity_candidates: [],
      service_candidates: [],
      market_candidates: [],
      competitor_candidates: [],
      module_availability: moduleKeys.map((module_key) => ({ module_key, available: true, reason: "Available." })),
      data_gaps: [],
      estimated_duration_bucket: "under_5_minutes",
      coverage_summary: "Ready.",
    },
    business_confirmation: {
      business_identity: {
        business_name: "Example Plumbing",
        site_url: "https://example.com/",
        normalized_domain: "example.com",
        operating_model: "service_area",
        primary_location: { display_name: "Austin, TX", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null },
        public_gbp_url: "https://example.com/gbp",
      },
      primary_service: "Emergency plumbing",
      target_market: { display_name: "Austin, TX", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null },
    },
    discovery_status: {
      discovery_job_id: "job-1",
      status: "succeeded",
      stage: "completed",
      progress: 100,
      message: "Ready.",
      result: {
        discovery_id: "discovery-1",
        case_id: "case-1",
        input_digest: "digest-1",
        candidate_digest: "digest-2",
        market_snapshot_id: "snapshot-1",
        market_snapshot_checksum: "checksum-1",
        candidates: [],
        ready_for_confirmation: true,
        data_gaps: [],
        limitations: [],
        created_at: "2026-09-25T00:00:00.000Z",
        expires_at: "2026-09-26T00:00:00.000Z",
      },
      error: null,
      created_at: "2026-09-25T00:00:00.000Z",
      updated_at: "2026-09-25T00:00:00.000Z",
    },
  };
}

describe("CoverageStep", () => {
  it("translates technical coverage into report scope and boundaries", () => {
    const html = renderToStaticMarkup(<CoverageStep draft={coverageDraft()} onContinue={vi.fn()} onBack={vi.fn()} />);

    expect(html).toContain("Know what the report can say before it is generated.");
    expect(html).toContain("Three connected evidence questions");
    expect(html).toContain("No private performance data yet");
    expect(html).toContain("One confirmed competitor supports a focused comparison");
    expect(html).toContain("Generate Prospect report");
    expect(html).toContain("No additional credit");
  });
});

 it("does not present the preflight duration bucket as a report completion promise", () => {
   const html = renderToStaticMarkup(<CoverageStep draft={coverageDraft()} onContinue={()=>undefined} onBack={()=>undefined}/>);
   expect(html).toContain("Timing varies with source availability");
   expect(html).not.toContain("under 5 minutes");
 });
