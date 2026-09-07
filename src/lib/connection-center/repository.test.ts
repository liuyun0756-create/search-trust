import { describe, expect, it } from "vitest";

import prospectFixture from "../report-v22/contracts/fixtures/prospect.json";
import { parseConnectionCenterParentReport } from "./repository";

const caseId = "00000000-0000-4000-8000-000000000001";
const reportId = "00000000-0000-4000-8000-000000000002";

function fixture() {
  const report = structuredClone(prospectFixture);
  report.identity.case_id = caseId;
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
    });
    expect(result?.public_gbp_snapshot_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(result?.public_gbp_fetched_at).toBeTruthy();
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
});
