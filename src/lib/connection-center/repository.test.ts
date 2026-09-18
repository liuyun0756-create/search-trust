import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import prospectFixture from "../report-v22/contracts/fixtures/prospect.json";
import verifiedFixture from "../report-v22/contracts/fixtures/verified.json";
import { parseConnectionCenterParentReport, SupabaseConnectionCenterRepository } from "./repository";

const caseId = "00000000-0000-4000-8000-000000000001";
const reportId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";

class Query {
  private rows: Record<string, unknown>[];
  private take = Number.POSITIVE_INFINITY;
  private readonly orders: Array<{ key: string; ascending: boolean }> = [];
  constructor(rows: Record<string, unknown>[]) { this.rows = [...rows]; }
  select() { return this; }
  eq(key: string, value: unknown) { this.rows = this.rows.filter((row) => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[key])); return this; }
  order(key: string, options?: { ascending?: boolean }) {
    this.orders.push({ key, ascending: options?.ascending !== false });
    return this;
  }
  limit(value: number) { this.take = value; return this; }
  private result() {
    return [...this.rows].sort((left, right) => {
      for (const order of this.orders) {
        const compared = String(left[order.key]).localeCompare(String(right[order.key]));
        if (compared !== 0) return compared * (order.ascending ? 1 : -1);
      }
      return 0;
    }).slice(0, this.take);
  }
  maybeSingle() { return Promise.resolve({ data: this.result()[0] ?? null, error: null }); }
  then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
    return Promise.resolve(resolve({ data: this.result(), error: null }));
  }
}

class FakeDb {
  readonly queriedReports: Array<Array<[string, unknown]>> = [];
  constructor(private readonly tables: Record<string, Record<string, unknown>[]>) {}
  from(table: string) {
    const query = new Query(this.tables[table] ?? []);
    if (table === "reports") {
      const calls: Array<[string, unknown]> = [];
      const eq = query.eq.bind(query);
      query.eq = (key: string, value: unknown) => { calls.push([key, value]); return eq(key, value); };
      this.queriedReports.push(calls);
    }
    return query;
  }
}

function fixture() {
  const report = structuredClone(prospectFixture);
  report.identity.case_id = caseId;
  report.report_version.report_id = reportId;
  report.data_coverage.sources.find((source) => source.source_type === "gbp")!.identity_match_status = "matched";
  return report;
}

function prospectRow(report = fixture(), overrides: Record<string, unknown> = {}) {
  return {
    id: reportId,
    case_id: caseId,
    status: "paid_full",
    report_type: "prospect",
    schema_version: "2.2.1",
    version_number: report.report_version.version_number,
    parent_report_id: null,
    report_v2_2: report,
    ...overrides,
  };
}

