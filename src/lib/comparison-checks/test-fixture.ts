// Controlled test material only; never imported by production components.
import vectors from "../implementation-records/comparison-contracts/fixtures.json";
import type {ComparisonContext, ComparisonSelection, ComparisonView} from "./types";
import type {ImplementationRecord} from "../implementation-records/contracts";
export const record = vectors[0].request.implementation as ImplementationRecord;
export const target = {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id};
export const checkId = "b0000000-0000-4000-8000-000000000010";
export const selection = {implementation: vectors[0].result.implementation, action_id: vectors[0].request.action_id,
  days: vectors[0].request.days, scope: vectors[0].request.scope, before_snapshot_id: vectors[0].request.before.snapshot_id,
  after_snapshot_id: vectors[0].request.after.snapshot_id, concurrent_changes: "unknown"} as ComparisonSelection;
export const context: ComparisonContext = {schema_version: "v22_comparison_context_v1", case_id: record.case_id,
  report_id: record.report_id, delivery_revision_id: record.delivery_revision_id, implementation: selection.implementation, history: [],
  sources: [vectors[0].request.before, vectors[0].request.after].map((s, i) => ({id: s.snapshot_id, source: "gsc", resource: s.external_resource_id,
    coverage_start: s.coverage_start, coverage_end: s.coverage_end, fetched_at: s.fetched_at, expires_at: s.expires_at, current_eligible: i === 1}))};
export function resultView(name = "positive", id = checkId): ComparisonView {
  return {schema_version: "v22_comparison_view_v1", id, case_id: record.case_id, report_id: record.report_id,
    delivery_revision_id: record.delivery_revision_id, result: structuredClone(vectors.find(v => v.name === name)!.result) as ComparisonView["result"]};
}
