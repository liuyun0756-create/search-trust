import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/entry.schema.json";
import {sameImplementationJson} from "../implementation-records/contracts";
import type {PageCheckContext, PageCheckHistory, PageCheckLimits, PageCheckRateResponse, PageCheckSelection, PageCheckView} from "./types";

export type PageCheckTarget = {caseId: string; reportId: string; deliveryRevisionId: string};
const ajv = new Ajv2020({strict: false, allErrors: false}); addFormats(ajv);
const validator = (name: string) => ajv.compile({$defs: schema.$defs, $ref: `#/$defs/${name}`});
const contextValid = validator("PageCheckContext"), selectionValid = validator("PageCheckSelection"), viewValid = validator("PageCheckView"), rateValid = validator("PageCheckRateResponse");
const clean = (value: string) => !!value.trim() && !/\p{C}/u.test(value);
const bound = (v: PageCheckContext | PageCheckHistory, t: PageCheckTarget) => v.case_id === t.caseId && v.report_id === t.reportId && v.delivery_revision_id === t.deliveryRevisionId;

export function validPageUrl(value: string, site?: string) {
  try {
    if (!clean(value) || value.length > 2000 || /[\s?\\]/u.test(value) || /%(?![0-9a-f]{2})/i.test(value)) return false;
    const decoded = decodeURIComponent(value), url = new URL(value);
    return !/[\\\p{C}]/u.test(decoded) && url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.href === value && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(url.hostname)
      && (!site || url.hostname === new URL(site).hostname);
  } catch {return false;}
}
function validLimits(l: PageCheckLimits) {
  const now = Date.parse(l.server_time), next = Date.parse(l.next_request_at), wait = next > now;
  return next >= now && !(l.used === 0 && wait) && !(l.used >= 10 && !wait)
    && l.reason === (l.active ? "active" : l.used >= 10 ? "quota" : wait ? "cooldown" : null);
}
function validHistory(v: PageCheckHistory, target: PageCheckTarget) {
  return bound(v, target) && (["completed", "failed"].includes(v.status) === (v.completed_at !== null))
    && ((v.status === "failed") === (v.error_code !== null))
    && (!v.completed_at || Date.parse(v.completed_at) >= Date.parse(v.created_at));
}
export function parsePageSelection(value: unknown, site?: string): PageCheckSelection | null {
  if (!selectionValid(value)) return null;
  const s = value as PageCheckSelection;
  return clean(s.action_id) && validPageUrl(s.target_url, site) && new Set(s.conditions.map(c => c.id)).size === s.conditions.length
    && s.conditions.every(c => clean(c.value) && c.value.length <= ({text_present: 200, anchor_present: 128, link_present: 2000}[c.kind])
      && (c.kind !== "link_present" || validPageUrl(c.value, site ?? s.target_url)))
    && new TextEncoder().encode(JSON.stringify(s)).length <= 20480 ? s : null;
}
export function parsePageContext(value: unknown, target: PageCheckTarget): PageCheckContext | null {
  if (!contextValid(value)) return null;
  const c = value as PageCheckContext;
  const root = validPageUrl(c.site_url) && new URL(c.site_url).pathname === "/" && !new URL(c.site_url).hash;
  return bound(c, target) && root && validLimits(c.limits)
    && new Set(c.history.map(h => h.id)).size === c.history.length && c.history.every(h => validHistory(h, target))
    && new Set(c.actions.map(a => a.id)).size === c.actions.length && c.actions.every(a => clean(a.id) && clean(a.title))
    && ((c.implementation === null) === (c.eligibility === "no_record"))
    && (c.eligibility === "eligible" || c.eligibility === "source_changed" ? c.actions.length > 0 : c.actions.length === 0) ? c : null;
}
export function parsePageView(value: unknown, target: PageCheckTarget, id: string, selection?: PageCheckSelection): PageCheckView | null {
  if (!viewValid(value)) return null;
  const v = value as PageCheckView, o = v.observation;
  if (!validHistory(v, target) || v.id !== id || !validPageUrl(v.site_url) || !parsePageSelection(v.selection, v.site_url)
    || selection && !sameImplementationJson(v.selection, selection) || (v.status === "completed") !== (o !== null)) return null;
  if (o && (Date.parse(o.observed_at) < Date.parse(v.created_at) || Date.parse(o.observed_at) > Date.parse(v.completed_at!)
    || (o.status === "checked") !== (o.failure === null) || !sameImplementationJson(o.results.map(r => r.condition_id), v.selection.conditions.map(c => c.id))
    || o.results.some(r => (r.state === "unable_to_check") !== (o.status === "unable_to_check")))) return null;
  return v;
}
export function parsePageRate(value: unknown): PageCheckRateResponse | null {
  if (!rateValid(value)) return null;
  const v = value as PageCheckRateResponse;
  return v.limits.reason !== null && validLimits(v.limits) ? v : null;
}