describe("Connection Center parent report projection", () => {
  it("validates the full report before extracting public GBP evidence", () => {
    const report = fixture();
    const caseRow = {
      id: caseId,
      business_name: report.identity.business.business_name,
      site_url: report.identity.business.site_url,
      updated_at: "2026-09-07T10:00:00Z",
      latest_report_id: reportId,
      business_identity: report.identity.business,
    };
    const result = parseConnectionCenterParentReport(prospectRow(report), caseRow);
    expect(result).toMatchObject({
      id: reportId,
      case_id: caseId,
      identity_matches_case: true,
      public_gbp_url: report.identity.business.public_gbp_url,
      public_gbp_health_status: "healthy",
      public_gbp_identity_match_status: "matched",
      current_lineage: true,
    });
    expect(result?.public_gbp_snapshot_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(result?.public_gbp_fetched_at).toBeTruthy();
  });

  it("rejects feeding a Verified report into the Prospect projection", () => {
    const report = fixture();
    report.report_version.report_type = "verified_execution";
    const parentReportId = "00000000-0000-4000-8000-000000000099";
    (report.report_version as { parent_report_id: string | null }).parent_report_id = parentReportId;
    const caseRow = { id: caseId, business_name: "Example", site_url: "https://example.test/", updated_at: "now", latest_report_id: reportId, business_identity: report.identity.business };
    expect(parseConnectionCenterParentReport(prospectRow(report, { report_type: "verified_execution", parent_report_id: parentReportId }), caseRow)).toBeNull();
  });

  it("marks changed Case identity as stale", () => {
    const report = fixture();
    const caseRow = {
      id: caseId,
      business_name: "Changed Business",
      site_url: report.identity.business.site_url,
      updated_at: "2026-09-07T10:00:00Z",
      latest_report_id: reportId,
      business_identity: { ...report.identity.business, business_name: "Changed Business" },
    };
    expect(parseConnectionCenterParentReport(prospectRow(report), caseRow)?.identity_matches_case).toBe(false);
  });

  it("rejects an invalid or cross-Case report", () => {
    const report = fixture();
    const caseRow = { id: caseId, business_name: "Example", site_url: "https://example.test/", updated_at: "now", latest_report_id: reportId, business_identity: {} };
    expect(parseConnectionCenterParentReport(prospectRow(report, { case_id: "other" }), caseRow)).toBeNull();
    expect(parseConnectionCenterParentReport(prospectRow(report, { report_v2_2: { private: "invalid" } }), caseRow)).toBeNull();
  });

  it("traverses a current Verified report to its original Prospect and never projects the Verified payload", async () => {
    const prospect = fixture();
    const verified = structuredClone(verifiedFixture);
    verified.identity.case_id = caseId;
    verified.identity.business = structuredClone(prospect.identity.business);
    const verifiedId = "00000000-0000-4000-8000-000000000004";
    verified.report_version.report_id = verifiedId;
    verified.report_version.parent_report_id = reportId;
    verified.version_diff.parent_report_id = reportId;
    for (const entry of verified.version_diff.entries) entry.previous_finding.report_id = reportId;
    const caseRow = {
      id: caseId, user_id: userId, status: "active",
      business_name: prospect.identity.business.business_name,
      site_url: prospect.identity.business.site_url,
      business_identity: prospect.identity.business,
      latest_report_id: verifiedId,
      updated_at: "2026-09-15T00:00:00.000Z",
    };
    const latestJobId = "00000000-0000-4000-8000-000000000005";
    const db = new FakeDb({
      client_cases: [caseRow],
      users: [{ id: userId, credit_balance: 2 }],
      google_connections: [], case_source_bindings: [],
      analysis_jobs: [
        { id: "00000000-0000-4000-8000-000000000006", case_id: caseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "OLD_FAILURE", created_at: "2026-09-14T00:00:00.000Z" },
        { id: latestJobId, case_id: caseId, job_type: "verified_report", status: "succeeded", report_id: verifiedId, error_code: null, created_at: "2026-09-15T00:00:00.000Z" },
      ],
      workflow_charges: [{ user_id: userId, case_id: caseId, workflow_kind: "verified", analysis_job_id: latestJobId, state: "consumed" }],
      reports: [
        { id: verifiedId, user_id: userId, case_id: caseId, status: "paid_full", report_type: "verified_execution", schema_version: "2.2.1", version_number: 2, parent_report_id: reportId, report_v2_2: verified },
        { ...prospectRow(prospect), user_id: userId },
      ],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId);
    expect(result?.data.parent_report).toMatchObject({ id: reportId, current_lineage: true });
    expect(result?.data.parent_report?.id).not.toBe(verifiedId);
    expect(result?.data.credit_balance).toBe(2);
    expect(result?.data.verified_job).toEqual({ id: latestJobId, status: "succeeded", report_id: verifiedId, charge_state: "consumed", error_code: null });
    expect(db.queriedReports[1]).toContainEqual(["report_type", "prospect"]);
  });

  it.each([
    ["status", "free_preview"],
    ["schema_version", "2.1.0"],
    ["version_number", 99],
    ["report_type", "verified_execution"],
    ["parent_report_id", "00000000-0000-4000-8000-000000000099"],
  ])("rejects parent row drift in %s", (field, value) => {
    const report = fixture();
    const caseRow = { id: caseId, business_name: report.identity.business.business_name, site_url: report.identity.business.site_url, updated_at: "now", latest_report_id: reportId, business_identity: report.identity.business };
    expect(parseConnectionCenterParentReport(prospectRow(report, { [field]: value }), caseRow)).toBeNull();
  });

  it("uses UUID descending order as a deterministic tie-break for equal job timestamps", async () => {
    const report = fixture();
    const low = "00000000-0000-4000-8000-000000000010";
    const high = "00000000-0000-4000-8000-000000000020";
    const caseRow = { id: caseId, user_id: userId, status: "active", business_name: report.identity.business.business_name, site_url: report.identity.business.site_url, business_identity: report.identity.business, latest_report_id: reportId, updated_at: "2026-09-15T00:00:00.000Z" };
    const createdAt = "2026-09-15T00:00:00.000Z";
    const db = new FakeDb({
      client_cases: [caseRow], users: [{ id: userId, credit_balance: 1 }], google_connections: [], case_source_bindings: [],
      reports: [{ ...prospectRow(report), user_id: userId }],
      analysis_jobs: [
        { id: low, case_id: caseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "LOW", created_at: createdAt },
        { id: high, case_id: caseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "HIGH", created_at: createdAt },
      ],
      workflow_charges: [{ user_id: userId, case_id: caseId, workflow_kind: "verified", analysis_job_id: high, state: "compensated" }],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId);
    expect(result?.data.verified_job?.id).toBe(high);
  });

  it("reads the requested older job settlement even when a newer verified job exists", async () => {
    const report = fixture();
    const tracked = "00000000-0000-4000-8000-000000000010";
    const newer = "00000000-0000-4000-8000-000000000020";
    const caseRow = { id: caseId, user_id: userId, status: "active", business_name: report.identity.business.business_name, site_url: report.identity.business.site_url, business_identity: report.identity.business, latest_report_id: reportId, updated_at: "2026-09-15T00:00:00.000Z" };
    const db = new FakeDb({
      client_cases: [caseRow], users: [{ id: userId, credit_balance: 1 }], google_connections: [], case_source_bindings: [],
      reports: [{ ...prospectRow(report), user_id: userId }],
      analysis_jobs: [
        { id: tracked, case_id: caseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "OLD", created_at: "2026-09-15T00:00:00.000Z" },
        { id: newer, case_id: caseId, job_type: "verified_report", status: "running", report_id: null, error_code: null, created_at: "2026-09-15T00:01:00.000Z" },
      ],
      workflow_charges: [
        { user_id: userId, case_id: caseId, workflow_kind: "verified", analysis_job_id: tracked, state: "compensated" },
        { user_id: userId, case_id: caseId, workflow_kind: "verified", analysis_job_id: newer, state: "reserved" },
      ],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId, tracked);
    expect(result?.data.verified_job).toMatchObject({ id: tracked, status: "failed", charge_state: "compensated" });
  });

  it("does not return a tracked job from another Case", async () => {
    const report = fixture();
    const foreignCaseId = "00000000-0000-4000-8000-000000000088";
    const foreignJobId = "00000000-0000-4000-8000-000000000089";
    const caseRow = { id: caseId, user_id: userId, status: "active", business_name: report.identity.business.business_name, site_url: report.identity.business.site_url, business_identity: report.identity.business, latest_report_id: reportId, updated_at: "2026-09-15T00:00:00.000Z" };
    const db = new FakeDb({
      client_cases: [caseRow], users: [{ id: userId, credit_balance: 0 }], google_connections: [], case_source_bindings: [],
      reports: [{ ...prospectRow(report), user_id: userId }],
      analysis_jobs: [{ id: foreignJobId, case_id: foreignCaseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "FOREIGN", created_at: "2026-09-15T00:00:00.000Z" }],
      workflow_charges: [{ user_id: userId, case_id: foreignCaseId, workflow_kind: "verified", analysis_job_id: foreignJobId, state: "compensated" }],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId, foreignJobId);
    expect(result?.data.verified_job).toBeNull();
  });

  it("blocks readiness when the latest Verified row drifts from its validated payload", async () => {
    const prospect = fixture();
    const verified = structuredClone(verifiedFixture);
    const verifiedId = "00000000-0000-4000-8000-000000000030";
    verified.identity.case_id = caseId;
    verified.identity.business = structuredClone(prospect.identity.business);
    verified.report_version.report_id = verifiedId;
    verified.report_version.parent_report_id = reportId;
    verified.version_diff.parent_report_id = reportId;
    for (const entry of verified.version_diff.entries) entry.previous_finding.report_id = reportId;
    const caseRow = { id: caseId, user_id: userId, status: "active", business_name: prospect.identity.business.business_name, site_url: prospect.identity.business.site_url, business_identity: prospect.identity.business, latest_report_id: verifiedId, updated_at: "2026-09-15T00:00:00.000Z" };
    const db = new FakeDb({
      client_cases: [caseRow], users: [{ id: userId, credit_balance: 1 }], google_connections: [], case_source_bindings: [], analysis_jobs: [], workflow_charges: [],
      reports: [
        { id: verifiedId, user_id: userId, case_id: caseId, status: "paid_full", report_type: "verified_execution", schema_version: "2.1.0", version_number: 2, parent_report_id: reportId, report_v2_2: verified },
        { ...prospectRow(prospect), user_id: userId },
      ],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId);
    expect(result?.data.parent_report).toBeNull();
  });
});
