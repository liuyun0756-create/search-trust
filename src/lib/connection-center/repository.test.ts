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
  constructor(rows: Record<string, unknown>[]) { this.rows = [...rows]; }
  select() { return this; }
  eq(key: string, value: unknown) { this.rows = this.rows.filter((row) => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[key])); return this; }
  order(key: string, options?: { ascending?: boolean }) {
    this.rows.sort((left, right) => String(left[key]).localeCompare(String(right[key])) * (options?.ascending === false ? -1 : 1));
    return this;
  }
  limit(value: number) { this.take = value; return this; }
  maybeSingle() { return Promise.resolve({ data: this.rows.slice(0, this.take)[0] ?? null, error: null }); }
  then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
    return Promise.resolve(resolve({ data: this.rows.slice(0, this.take), error: null }));
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
    const result = parseConnectionCenterParentReport({ id: reportId, case_id: caseId, report_v2_2: report }, caseRow);
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
    expect(parseConnectionCenterParentReport({ id: reportId, case_id: caseId, report_type: "verified_execution", parent_report_id: parentReportId, report_v2_2: report }, caseRow)).toBeNull();
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
    expect(parseConnectionCenterParentReport({ id: reportId, case_id: caseId, report_v2_2: report }, caseRow)?.identity_matches_case).toBe(false);
  });

  it("rejects an invalid or cross-Case report", () => {
    const report = fixture();
    const caseRow = { id: caseId, business_name: "Example", site_url: "https://example.test/", updated_at: "now", latest_report_id: reportId, business_identity: {} };
    expect(parseConnectionCenterParentReport({ id: reportId, case_id: "other", report_v2_2: report }, caseRow)).toBeNull();
    expect(parseConnectionCenterParentReport({ id: reportId, case_id: caseId, report_v2_2: { private: "invalid" } }, caseRow)).toBeNull();
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
      users: [{ id: userId, audit_credits: 2 }],
      google_connections: [], case_source_bindings: [],
      analysis_jobs: [
        { id: "00000000-0000-4000-8000-000000000006", case_id: caseId, job_type: "verified_report", status: "failed", report_id: null, error_code: "OLD_FAILURE", created_at: "2026-09-14T00:00:00.000Z" },
        { id: latestJobId, case_id: caseId, job_type: "verified_report", status: "succeeded", report_id: verifiedId, error_code: null, created_at: "2026-09-15T00:00:00.000Z" },
      ],
      analysis_attempt_charges: [{ user_id: userId, case_id: caseId, job_id: latestJobId, state: "consumed" }],
      reports: [
        { id: verifiedId, user_id: userId, case_id: caseId, report_type: "verified_execution", parent_report_id: reportId, report_v2_2: verified },
        { id: reportId, user_id: userId, case_id: caseId, report_type: "prospect", parent_report_id: null, report_v2_2: prospect },
      ],
    });
    const result = await new SupabaseConnectionCenterRepository(db as unknown as SupabaseClient).read(userId, caseId);
    expect(result?.data.parent_report).toMatchObject({ id: reportId, current_lineage: true });
    expect(result?.data.parent_report?.id).not.toBe(verifiedId);
    expect(result?.data.audit_credits).toBe(2);
    expect(result?.data.verified_job).toEqual({ id: latestJobId, status: "succeeded", report_id: verifiedId, charge_state: "consumed", error_code: null });
    expect(db.queriedReports[1]).toContainEqual(["report_type", "prospect"]);
  });
});
