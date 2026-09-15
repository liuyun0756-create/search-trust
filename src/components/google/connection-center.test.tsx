import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ConnectionCenterResponse, ConnectionCenterSource } from "@/lib/connection-center/contracts";
import { ConnectionCenter } from "./connection-center";

function source(overrides: Partial<ConnectionCenterSource> & Pick<ConnectionCenterSource, "source_key" | "title">): ConnectionCenterSource {
  return {
    required_for_verified_core: true,
    user_status: "healthy",
    ready: true,
    summary: "Healthy, identity-matched evidence is ready.",
    action: null,
    technical_status: {
      connection_status: "active",
      binding_id: "binding-1",
      resource_id: "resource-1",
      resource_name: "Example resource",
      identity_match_status: "matched",
      job: null,
      snapshot: {
        id: "snapshot-1",
        health_status: "healthy",
        effective_health_status: "healthy",
        health_reasons: [],
        fetched_at: "2026-09-07T10:00:00.000Z",
        expires_at: null,
        coverage_start: null,
        coverage_end: null,
        content_available: true,
      },
      warnings: [],
    },
    ...overrides,
  };
}

function response(ready = false): ConnectionCenterResponse {
  const publicGbp = source({ source_key: "public_gbp", title: "Public Business Profile" });
  const gsc = source({
    source_key: "gsc",
    title: "Search Console",
    ready,
    user_status: ready ? "healthy" : "needs_resource",
    summary: ready ? "Healthy evidence is ready." : "Choose the Search Console resource that belongs to this Case.",
    action: ready ? null : { code: "select_resource", label: "Choose Search Console resource", source_key: "gsc" },
  });
  const ga4 = source({
    source_key: "ga4",
    title: "Google Analytics",
    ready,
    user_status: ready ? "healthy" : "ready_to_sync",
    summary: ready ? "Healthy evidence is ready." : "The resource is confirmed and ready for its first data sync.",
    action: ready ? null : { code: "sync_source", label: "Sync Google Analytics", source_key: "ga4" },
  });
  const optional = source({
    source_key: "official_gbp_performance",
    title: "Official GBP Performance",
    required_for_verified_core: false,
    ready: false,
    user_status: "optional_unavailable",
    summary: "Optional owner-only data.",
    technical_status: { connection_status: null, binding_id: null, resource_id: null, resource_name: null, identity_match_status: "not_checked", job: null, snapshot: null, warnings: [] },
  });
  return {
    schema_version: "connection_center_v1",
    case: { id: "case-1", business_name: "Example Plumbing", site_url: "https://example.test", updated_at: "2026-09-07T10:00:00.000Z" },
    billing: { audit_credits: ready ? 1 : 0 },
    verified_job: null,
    coverage: {
      verified_core_ready: ready,
      full_evidence_ready: false,
      verified_generation_enabled: false,
      ready_source_count: ready ? 3 : 1,
      required_source_count: 3,
      parent_report_id: "report-1",
      eligible_snapshot_ids: { gsc: ready ? "snapshot-gsc" : null, ga4: ready ? "snapshot-ga4" : null, gbp_performance: null },
      blockers: ready ? [] : [{ code: "GSC_RESOURCE_REQUIRED", message: gsc.summary, source_key: "gsc", action: gsc.action! }],
      next_action: ready
        ? { code: "wait_for_verified_analysis", label: "Ready for verified analysis", source_key: null }
        : gsc.action!,
    },
    sources: [publicGbp, gsc, ga4],
    optional_sources: [optional],
  };
}

describe("Connection Center", () => {
  it("renders the approved source order and next blocker without a coverage score", () => {
    const html = renderToStaticMarkup(<ConnectionCenter caseId="case-1" businessName="Example Plumbing" siteUrl="https://example.test" initialData={response()} />);
    expect(html.indexOf('data-source-key="public_gbp"')).toBeLessThan(html.indexOf('data-source-key="gsc"'));
    expect(html.indexOf('data-source-key="gsc"')).toBeLessThan(html.indexOf('data-source-key="ga4"'));
    expect(html).toContain("Complete the required source shown below before generating");
    expect(html).toContain("Choose Search Console resource");
    expect(html).not.toContain("Official GBP Performance");
    expect(html).not.toContain("progressbar");
    expect(html).toContain("Technical details");
  });

  it("shows the enabled one-credit generation action when the three-source gate is ready", () => {
    const value = response(true);
    value.coverage.verified_generation_enabled = true;
    value.coverage.next_action = { code: "generate_verified_plan", label: "Generate Verified Action Plan · uses 1 credit", source_key: null };
    const html = renderToStaticMarkup(<ConnectionCenter caseId="case-1" businessName="Example Plumbing" siteUrl="https://example.test" initialData={value} />);
    expect(html).toContain("Ready to generate. All required evidence is healthy and matched to this Case");
    expect(html).toContain("Generate Verified Action Plan · uses 1 credit");
    const labelAt = html.indexOf("Generate Verified Action Plan · uses 1 credit");
    const cta = html.slice(html.lastIndexOf("<button", labelAt), html.indexOf("</button>", labelAt));
    expect(cta).not.toContain('disabled=""');
    expect(html).not.toContain("Choose Search Console resource");
  });
});
