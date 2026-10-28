/** Plain, closed DTOs. Scope is descriptive text, never a URL to fetch. */
export type ImplementationEntry = {
  action_id: string;
  scope: string;
  implemented_on: string;
  timezone: string;
  note: string | null;
  responsible: string | null;
};
export type ImplementationSource = {
  userId: string; caseId: string; reportId: string; reportChecksum: string;
  deliveryRevisionId: string; deliveryRevision: number;
  actions: {id: string; title: string; target: string}[];
};
export type ImplementationRecord = {
  schema_version: "v22_implementation_record_v1";
  id: string; user_id: string; case_id: string; report_id: string; report_checksum: string;
  delivery_revision_id: string; delivery_revision: number; revision: number;
  recorded_at: string; entries: ImplementationEntry[]; checksum: string;
};
export type ImplementationView = {source: ImplementationSource; history: ImplementationRecord[]};
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const digest = (v: unknown) => typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === [...keys].sort().join();
/** JSON object key order changes through jsonb/PostgREST; content does not. */
export function sameImplementationJson(a: unknown, b: unknown): boolean {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}
const text = (v: unknown, max: number): v is string => typeof v === "string" && /\S/.test(v) && v.length <= max && !v.includes("\u0000");
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) < 2147483647;
export function localDate(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(at);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
export function parseEntries(value: unknown, source: ImplementationSource, at: Date): ImplementationEntry[] | null {
  if (!Array.isArray(value) || value.length > 3 || new Set(value.map(v => v?.action_id)).size !== value.length) return null;
  for (const entry of value) {
    if (!object(entry) || !exact(entry, ["action_id", "scope", "implemented_on", "timezone", "note", "responsible"])
      || !source.actions.some(a => a.id === entry.action_id) || !text(entry.scope, 2000)
      || typeof entry.implemented_on !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(entry.implemented_on)
      || !Number.isFinite(Date.parse(`${entry.implemented_on}T00:00:00Z`))
      || new Date(`${entry.implemented_on}T00:00:00Z`).toISOString().slice(0, 10) !== entry.implemented_on
      || typeof entry.timezone !== "string" || !/^(UTC|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+)$/.test(entry.timezone) || entry.timezone.length > 100
      || !(entry.note === null || text(entry.note, 2000)) || !(entry.responsible === null || text(entry.responsible, 200))) return null;
    try { if (entry.implemented_on > localDate(at, entry.timezone)) return null; } catch { return null; }
  }
  return structuredClone(value) as ImplementationEntry[];
}
export function parseImplementationRecord(value: unknown, source: ImplementationSource): ImplementationRecord | null {
  if (!object(value) || !exact(value, ["schema_version", "id", "user_id", "case_id", "report_id", "report_checksum", "delivery_revision_id", "delivery_revision", "revision", "recorded_at", "entries", "checksum"])
    || value.schema_version !== "v22_implementation_record_v1" || !uuid(value.id) || value.user_id !== source.userId
    || value.case_id !== source.caseId || value.report_id !== source.reportId || value.report_checksum !== source.reportChecksum
    || value.delivery_revision_id !== source.deliveryRevisionId || value.delivery_revision !== source.deliveryRevision
    || !integer(value.revision) || !digest(value.checksum) || typeof value.recorded_at !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value.recorded_at) || !Number.isFinite(Date.parse(value.recorded_at))
    || new Date(value.recorded_at).getUTCFullYear() < 1 || new Date(value.recorded_at).toISOString().slice(0, 19) !== value.recorded_at.slice(0, 19)) return null;
  const entries = parseEntries(value.entries, source, new Date(value.recorded_at));
  return entries ? structuredClone(value) as ImplementationRecord : null;
}
export function parseImplementationView(value: unknown, caseId: string, reportId: string, revisionId: string): ImplementationView | null {
  if (!object(value) || !exact(value, ["source", "history"]) || !object(value.source)) return null;
  const s = value.source;
  if (!exact(s, ["userId", "caseId", "reportId", "reportChecksum", "deliveryRevisionId", "deliveryRevision", "actions"])
    || !uuid(s.userId) || s.caseId !== caseId || !uuid(caseId) || s.reportId !== reportId || !uuid(reportId)
    || s.deliveryRevisionId !== revisionId || !uuid(revisionId) || !digest(s.reportChecksum) || !integer(s.deliveryRevision)
    || !Array.isArray(s.actions) || s.actions.length > 3 || s.actions.some(a => !object(a) || !exact(a, ["id", "title", "target"]) || !text(a.id, 200) || !text(a.title, 2000) || !text(a.target, 2000))
    || new Set(s.actions.map(a => a.id)).size !== s.actions.length || !Array.isArray(value.history) || value.history.length > 20) return null;
  const source = s as ImplementationSource;
  const history = value.history.map(row => parseImplementationRecord(row, source));
  if (history.some(row => !row)) return null;
  const rows = history as ImplementationRecord[];
  if (rows.some((row, i) => i > 0 && (row.id !== rows[0].id || row.revision !== rows[i - 1].revision - 1 || Date.parse(row.recorded_at) > Date.parse(rows[i - 1].recorded_at)))) return null;
  return {source: structuredClone(source), history: rows};
}
