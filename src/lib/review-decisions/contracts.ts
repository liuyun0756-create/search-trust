import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/workspace.schema.json";
import {
  parseResponse as parseEvidence,
  same,
} from "../review-workspace/contracts";
import type {
  Command,
  Context,
  Decision,
  History,
  Revision,
  SaveDecision,
  Result,
} from "./types";
import { byteSize } from "./json";

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validator = (name: string) =>
  ajv.compile({ $defs: schema.$defs, $ref: `#/$defs/${name}` });
const commandValid = ajv.compile({
  $defs: schema.$defs,
  ...schema.properties.command,
});
const contextValid = validator("DecisionContext"),
  revisionValid = validator("DecisionRevision"),
  historyValid = validator("DecisionHistory"),
  saveValid = validator("SaveDecision");
const plain = (v: string | null) =>
  v === null ||
  (!!v.trim() && !/[\u0000-\u0008\u000b-\u001f\u007f\ud800-\udfff]/u.test(v));
export function decisionShape(d: Decision) {
  const edited = d.disposition === "adjust" || d.disposition === "new";
  return (
    [
      d.action_id,
      d.reason,
      d.target,
      d.work,
      d.completion_statement,
      d.reconsider_when,
    ].every(plain) &&
    new Set(d.references).size === d.references.length &&
    (edited
      ? d.target !== null && d.work !== null && d.references.length > 0
      : d.target === null && d.work === null) &&
    (d.disposition === "observe") === (d.completion_statement !== null) &&
    (d.disposition === "defer") === (d.reconsider_when !== null)
  );
}
export function parseSave(raw: unknown): SaveDecision | null {
  if (!saveValid(raw) || byteSize(raw) > 65536) return null;
  const s = raw as SaveDecision;
  return (s.previous_id === null) === (s.previous_checksum === null) &&
    s.previous_id !== s.id &&
    new Set(s.decisions.map((d) => d.action_id)).size === s.decisions.length &&
    s.decisions.every(decisionShape) &&
    s.decisions.filter((d) => d.disposition !== "defer").length <= 3
    ? s
    : null;
}
export function parseCommand(raw: unknown): Command | null {
  if (!commandValid(raw) || byteSize(raw) > 73728) return null;
  const c = raw as Command;
  return c.operation !== "save" || parseSave(c.request) ? c : null;
}
export function requestOf(r: Revision): SaveDecision {
  return {
    id: r.id,
    review_id: r.review_id,
    previous_id: r.previous_id,
    previous_checksum: r.previous_checksum,
    decisions: r.decisions,
  };
}
export function allowedReferences(c: Context, actionId?: string) {
  return c.references.filter((r) => !actionId || r.action_id === actionId);
}
export function boundDecisions(ds: Decision[], c: Context) {
  const original = c.approved.map((a) => a.action_id);
  return ds.every((d) => {
    const isNew = d.disposition === "new";
    const allowed = allowedReferences(c, isNew ? undefined : d.action_id).map(
      (r) => r.id,
    );
    return (
      isNew !== original.includes(d.action_id) &&
      d.references.every((r) => allowed.includes(r)) &&
      (d.disposition !== "observe" ||
        c.evidence.actions.find((a) => a.action_id === d.action_id)
          ?.recorded_work.state === "seo_recorded")
    );
  });
}
export function parseResponse(raw: unknown, c: Command): Result | null {
  const reviewId = c.operation === "save" ? c.request.review_id : c.review_id;
  if (c.operation === "context") {
    if (!contextValid(raw) || byteSize(raw) > 524288) return null;
    const v = raw as Context,
      e = v.evidence;
    if (
      !parseEvidence(e, { ...c, operation: "read" }) ||
      !same(
        v.approved.map((a) => a.action_id),
        e.actions.map((a) => a.action_id),
      ) ||
      v.approved.some(
        (a, i) =>
          a.title !== e.actions[i].title || a.target !== e.actions[i].target,
      )
    )
      return null;
    const expected = e.actions
      .flatMap((a, i) => {
        const s = e.selection.actions[i];
        const ids = [
          a.recorded_work.state === "seo_recorded"
            ? `implementation:${e.selection.implementation.id}:${a.action_id}`
            : null,
          s.page_current_id ? `page:${s.page_current_id}` : null,
          s.page_previous_id ? `page:${s.page_previous_id}` : null,
          s.gsc_id ? `gsc:${s.gsc_id}` : null,
          s.ga4_id ? `ga4:${s.ga4_id}` : null,
        ];
        return ids
          .filter((x): x is string => !!x)
          .map((id) => `${a.action_id}|${id}`);
      })
      .sort();
    if (
      !same(
        expected,
        v.references.map((r) => `${r.action_id}|${r.id}`).sort(),
      ) ||
      v.references.some((r) => !r.id.startsWith(r.kind + ":"))
    )
      return null;
    return v;
  }
  if (c.operation === "history") {
    if (!historyValid(raw) || byteSize(raw) > 32768) return null;
    const h = raw as History;
    if (
      h.review_id !== reviewId ||
      h.report_id !== c.report_id ||
      new Set(h.items.map((x) => x.id)).size !== h.items.length
    )
      return null;
    for (let i = 0; i < h.items.length; i++) {
      const x = h.items[i],
        next = h.items[i + 1];
      if (
        (x.revision === 1) !== (x.previous_id === null) ||
        x.previous_id === x.id ||
        (c.cursor && x.revision >= c.cursor) ||
        (next &&
          (x.revision !== next.revision + 1 || x.previous_id !== next.id))
      )
        return null;
    }
    const last = h.items.at(-1);
    if (last && h.items.length < 20 && last.revision !== 1) return null;
    if (
      h.next_cursor !==
      (h.items.length === 20 && last!.revision > 1 ? last!.revision : null)
    )
      return null;
    return h;
  }
  if (!revisionValid(raw) || byteSize(raw) > 131072) return null;
  const r = raw as Revision;
  if (
    !parseSave(requestOf(r)) ||
    r.user_id !== c.user_id ||
    r.case_id !== c.case_id ||
    r.report_id !== c.report_id ||
    r.review_id !== reviewId ||
    (r.revision === 1) !== (r.previous_id === null) ||
    (c.operation === "read" && r.id !== c.decision_id)
  )
    return null;
  if (c.operation === "save") {
    // Service normalizes original action order and reference order only.
    const norm = (s: SaveDecision) => ({
      ...s,
      decisions: s.decisions
        .map((d) => ({ ...d, references: [...d.references].sort() }))
        .sort((a, b) => a.action_id.localeCompare(b.action_id)),
    });
    if (!same(norm(requestOf(r)), norm(c.request))) return null;
  }
  return r;
}
export function revisionFits(r: Revision, c: Context) {
  return (
    r.review_id === c.evidence.review_id &&
    r.report_id === c.evidence.report_id &&
    r.case_id === c.evidence.case_id &&
    r.evidence_checksum === c.evidence_checksum &&
    r.bundle_checksum === c.bundle_checksum &&
    Date.parse(r.recorded_at) >=
      Math.max(
        Date.parse(c.evidence.frozen_at!),
        Date.parse(c.evidence.evaluated_at),
      ) &&
    boundDecisions(r.decisions, c)
  );
}
export async function verifyHashes(r: Revision) {
  const canonical = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(canonical).join(",")}]`
      : v && typeof v === "object"
        ? `{${Object.keys(v)
            .sort()
            .map(
              (k) =>
                `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`,
            )
            .join(",")}}`
        : JSON.stringify(v);
  const hash = async (v: unknown) =>
    "sha256:" +
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonical(v)),
        ),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  const { checksum, ...rest } = r;
  return (
    checksum === (await hash(rest)) &&
    r.request_checksum === (await hash(requestOf(r)))
  );
}
