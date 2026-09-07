import { describe, expect, it } from "vitest";

import { projectConnectionCenter, type ConnectionCenterProjectionInput } from "./projector";

const now = new Date("2026-09-07T12:00:00.000Z");
const ids = {
  case: "00000000-0000-4000-8000-000000000001",
  report: "00000000-0000-4000-8000-000000000002",
  gscBinding: "00000000-0000-4000-8000-000000000003",
  ga4Binding: "00000000-0000-4000-8000-000000000004",
  gbpBinding: "00000000-0000-4000-8000-000000000005",
  gscConnection: "00000000-0000-4000-8000-000000000006",
  ga4Connection: "00000000-0000-4000-8000-000000000007",
  gbpConnection: "00000000-0000-4000-8000-000000000008",
};

const identityScopes = ["openid", "email", "profile"];
const sourceScopes = {
  gsc: [...identityScopes, "https://www.googleapis.com/auth/webmasters.readonly"],
  ga4: [...identityScopes, "https://www.googleapis.com/auth/analytics.readonly"],
  gbp: [...identityScopes, "https://www.googleapis.com/auth/business.manage"],
};

function input(): ConnectionCenterProjectionInput {
  return {
    case: {
      id: ids.case,
      business_name: "Example Plumbing",
      site_url: "https://example.test/",
      updated_at: "2026-09-07T10:00:00.000Z",
      latest_report_id: ids.report,
      public_gbp_url: "https://maps.google.com/?cid=123",
    },
    parent_report: {
      id: ids.report,
      case_id: ids.case,
      identity_matches_case: true,
      public_gbp_url: "https://maps.google.com/?cid=123",
      public_gbp_snapshot_id: "00000000-0000-4000-8000-000000000009",
      public_gbp_fetched_at: "2026-09-07T09:30:00.000Z",
      public_gbp_health_status: "healthy",
      public_gbp_identity_match_status: "matched",
    },
    connections: [
      { id: ids.gscConnection, status: "active", granted_scopes: sourceScopes.gsc },
      { id: ids.ga4Connection, status: "active", granted_scopes: sourceScopes.ga4 },
    ],
    bindings: [
      { id: ids.gscBinding, source_type: "gsc", connection_id: ids.gscConnection, external_resource_id: "sc-domain:example.test", external_resource_name: "example.test", identity_match_status: "matched", confirmed_at: "2026-09-07T10:10:00.000Z" },
      { id: ids.ga4Binding, source_type: "ga4", connection_id: ids.ga4Connection, external_resource_id: "properties/123", external_resource_name: "Example GA4", identity_match_status: "matched", confirmed_at: "2026-09-07T10:10:00.000Z" },
    ],
    jobs: [],
    snapshots: [
      { id: "00000000-0000-4000-8000-000000000011", binding_id: ids.gscBinding, source_type: "gsc", health_status: "healthy", health_reasons: [], fetched_at: "2026-09-07T11:00:00.000Z", expires_at: "2026-10-07T11:00:00.000Z", coverage_start: "2026-03-10", coverage_end: "2026-09-05", raw_content_deleted_at: null },
      { id: "00000000-0000-4000-8000-000000000012", binding_id: ids.ga4Binding, source_type: "ga4", health_status: "healthy", health_reasons: [], fetched_at: "2026-09-07T11:00:00.000Z", expires_at: "2026-10-07T11:00:00.000Z", coverage_start: "2026-03-10", coverage_end: "2026-09-05", raw_content_deleted_at: null },
    ],
    flags: { gsc_sync_enabled: true, ga4_sync_enabled: true, official_gbp_sync_enabled: false, verified_generation_enabled: false },
  };
}

