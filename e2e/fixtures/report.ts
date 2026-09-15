import { createHash } from "node:crypto";

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
  report.report_version.report_id = type === "prospect" ? E2E_IDS.reportId : E2E_IDS.verifiedReportId;
  if (type === "verified") {
    report.report_version.parent_report_id = E2E_IDS.reportId;
    report.version_diff.parent_report_id = E2E_IDS.reportId;
    for (const entry of report.version_diff.entries ?? []) {
      if (entry.previous_finding) entry.previous_finding.report_id = E2E_IDS.reportId;
    }
  }
  return report;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
        ([key, child]) => [key, canonicalize(child)],
      ),
    );
  }
  return value;
}

export function findingFingerprint(finding: SearchTrustReportV2_2["findings"][number]): string {
  const digest = createHash("sha256").update(JSON.stringify(canonicalize(finding))).digest("hex");
  return `sha256:${digest}`;
}

export const VERIFIED_CHANGE_TYPES = Object.freeze({
  fn_market_visibility_gap: "confirmed",
  fn_service_page_gap: "reprioritized",
  fn_public_gbp_service_gap: "refined",
} as const);

export function assertVerifiedChangesMatchProspect(
  prospect: SearchTrustReportV2_2,
  verified: SearchTrustReportV2_2,
): void {
  const parentReportId = prospect.report_version.report_id;
  if (verified.report_version.parent_report_id !== parentReportId
    || verified.version_diff.parent_report_id !== parentReportId) {
    throw new Error("Verified report does not reference the exact original Prospect report.");
  }

  const parentFindings = new Map(prospect.findings.map((finding) => [finding.finding_id, finding]));
  const currentFindings = new Map(verified.findings.map((finding) => [finding.finding_id, finding]));
  const evidenceIds = new Set(verified.evidence_index.map((evidence) => evidence.evidence_id));
  const referencedParents = new Set<string>();
  const entries = verified.version_diff.entries ?? [];

  for (const entry of entries) {
    if (!entry.previous_finding) throw new Error("The Verified fixture contains an unbounded new change entry.");
    const previous = entry.previous_finding;
    const parent = parentFindings.get(previous.finding_id);
    if (!parent || previous.report_id !== parentReportId) {
      throw new Error("A change entry does not resolve to the original Prospect finding.");
    }
    if (referencedParents.has(previous.finding_id)) {
      throw new Error("A Prospect finding is represented by more than one change entry.");
    }
    referencedParents.add(previous.finding_id);
    if (previous.statement !== parent.statement || previous.fingerprint !== findingFingerprint(parent)) {
      throw new Error("A previous finding statement or fingerprint differs from the original Prospect finding.");
    }
    const expectedType = VERIFIED_CHANGE_TYPES[previous.finding_id as keyof typeof VERIFIED_CHANGE_TYPES];
    if (entry.change_type !== expectedType) {
      throw new Error(`Change type ${entry.change_type} is inconsistent with ${previous.finding_id}.`);
    }
    if (entry.current_finding_ids.length !== 1) {
      throw new Error("Each deterministic fixture change must identify exactly one current finding.");
    }
    const current = currentFindings.get(entry.current_finding_ids[0]);
    if (!current || current.finding_id !== previous.finding_id) {
      throw new Error("A change entry does not resolve to its current Verified finding.");
    }
    const addedEvidence = entry.evidence_ids.filter((id) => !parent.evidence_ids.includes(id));
    if (current.statement === parent.statement || addedEvidence.length === 0) {
      throw new Error("A change entry lacks a real semantic finding/evidence difference.");
    }
    for (const id of entry.evidence_ids) {
      if (!evidenceIds.has(id) || !current.evidence_ids.includes(id)) {
        throw new Error(`Change evidence ${id} is not present on the current Verified finding.`);
      }
    }
  }

  if (entries.length !== Object.keys(VERIFIED_CHANGE_TYPES).length) {
    throw new Error("The Verified fixture change set differs from the independent expected change catalogue.");
  }
}

export const prospectReportFixture = reportFixture(prospectReport, "prospect");
export const verifiedReportFixture = reportFixture(verifiedReport, "verified");

for (const entry of verifiedReportFixture.version_diff.entries ?? []) {
  if (!entry.previous_finding) continue;
  const parent = prospectReportFixture.findings.find(
    (finding) => finding.finding_id === entry.previous_finding?.finding_id,
  );
  if (!parent) continue;
  entry.previous_finding.statement = parent.statement;
  entry.previous_finding.fingerprint = findingFingerprint(parent);
}

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

export function verifiedAnalysisStatusFixture(
  jobId: string,
  state: "queued" | "running" | "succeeded" | "failed",
) {
  const fixture = analysisStatusFixture(state);
  return {
    ...fixture,
    job_id: jobId,
    message: state === "queued" ? "Verified Action Plan queued…"
      : state === "running" ? "Generating your Verified Action Plan…"
        : state === "succeeded" ? "Verified Action Plan ready."
          : "The Verified generation stopped safely.",
    report: null,
    ...(state === "succeeded" ? { database_report_id: E2E_IDS.verifiedReportId } : {}),
    ...(state === "failed" ? {
      error: {
        error_code: "V22_PROVIDER_FAILED",
        user_message: "The Verified generation stopped safely.",
        retryable: true,
        stage: "failed",
        diagnostic_id: E2E_IDS.marketSnapshotId,
      },
    } : {}),
  };
}
