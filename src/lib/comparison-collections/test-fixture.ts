// Synthetic test metadata only, never imported by production components.
import {record, target, selection, resultView} from "../comparison-checks/test-fixture";
import type {CollectionContext, CollectionSelection, CollectionView} from "./types";
export const collectionId = "c0000000-0000-4000-8000-000000000001";
export const choice: CollectionSelection = {implementation: selection.implementation, action_id: selection.action_id,
  days: 28, binding_id: "c0000000-0000-4000-8000-000000000002"};
export const collectionContext: CollectionContext = {schema_version: "v22_collection_context_v1",
  case_id: target.caseId, report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId,
  implementation: choice.implementation, bindings: [{id: choice.binding_id, resource: "sc-domain:example.test"}], jobs: [],
  previews: [{action_id: choice.action_id, days: 28, windows: resultView().result.windows, elapsed: true}]};
export function collectionView(id = collectionId, status: CollectionView["status"] = "queued"): CollectionView {
  return {schema_version: "v22_collection_view_v1", id, case_id: record.case_id, report_id: record.report_id,
    delivery_revision_id: record.delivery_revision_id, selection: choice, windows: resultView().result.windows,
    resource: "sc-domain:example.test", status, created_at: "2026-10-22T10:00:00Z",
    completed_at: ["failed", "succeeded"].includes(status) ? "2026-10-22T10:01:00Z" : null,
    error_code: status === "failed" ? "SYNC_INTERRUPTED" : null};
}
