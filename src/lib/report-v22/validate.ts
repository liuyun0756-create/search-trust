import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import reportSchema from "./contracts/report_v2_2.schema.json";
import type { SearchTrustReportV2_2 } from "./generated/types";
import { casefold, competitorWebsiteKey, isBlankQuery, sameTargetMarket, stripString } from "./normalization";

export type ReportV22ValidationErrorCode =
  | "REPORT_CONTRACT_INVALID"
  | "REPORT_REFERENCE_INVALID";

export interface ReportV22ValidationError {
  code: ReportV22ValidationErrorCode;
  path: string;
  message: string;
}

export type ReportV22ValidationResult =
  | { ok: true; report: SearchTrustReportV2_2 }
  | { ok: false; errors: ReportV22ValidationError[] };

const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: true,
  useDefaults: false,
});
addFormats(ajv);

const validateStructure = ajv.compile<SearchTrustReportV2_2>(reportSchema);

function structuralErrors(errors: ErrorObject[] | null | undefined): ReportV22ValidationError[] {
  return (errors ?? []).map((error) => ({
    code: "REPORT_CONTRACT_INVALID",
    path: error.instancePath || "/",
    message: error.message ?? "Report data does not match the v2.2 contract.",
  }));
}

function semanticError(path: string, message: string): ReportV22ValidationError {
  return { code: "REPORT_REFERENCE_INVALID", path, message };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function missingReferences(values: string[], available: Set<string>): string[] {
  return [...new Set(values.filter((value) => !available.has(value)))].sort();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateSemantics(report: SearchTrustReportV2_2): ReportV22ValidationError[] {
  const errors: ReportV22ValidationError[] = [];
  const queries = report.case_context.queries.map(stripString);
  if (queries.some(isBlankQuery) || duplicates(queries.map(casefold)).length) {
    errors.push(semanticError("/case_context/queries", "Queries must be nonblank and unique after case normalization."));
  }

  const checkCoverageDates = (
    source: { coverage_start?: string | null; coverage_end?: string | null },
    path: string,
  ) => {
    if (source.coverage_start && source.coverage_end && source.coverage_start > source.coverage_end) {
      errors.push(semanticError(`${path}/coverage_start`, "Coverage start must not be after coverage end."));
    }
  };
  report.evidence_index.forEach((evidence, index) => checkCoverageDates(evidence, `/evidence_index/${index}`));
  for (const source of ["gsc", "gbp", "ga4"] as const) {
    checkCoverageDates(report.first_party_performance[source], `/first_party_performance/${source}`);
  }

  const inventory = report.site_inventory_summary;
  if (inventory.structurally_checked_count > inventory.discovered_url_count) {
    errors.push(semanticError("/site_inventory_summary/structurally_checked_count", "Structurally checked count cannot exceed discovered count."));
  }
  if (inventory.deep_analyzed_count > inventory.structurally_checked_count) {
    errors.push(semanticError("/site_inventory_summary/deep_analyzed_count", "Deep analyzed count cannot exceed structurally checked count."));
  }
  if (inventory.deep_analyzed_count !== (inventory.selected_pages ?? []).filter((page) => page.deep_analyzed).length) {
    errors.push(semanticError("/site_inventory_summary/deep_analyzed_count", "Deep analyzed count must match selected page entries."));
  }
  const evidenceIds = report.evidence_index.map((evidence) => evidence.evidence_id);
  const findingIds = report.findings.map((finding) => finding.finding_id);
  const actionIds = report.top_actions.map((action) => action.action_id);
  const evidenceSet = new Set(evidenceIds);
  const findingSet = new Set(findingIds);
  const actionSet = new Set(actionIds);

  for (const [path, values] of [
    ["/evidence_index", evidenceIds],
    ["/findings", findingIds],
    ["/top_actions", actionIds],
  ] as const) {
    const repeated = duplicates(values);
    if (repeated.length) errors.push(semanticError(path, `Duplicate IDs: ${repeated.join(", ")}`));
  }

  const evidenceReferences = [
    ...report.findings.flatMap((finding) => [...finding.evidence_ids, ...(finding.comparator_ids ?? [])]),
    ...(report.market_snapshot.results ?? []).map((result) => result.evidence_id),
    ...(report.site_inventory_summary.selected_pages ?? []).flatMap((page) => page.evidence_ids ?? []),
    ...report.competitor_analysis.competitors.flatMap((competitor) => competitor.evidence_ids),
    ...report.eight_layers.flatMap((layer) => layer.evidence_ids ?? []),
    ...(report.version_diff.entries ?? []).flatMap((entry) => entry.evidence_ids),
  ];
  const missingEvidence = missingReferences(evidenceReferences, evidenceSet);
  if (missingEvidence.length) {
    errors.push(semanticError("/evidence_index", `Unknown evidence references: ${missingEvidence.join(", ")}`));
  }

  const findingReferences = [
    ...report.executive_decision.finding_ids,
    ...report.top_actions.flatMap((action) => action.finding_ids),
    ...report.eight_layers.flatMap((layer) => layer.finding_ids ?? []),
    ...(report.version_diff.entries ?? []).flatMap((entry) => entry.current_finding_ids),
  ];
  const missingFindings = missingReferences(findingReferences, findingSet);
  if (missingFindings.length) {
    errors.push(semanticError("/findings", `Unknown finding references: ${missingFindings.join(", ")}`));
  }

  if (!sameJson(report.top_actions.map((action) => action.sequence), [1, 2, 3])) {
    errors.push(semanticError("/top_actions", "Top actions must be ordered with sequences 1, 2, 3."));
  }
  if (!sameJson(report.client_summary.action_ids, actionIds)) {
    errors.push(semanticError("/client_summary/action_ids", "Client summary actions must match ordered top actions."));
  }

  for (const [index, action] of report.top_actions.entries()) {
    const unknownDependencies = missingReferences(action.dependencies ?? [], actionSet);
    if (unknownDependencies.length) {
      errors.push(semanticError(`/top_actions/${index}/dependencies`, `Unknown action dependencies: ${unknownDependencies.join(", ")}`));
    }
    if ((action.dependencies ?? []).includes(action.action_id)) {
      errors.push(semanticError(`/top_actions/${index}/dependencies`, "An action cannot depend on itself."));
    }
    const stepSequences = action.implementation_steps.map((step) => step.sequence);
    const expectedSequences = stepSequences.map((_, stepIndex) => stepIndex + 1);
    if (!sameJson(stepSequences, expectedSequences)) {
      errors.push(semanticError(`/top_actions/${index}/implementation_steps`, "Implementation step sequences must be contiguous and ordered."));
    }
  }

  if (!sameJson(report.roadmap_30_60_90.phases.map((phase) => phase.period), ["days_1_30", "days_31_60", "days_61_90"])) {
    errors.push(semanticError("/roadmap_30_60_90/phases", "Roadmap phases must be ordered 30, 60, then 90 days."));
  }
  const roadmapActionIds = report.roadmap_30_60_90.phases.flatMap((phase) => phase.action_ids);
  if (!sameJson([...new Set(roadmapActionIds)].sort(), [...actionSet].sort())) {
    errors.push(semanticError("/roadmap_30_60_90", "Roadmap must reference every top action and no unknown actions."));
  }

  const expectedLayers = [
    "foundation",
    "entity_presence",
    "entity_consistency",
    "specificity",
    "real_world_connection",
    "accountability",
    "page_unique_value",
    "algorithm_fit",
  ];
  if (!sameJson(report.eight_layers.map((layer) => layer.layer_key), expectedLayers)) {
    errors.push(semanticError("/eight_layers", "Eight layers must use the canonical order."));
  }

  const firstPartySources = [
    report.first_party_performance.gsc,
    report.first_party_performance.gbp,
    report.first_party_performance.ga4,
  ];
  const parentReportId = report.report_version.parent_report_id ?? null;
  if (report.report_version.report_type === "prospect") {
    if (parentReportId !== null || report.version_diff.kind !== "initial" || report.version_diff.parent_report_id != null) {
      errors.push(semanticError("/version_diff", "Prospect reports must use an initial version without a parent."));
    }
    if ((report.version_diff.entries ?? []).length) {
      errors.push(semanticError("/version_diff/entries", "Initial prospect reports must not contain version changes."));
    }
    if (firstPartySources.some((source) => source.connection_state !== "not_connected" || source.snapshot_id != null)) {
      errors.push(semanticError("/first_party_performance", "Prospect reports must not contain first-party snapshots."));
    }
    if (report.data_coverage.full_evidence_coverage) {
      errors.push(semanticError("/data_coverage/full_evidence_coverage", "Prospect reports cannot claim full evidence coverage."));
    }
  } else {
    if (parentReportId === null || report.version_diff.kind !== "upgrade" || report.version_diff.parent_report_id !== parentReportId) {
      errors.push(semanticError("/version_diff", "Verified reports must reference their parent report."));
    }
    if (!(report.version_diff.entries ?? []).length) {
      errors.push(semanticError("/version_diff/entries", "Verified reports require version changes."));
    }
    if (firstPartySources.some((source) => source.connection_state === "not_connected" || source.snapshot_id == null)) {
      errors.push(semanticError("/first_party_performance", "Verified reports require GSC, GBP, and GA4 snapshots."));
    }
    for (const [index, entry] of (report.version_diff.entries ?? []).entries()) {
      if (entry.change_type === "new" && entry.previous_finding != null) {
        errors.push(semanticError(`/version_diff/entries/${index}/previous_finding`, "New findings must not reference a previous finding."));
      }
      if (entry.change_type !== "new" && entry.previous_finding == null) {
        errors.push(semanticError(`/version_diff/entries/${index}/previous_finding`, "This change requires a previous finding reference."));
      }
      if (entry.previous_finding && entry.previous_finding.report_id !== parentReportId) {
        errors.push(semanticError(`/version_diff/entries/${index}/previous_finding/report_id`, "Previous findings must reference the parent report."));
      }
    }
  }

  if (
    report.data_coverage.full_evidence_coverage &&
    firstPartySources.some(
      (source) => source.health_status !== "healthy" || source.identity_match_status !== "matched",
    )
  ) {
    errors.push(semanticError("/data_coverage/full_evidence_coverage", "Full evidence coverage requires healthy, matched GSC, GBP, and GA4 sources."));
  }

  if (!sameJson(report.market_snapshot.queries.map(stripString), queries)) {
    errors.push(semanticError("/market_snapshot/queries", "Market queries must match the case context."));
  }
  if (!sameTargetMarket(report.market_snapshot.target_market, report.case_context.target_market)) {
    errors.push(semanticError("/market_snapshot/target_market", "Market target must match the case context."));
  }

  const competitorIds = report.competitor_analysis.competitors.map((competitor) => competitor.competitor_id);
  const competitorWebsites = report.competitor_analysis.competitors.map((competitor) => competitorWebsiteKey(competitor.website_url));
  if (competitorWebsites.some((website) => website === null)) {
    errors.push(semanticError("/competitor_analysis/competitors", "Competitor websites must be valid HTTP or HTTPS URLs."));
  }
  if (duplicates(competitorIds).length || duplicates(competitorWebsites.filter((website): website is string => website !== null)).length) {
    errors.push(semanticError("/competitor_analysis/competitors", "Competitors must have unique IDs and websites."));
  }

  const coverageSourceTypes = report.data_coverage.sources.map((source) => source.source_type);
  if (duplicates(coverageSourceTypes).length) {
    errors.push(semanticError("/data_coverage/sources", "Coverage source types must be unique."));
  }

  return errors;
}

export function validateReportV22(value: unknown): ReportV22ValidationResult {
  if (!validateStructure(value)) {
    return { ok: false, errors: structuralErrors(validateStructure.errors) };
  }
  const semanticErrors = validateSemantics(value);
  if (semanticErrors.length) return { ok: false, errors: semanticErrors };
  return { ok: true, report: value };
}