describe("Connection Center projector", () => {
  it("marks Verified Core ready from confirmed public GBP plus healthy GSC and GA4", () => {
    const result = projectConnectionCenter(input(), now);
    expect(result.coverage).toMatchObject({
      verified_core_ready: true,
      full_evidence_ready: false,
      ready_source_count: 3,
      required_source_count: 3,
      eligible_snapshot_ids: { gsc: expect.any(String), ga4: expect.any(String), gbp_performance: null },
    });
    expect(result.sources.map((source) => source.source_key)).toEqual(["public_gbp", "gsc", "ga4"]);
    expect(result.optional_sources[0].user_status).toBe("optional_unavailable");
    expect(result.coverage.next_action.code).toBe("wait_for_verified_analysis");
  });

  it("requires a parent report before source-level blockers", () => {
    const value = input();
    value.parent_report = null;
    const result = projectConnectionCenter(value, now);
    expect(result.coverage.blockers[0].code).toBe("PARENT_REPORT_MISSING");
    expect(result.coverage.next_action.code).toBe("create_prospect_report");
  });

  it("blocks when the public GBP link is missing", () => {
    const value = input();
    value.case.public_gbp_url = null;
    value.parent_report = null;
    const result = projectConnectionCenter(value, now);
    expect(result.sources[0]).toMatchObject({ user_status: "needs_profile", ready: false });
    expect(result.coverage.blockers.some((blocker) => blocker.code === "PUBLIC_GBP_MISSING")).toBe(true);
  });

  it("rejects a stale parent identity or a different public GBP URL", () => {
    for (const mutate of [
      (value: ConnectionCenterProjectionInput) => { value.parent_report!.identity_matches_case = false; },
      (value: ConnectionCenterProjectionInput) => { value.parent_report!.public_gbp_url = "https://maps.google.com/?cid=999"; },
    ]) {
      const value = input();
      mutate(value);
      const result = projectConnectionCenter(value, now);
      expect(result.sources[0].ready).toBe(false);
      expect(result.coverage.blockers.some((blocker) => blocker.code === "PUBLIC_GBP_IDENTITY_STALE")).toBe(true);
    }
  });

  it("requires healthy matched public GBP evidence", () => {
    const value = input();
    value.parent_report!.public_gbp_health_status = "unavailable";
    value.parent_report!.public_gbp_identity_match_status = "needs_confirmation";
    const result = projectConnectionCenter(value, now);
    expect(result.sources[0]).toMatchObject({ user_status: "needs_attention", ready: false });
    expect(result.coverage.blockers.some((blocker) => blocker.code === "PUBLIC_GBP_NOT_READY")).toBe(true);
  });

  it("requires a collection timestamp for public GBP evidence", () => {
    const value = input();
    value.parent_report!.public_gbp_fetched_at = null;
    const result = projectConnectionCenter(value, now);
    expect(result.sources[0]).toMatchObject({ user_status: "needs_attention", ready: false });
    expect(result.sources[0].technical_status.snapshot).toBeNull();
  });

  it("distinguishes missing Google connection, resource and identity confirmation", () => {
    const noConnection = input();
    noConnection.connections = noConnection.connections.filter((item) => item.id !== ids.gscConnection);
    expect(projectConnectionCenter(noConnection, now).sources[1].user_status).toBe("needs_connection");

    const noBinding = input();
    noBinding.bindings = noBinding.bindings.filter((item) => item.source_type !== "gsc");
    noBinding.snapshots = noBinding.snapshots.filter((item) => item.source_type !== "gsc");
    expect(projectConnectionCenter(noBinding, now).sources[1].user_status).toBe("needs_resource");

    const confirmation = input();
    confirmation.bindings.find((item) => item.source_type === "gsc")!.identity_match_status = "needs_confirmation";
    expect(projectConnectionCenter(confirmation, now).sources[1].user_status).toBe("needs_identity_confirmation");
  });

  it("requires a source sync when no snapshot exists", () => {
    const value = input();
    value.snapshots = value.snapshots.filter((item) => item.source_type !== "ga4");
    const source = projectConnectionCenter(value, now).sources[2];
    expect(source).toMatchObject({ user_status: "ready_to_sync", ready: false, action: { code: "sync_source" } });
  });

  it("shows active progress while an existing healthy snapshot remains eligible", () => {
    const value = input();
    value.jobs.push({ id: "job-1", binding_id: ids.ga4Binding, source_type: "ga4", status: "running", attempt_count: 1, error_code: null, created_at: "2026-09-07T11:30:00.000Z", completed_at: null });
    const result = projectConnectionCenter(value, now);
    expect(result.sources[2]).toMatchObject({ user_status: "syncing", ready: true, action: { code: "wait_for_sync" } });
    expect(result.coverage.verified_core_ready).toBe(true);
  });

  it("retains a valid healthy snapshot when the latest refresh failed", () => {
    const value = input();
    value.jobs.push({ id: "job-2", binding_id: ids.gscBinding, source_type: "gsc", status: "failed", attempt_count: 3, error_code: "GSC_PROVIDER_UNAVAILABLE", created_at: "2026-09-07T11:30:00.000Z", completed_at: "2026-09-07T11:31:00.000Z" });
    const result = projectConnectionCenter(value, now);
    expect(result.sources[1]).toMatchObject({ user_status: "healthy", ready: true, action: { code: "retry_sync" } });
    expect(result.sources[1].technical_status.warnings).toContain("LATEST_SYNC_FAILED");
    expect(result.coverage.verified_core_ready).toBe(true);
  });

  it("blocks expired and unhealthy snapshots without treating missing data as zero", () => {
    const expired = input();
    expired.snapshots.find((item) => item.source_type === "gsc")!.expires_at = "2026-09-07T11:59:59.000Z";
    expect(projectConnectionCenter(expired, now).sources[1]).toMatchObject({ user_status: "needs_attention", ready: false });

    const unhealthy = input();
    const snapshot = unhealthy.snapshots.find((item) => item.source_type === "ga4")!;
    snapshot.health_status = "unhealthy";
    snapshot.health_reasons = ["GA4_NO_CURRENT_SESSIONS"];
    const source = projectConnectionCenter(unhealthy, now).sources[2];
    expect(source.ready).toBe(false);
    expect(source.technical_status.snapshot?.health_reasons).toEqual(["GA4_NO_CURRENT_SESSIONS"]);
  });

  it("requires official GBP Performance only for Full Evidence", () => {
    const value = input();
    value.flags.official_gbp_sync_enabled = true;
    value.connections.push({ id: ids.gbpConnection, status: "active", granted_scopes: sourceScopes.gbp });
    value.bindings.push({ id: ids.gbpBinding, source_type: "gbp", connection_id: ids.gbpConnection, external_resource_id: "locations/123", external_resource_name: "Example Plumbing", identity_match_status: "matched", confirmed_at: "2026-09-07T10:10:00.000Z" });
    value.snapshots.push({ id: "00000000-0000-4000-8000-000000000013", binding_id: ids.gbpBinding, source_type: "gbp", health_status: "healthy", health_reasons: [], fetched_at: "2026-09-07T11:00:00.000Z", expires_at: "2026-10-07T11:00:00.000Z", coverage_start: "2026-03-10", coverage_end: "2026-09-05", raw_content_deleted_at: null });
    const result = projectConnectionCenter(value, now);
    expect(result.coverage).toMatchObject({ verified_core_ready: true, full_evidence_ready: true });
    expect(result.coverage.eligible_snapshot_ids.gbp_performance).toBe("00000000-0000-4000-8000-000000000013");
  });

  it("never accepts expired or deleted official GBP Content for Full Evidence", () => {
    const value = input();
    value.flags.official_gbp_sync_enabled = true;
    value.connections.push({ id: ids.gbpConnection, status: "active", granted_scopes: sourceScopes.gbp });
    value.bindings.push({ id: ids.gbpBinding, source_type: "gbp", connection_id: ids.gbpConnection, external_resource_id: "locations/123", external_resource_name: "Example Plumbing", identity_match_status: "matched", confirmed_at: "2026-09-07T10:10:00.000Z" });
    value.snapshots.push({ id: "00000000-0000-4000-8000-000000000013", binding_id: ids.gbpBinding, source_type: "gbp", health_status: "healthy", health_reasons: [], fetched_at: "2026-09-07T11:00:00.000Z", expires_at: "2026-10-07T11:00:00.000Z", coverage_start: "2026-03-10", coverage_end: "2026-09-05", raw_content_deleted_at: "2026-09-07T11:30:00.000Z" });
    expect(projectConnectionCenter(value, now).coverage.full_evidence_ready).toBe(false);
  });

  it("enables the generation action only when both the gate and future flag are ready", () => {
    const value = input();
    value.flags.verified_generation_enabled = true;
    expect(projectConnectionCenter(value, now).coverage.next_action.code).toBe("generate_verified_plan");

    value.snapshots = value.snapshots.filter((item) => item.source_type !== "ga4");
    expect(projectConnectionCenter(value, now).coverage.next_action.code).toBe("sync_source");
  });
});
