import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/entry.schema.json";
import {sameImplementationJson} from "../implementation-records/contracts";
import type {Target} from "../comparison-checks/contracts";
import type {Ga4CollectionContext, Ga4CollectionSelection, Ga4CollectionView, Ga4ComparisonScope, ComparisonWindows} from "./types";
const ajv = new Ajv2020({strict: false, allErrors: false}); addFormats(ajv);
const validator = (name: string) => ajv.compile({$defs: schema.$defs, $ref: `#/$defs/${name}`});
const contextValid = validator("Ga4CollectionContext"), selectionValid = validator("Ga4CollectionSelection"), viewValid = validator("Ga4CollectionView");
const bound = (v: Ga4CollectionContext | Ga4CollectionView, t: Target) => v.case_id === t.caseId && v.report_id === t.reportId && v.delivery_revision_id === t.deliveryRevisionId;
export const validLandingPath = (path: string | null) => path === null || (path.startsWith("/") && !path.startsWith("//") && !/[\x00-\x20?#\\]/.test(path) && path.length <= 2048);
function zoneValid(zone: string) {try {new Intl.DateTimeFormat("en", {timeZone: zone}); return true;} catch {return false;}}
function scopeValid(scope: Ga4ComparisonScope) {
  return zoneValid(scope.timezone) && validLandingPath(scope.landing_path)
    && scope.hosts.every(host => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) && !host.includes(".."))
    && sameImplementationJson(scope.hosts, [...new Set(scope.hosts)].sort());
}
function windowsValid(w: ComparisonWindows) {
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
  return zoneValid(w.timezone) && day(w.before.end) - day(w.before.start) + 1 === w.days
    && day(w.after.end) - day(w.after.start) + 1 === w.days && day(w.before.end) + 1 === day(w.excluded.start)
    && day(w.excluded.end) + 1 === day(w.after.start) && day(w.excluded.end) >= day(w.excluded.start);
}
export function parseGa4Selection(value: unknown): Ga4CollectionSelection | null {
  return selectionValid(value) && validLandingPath((value as Ga4CollectionSelection).landing_path) ? value as Ga4CollectionSelection : null;
}
export function parseGa4View(value: unknown, target: Target, id: string, selection?: Ga4CollectionSelection): Ga4CollectionView | null {
  if (!viewValid(value)) return null;
  const next = value as Ga4CollectionView, q = next.qualification;
  const expected = ["sessions", "engaged_sessions", "engagement_rate", "key_events", "session_key_event_rate"];
  if (q && (!expected.every(m => q.metrics.filter(item => item.metric === m).length === 1)
    || q.metrics.some(m => !m.reasons.includes("GA4_COMPLETENESS_NOT_ATTESTED")
      || (["key_events", "session_key_event_rate"].includes(m.metric) && !m.reasons.includes("GA4_EVENT_HISTORY_NOT_VERIFIED"))))) return null;
  return bound(next, target) && next.id === id && !!parseGa4Selection(next.selection) && scopeValid(next.scope)
    && windowsValid(next.windows) && next.windows.days === next.selection.days && next.windows.timezone === next.scope.timezone
    && next.scope.landing_path === next.selection.landing_path && ((next.status === "succeeded") === (q !== null))
    && ((next.status === "failed") === (next.error_code !== null))
    && (["failed", "succeeded"].includes(next.status) === (next.completed_at !== null))
    && (!next.completed_at || Date.parse(next.completed_at) >= Date.parse(next.created_at))
    && (!selection || sameImplementationJson(selection, next.selection)) ? next : null;
}
export function parseGa4Context(value: unknown, target: Target): Ga4CollectionContext | null {
  if (!contextValid(value)) return null;
  const next = value as Ga4CollectionContext;
  return bound(next, target) && new Set(next.jobs.map(j => j.id)).size === next.jobs.length
    && new Set(next.bindings.map(b => b.binding_id)).size === next.bindings.length
    && new Set(next.previews.map(p => `${p.binding_id}:${p.action_id}:${p.days}`)).size === next.previews.length
    && next.bindings.every(b => scopeValid(b.scope) && b.scope.landing_path === null)
    && next.jobs.every(j => parseGa4View(j, target, j.id))
    && (!next.bindings.length || next.implementation !== null)
    && next.previews.every(p => windowsValid(p.windows) && p.days === p.windows.days
      && next.bindings.some(b => b.binding_id === p.binding_id && b.scope.timezone === p.windows.timezone)) ? next : null;
}
