// Synthetic test projections; never imported by the application.
import {record, target, selection, resultView} from "../comparison-checks/test-fixture";
import vectors from "../comparison-checks/ga4-collection-contracts/fixtures.json";
import type {Ga4CollectionContext, Ga4CollectionSelection, Ga4CollectionView, Ga4Qualification} from "./types";
export const ga4Id = "d0000000-0000-4000-8000-000000000001";
export const ga4Choice: Ga4CollectionSelection = {implementation: selection.implementation, action_id: selection.action_id,
  days: 28, binding_id: "d0000000-0000-4000-8000-000000000002", scope_snapshot_id: "d0000000-0000-4000-8000-000000000003", landing_path: null};
export const ga4Context: Ga4CollectionContext = {schema_version: "v22_ga4_collection_context_v1", case_id: target.caseId,
  report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId, implementation: ga4Choice.implementation,
  bindings: [{binding_id: ga4Choice.binding_id, scope_snapshot_id: ga4Choice.scope_snapshot_id, observed_at: "2026-10-22T10:00:00Z",
    scope: {resource_id: "properties/12345", hosts: ["example.test"], timezone: "America/Los_Angeles", channel: "organic_search", landing_path: null}}],
  jobs: [], previews: [{binding_id: ga4Choice.binding_id, action_id: ga4Choice.action_id, days: 28, windows: resultView().result.windows, elapsed: true}]};
export function ga4View(id = ga4Id, status: Ga4CollectionView["status"] = "queued", choice = ga4Choice): Ga4CollectionView {
  return {schema_version: "v22_ga4_collection_view_v1", id, case_id: record.case_id, report_id: record.report_id,
    delivery_revision_id: record.delivery_revision_id, selection: choice, windows: resultView().result.windows,
    scope: {...ga4Context.bindings[0].scope, landing_path: choice.landing_path}, status, created_at: "2026-10-22T10:00:00Z",
    completed_at: ["failed", "succeeded"].includes(status) ? "2026-10-22T10:01:00Z" : null,
    error_code: status === "failed" ? "SYNC_INTERRUPTED" : null,
    qualification: status === "succeeded" ? vectors.find(v => v.name === "observed_not_final")!.collection.qualification as Ga4Qualification : null};
}
