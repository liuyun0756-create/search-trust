import prospectReport from "../../src/lib/report-v22/contracts/fixtures/prospect.json";
import verifiedReport from "../../src/lib/report-v22/contracts/fixtures/verified.json";
import type { SearchTrustReportV2_2 } from "../../src/lib/report-v22";
import type { TaskStatusResponse } from "../../src/lib/analysis-v22";

import { E2E_IDS } from "./ids";
import { E2E_NOW } from "./preflight";

function localize(value: unknown): unknown {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    const parsed = new URL(value);
    const slug = parsed.hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "resource";
    return `https://${slug}.searchtrust-e2e.example.invalid${parsed.pathname}`;
  }
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, localize(child)]));
  }
  return value;
}

function reportFixture(source: unknown, type: "prospect" | "verified"): SearchTrustReportV2_2 {
  const report = localize(structuredClone(source)) as SearchTrustReportV2_2;
  report.identity.case_id = E2E_IDS.caseId;
  report.identity.business = {
    ...report.identity.business,
    site_url: E2E_IDS.siteUrl,
    normalized_domain: "searchtrust-e2e.example.invalid",
    public_gbp_url: E2E_IDS.gbpUrl,
  };
  report.report_version.report_id = type === "prospect" ? E2E_IDS.reportId : "e2000000-0000-4000-8000-000000000016";
  return report;
}

export const prospectReportFixture = reportFixture(prospectReport, "prospect");
export const verifiedReportFixture = reportFixture(verifiedReport, "verified");

export function analysisStatusFixture(state: "queued" | "running" | "succeeded" | "failed"): TaskStatusResponse {
  const progress = state === "queued" ? 0 : state === "running" ? 55 : 100;
  return {
    job_id: E2E_IDS.analysisJobId,
    revision: state === "queued" ? 1 : state === "running" ? 2 : 3,
    run_generation: 1,
    status: state,
    stage: state === "queued" ? "queued" : state === "running" ? "building_evidence" : state === "succeeded" ? "completed" : "failed",
    progress,
    message: state === "failed" ? "Analysis stopped safely." : state === "succeeded" ? "Report ready." : "Building the synthetic evidence set.",
    report: state === "succeeded" ? prospectReportFixture : null,
    error: state === "failed" ? {
      error_code: "E2E_ANALYSIS_INTERRUPTED",
      user_message: "The analysis stopped safely.",
      retryable: true,
      stage: "failed",
      diagnostic_id: E2E_IDS.marketSnapshotId,
    } : null,
    created_at: E2E_NOW,
    deadline_at: "2099-09-10T08:15:00.000Z",
    updated_at: E2E_NOW,
  };
}
