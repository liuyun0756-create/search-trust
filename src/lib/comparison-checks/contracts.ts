import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/entry.schema.json";
import {sameImplementationJson} from "../implementation-records/contracts";
import type {ComparisonContext, ComparisonSelection, ComparisonView} from "./types";
import {metricArithmeticValid} from "./metric-reading";

const ajv = new Ajv2020({strict: false, allErrors: false});
addFormats(ajv);
const validator = (name: string) => ajv.compile({$defs: schema.$defs, $ref: `#/$defs/${name}`});
const contextValid = validator("ComparisonContext"), selectionValid = validator("ComparisonSelection"), viewValid = validator("ComparisonView");
export type Target = {caseId: string; reportId: string; deliveryRevisionId: string};
function bound(value: ComparisonContext | ComparisonView, target: Target) {
  return value.case_id === target.caseId && value.report_id === target.reportId && value.delivery_revision_id === target.deliveryRevisionId;
}
export function parseSelection(value: unknown): ComparisonSelection | null {
  if (!selectionValid(value)) return null;
  const next = value as ComparisonSelection, s = next.scope;
  if ((s.dimension === "property") !== (s.key === null) || (s.source === "gsc" && s.channel !== "organic_search")) return null;
  return next;
}
export function parseContext(value: unknown, target: Target): ComparisonContext | null {
  if (!contextValid(value)) return null;
  const next = value as ComparisonContext;
  return bound(next, target) && new Set(next.sources.map(s => s.id)).size === next.sources.length
    && new Set(next.history.map(s => s.id)).size === next.history.length ? next : null;
}
export function parseView(value: unknown, target: Target, id: string, selection?: ComparisonSelection): ComparisonView | null {
  if (!viewValid(value)) return null;
  const next = value as ComparisonView, r = next.result;
  if (!bound(next, target) || next.id !== id || !metricArithmeticValid(r)) return null;
  if (r.state === "comparable" && (r.scope.source !== "gsc" || !r.before_source || !r.after_source
    || r.metrics.map(m => m.metric).join() !== "clicks,impressions,ctr"
    || r.before_source.used_through !== r.windows.before.end || r.after_source.used_through !== r.windows.after.end)) return null;
  if (selection && (!sameImplementationJson(r.implementation, selection.implementation) || r.action_id !== selection.action_id
    || r.windows.days !== selection.days || !sameImplementationJson(r.scope, selection.scope)
    || (r.before_source?.snapshot_id ?? null) !== selection.before_snapshot_id || (r.after_source?.snapshot_id ?? null) !== selection.after_snapshot_id)) return null;
  return next;
}
