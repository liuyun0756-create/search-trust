import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/review.schema.json";
import {sameImplementationJson} from "../implementation-records/contracts";
import type {Target} from "../comparison-checks/contracts";
import type {Ga4ReviewInput, Ga4ReviewView, SeoChecks} from "./types";

const ajv = new Ajv2020({strict: false, allErrors: false}); addFormats(ajv);
const compile = (name: string) => ajv.compile({$defs: schema.$defs, $ref: `#/$defs/${name}`});
const inputValid = compile("Ga4ReviewInput"), viewValid = compile("Ga4ReviewView");
export const checkKeys = ["date_coverage", "event_history", "measurement_setup"] as const;
export function validChecks(checks: SeoChecks) {
  return checkKeys.every(k => !/[\x00-\x08\x0b-\x1f\x7f]/.test(checks[k].note)
    && (checks[k].status === "not_checked" || !!checks[k].note.trim()));
}
export function parseReviewInput(value: unknown): Ga4ReviewInput | null {
  return inputValid(value) && validChecks((value as Ga4ReviewInput).checks) ? value as Ga4ReviewInput : null;
}
export function parseReviewView(value: unknown, target: Target, collectionId: string, input?: Ga4ReviewInput): Ga4ReviewView | null {
  if (!viewValid(value)) return null;
  const v = value as Ga4ReviewView, a = v.audit;
  if (v.case_id !== target.caseId || v.report_id !== target.reportId || v.delivery_revision_id !== target.deliveryRevisionId
    || a.collection_id !== collectionId) return null;
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
  const zones = [a.scope.timezone, a.windows.timezone];
  try {for (const zone of zones) new Intl.DateTimeFormat("en", {timeZone: zone});} catch {return null;}
  if (zones[0] !== zones[1] || a.coverage.map(c => c.period).join() !== "previous,current"
    || a.views.map(c => `${c.period}:${c.view}`).join() !== "previous:totals,previous:dates,previous:key_events,current:totals,current:dates,current:key_events"
    || a.configuration_changes.length !== Math.min(30, a.configuration_change_count)
    || new Set(a.configuration_changes.map(c => c.event_name)).size !== a.configuration_changes.length
    || Date.parse(a.configuration_before_at) > Date.parse(a.configuration_after_at) || Date.parse(a.configuration_after_at) > Date.parse(a.observed_at)) return null;
  for (const c of a.coverage) {
    const w = c.period === "previous" ? a.windows.before : a.windows.after;
    if (c.expected_dates !== a.windows.days || day(w.end) - day(w.start) + 1 !== c.expected_dates
      || c.returned_dates + c.missing_dates.length !== c.expected_dates
      || !sameImplementationJson(c.missing_dates, [...new Set(c.missing_dates)].sort())
      || c.missing_dates.some(d => d < w.start || d > w.end)) return null;
  }
  if (a.views.some(c => c.truncation_capture === "not_captured" && c.truncation_reasons.length > 0)) return null;
  const all = [...v.reviews, ...(v.saved ? [v.saved] : [])];
  if (all.some(r => r.case_id !== target.caseId || r.report_id !== target.reportId || r.delivery_revision_id !== target.deliveryRevisionId
    || r.collection_id !== collectionId || r.observation_checksum !== a.observation_checksum || !validChecks(r.checks)
    || Date.parse(r.recorded_at) < Date.parse(a.observed_at))) return null;
  if (v.reviews.length && (v.reviews.length !== Math.min(20, v.reviews[0].revision)
    || v.reviews.some((r, i) => r.revision !== v.reviews[0].revision - i || (i > 0 && Date.parse(r.recorded_at) > Date.parse(v.reviews[i-1].recorded_at)))
    || new Set(v.reviews.map(r => r.request_id)).size !== v.reviews.length)) return null;
  if (input ? !v.saved || v.saved.request_id !== input.request_id || v.saved.revision !== input.expected_revision+1
    || v.saved.observation_checksum !== input.observation_checksum || !sameImplementationJson(v.saved.checks, input.checks) : v.saved !== null) return null;
  if (v.saved && (!v.reviews.length || v.saved.revision > v.reviews[0].revision
    || (v.saved.revision >= v.reviews.at(-1)!.revision && !v.reviews.some(r => sameImplementationJson(r, v.saved))))) return null;
  return v;
}
