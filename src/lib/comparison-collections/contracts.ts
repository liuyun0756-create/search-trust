import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/entry.schema.json";
import {sameImplementationJson} from "../implementation-records/contracts";
import type {Target} from "../comparison-checks/contracts";
import type {CollectionContext, CollectionSelection, CollectionView, ComparisonWindows} from "./types";
const ajv = new Ajv2020({strict: false, allErrors: false}); addFormats(ajv);
const validator = (name: string) => ajv.compile({$defs: schema.$defs, $ref: `#/$defs/${name}`});
const contextValid = validator("CollectionContext"), selectionValid = validator("CollectionSelection"), viewValid = validator("CollectionView");
const bound = (v: CollectionContext | CollectionView, t: Target) => v.case_id === t.caseId && v.report_id === t.reportId && v.delivery_revision_id === t.deliveryRevisionId;
function windowsValid(w: ComparisonWindows) {
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
  return w.timezone === "America/Los_Angeles" && day(w.before.end) - day(w.before.start) + 1 === w.days
    && day(w.after.end) - day(w.after.start) + 1 === w.days && day(w.before.end) + 1 === day(w.excluded.start)
    && day(w.excluded.end) + 1 === day(w.after.start) && day(w.excluded.end) >= day(w.excluded.start);
}
export function parseCollectionSelection(value: unknown): CollectionSelection | null {
  return selectionValid(value) ? value as CollectionSelection : null;
}
export function parseCollectionView(value: unknown, target: Target, id: string, selection?: CollectionSelection): CollectionView | null {
  if (!viewValid(value)) return null;
  const next = value as CollectionView;
  return bound(next, target) && next.id === id && windowsValid(next.windows) && next.windows.days === next.selection.days
    && ((next.status === "failed") === (next.error_code !== null))
    && (["failed", "succeeded"].includes(next.status) === (next.completed_at !== null))
    && (!selection || sameImplementationJson(selection, next.selection)) ? next : null;
}
export function parseCollectionContext(value: unknown, target: Target): CollectionContext | null {
  if (!contextValid(value)) return null;
  const next = value as CollectionContext;
  return bound(next, target) && new Set(next.jobs.map(j => j.id)).size === next.jobs.length
    && new Set(next.bindings.map(b => b.id)).size === next.bindings.length
    && next.jobs.every(j => parseCollectionView(j, target, j.id))
    && next.previews.every(p => windowsValid(p.windows) && p.days === p.windows.days) ? next : null;
}
