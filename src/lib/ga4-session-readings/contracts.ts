import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/reading.schema.json";
import type {Ga4SessionReading} from "./types";
import type {Target} from "../comparison-checks/contracts";
import type {Ga4CollectionView} from "../ga4-comparison-collections/types";
import {validLandingPath} from "../ga4-comparison-collections/contracts";
import {sameImplementationJson} from "../implementation-records/contracts";

const ajv = new Ajv2020({strict: false, allErrors: false}); addFormats(ajv);
const valid = ajv.compile(schema);
// Verify decimal arithmetic using integers, including halfway rounding and large counts.
export function relativePercent(before: number, after: number): string | null {
  if (before === 0) return null;
  const zero = BigInt(0), hundred = BigInt(100);
  const delta = BigInt(after) - BigInt(before), magnitude = delta < zero ? -delta : delta;
  const numerator = magnitude * BigInt(10000), divisor = BigInt(before);
  const rounded = numerator / divisor + (BigInt(2) * (numerator % divisor) >= divisor ? BigInt(1) : zero);
  return `${delta < zero && rounded > zero ? "-" : ""}${rounded / hundred}.${String(rounded % hundred).padStart(2, "0")}`;
}
export function parseSessionReading(raw: unknown, target: Target, collectionId: string, job?: Ga4CollectionView): Ga4SessionReading | null {
  if (!valid(raw)) return null;
  const r = raw as unknown as Ga4SessionReading, w = r.windows, s = r.scope;
  if (r.case_id !== target.caseId || r.report_id !== target.reportId || r.delivery_revision_id !== target.deliveryRevisionId
    || r.collection_id !== collectionId || s.timezone !== w.timezone || !validLandingPath(s.landing_path)
    || !sameImplementationJson(s.hosts, [...new Set(s.hosts)].sort())
    || s.hosts.some(h => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h) || h.includes(".."))
    || new Set(r.reasons).size !== r.reasons.length || Date.parse(r.started_at) > Date.parse(r.completed_at)) return null;
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
  if (day(w.before.end)-day(w.before.start)+1 !== w.days || day(w.after.end)-day(w.after.start)+1 !== w.days
    || day(w.before.end)+1 !== day(w.excluded.start) || day(w.excluded.end)+1 !== day(w.after.start)
    || w.excluded.start > w.excluded.end) return null;
  try {
    const parts = new Intl.DateTimeFormat("en", {timeZone: s.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date(r.started_at));
    const value = (type: string) => parts.find(p => p.type === type)!.value;
    if (r.state === "available" && `${value("year")}-${value("month")}-${value("day")}` <= w.after.end) return null;
  } catch {return null;}
  if (r.state === "withheld") {
    if (!r.reasons.length || [r.before, r.after, r.difference, r.relative_change_percent].some(n => n !== null)) return null;
  } else if (r.reasons.length || r.before === null || r.after === null
    || !Number.isSafeInteger(r.before) || !Number.isSafeInteger(r.after) || !Number.isSafeInteger(r.difference)
    || r.difference !== r.after-r.before || r.relative_change_percent !== relativePercent(r.before, r.after)) return null;
  if (job && (job.status !== "succeeded" || r.observation_checksum !== job.qualification?.observation_checksum
    || r.action_id !== job.selection.action_id || !sameImplementationJson(r.implementation, job.selection.implementation)
    || !sameImplementationJson(s, job.scope) || !sameImplementationJson(w, job.windows)
    || Date.parse(r.completed_at) > Date.parse(job.completed_at!))) return null;
  return r;
}
