import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/workspace.schema.json";
import { sameImplementationJson } from "../implementation-records/contracts";
import type {
  Command,
  Directory,
  ReviewFreezeSelection,
  WorkspaceView,
} from "./types";

const ajv = new Ajv2020({ strict: false, allErrors: false });
addFormats(ajv);
const validator = (name: string) =>
  ajv.compile({ $defs: schema.$defs, $ref: `#/$defs/${name}` });
const commandValid = ajv.compile({
  $defs: schema.$defs,
  ...schema.properties.command,
});
const viewValid = validator("WorkspaceView"),
  directoryValid = validator("Directory"),
  selectionValid = validator("ReviewFreezeSelection");
export const same = sameImplementationJson;
export function parseSelection(raw: unknown): ReviewFreezeSelection | null {
  if (
    !selectionValid(raw) ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 32768
  )
    return null;
  const s = raw as ReviewFreezeSelection;
  if (
    new Set(s.actions.map((a) => a.action_id)).size !== s.actions.length ||
    s.actions.some((a) => a.page_previous_id && !a.page_current_id)
  )
    return null;
  return s;
}
export function parseCommand(raw: unknown): Command | null {
  if (!commandValid(raw)) return null;
  const c = raw as Command;
  if (
    "selection" in c &&
    (!parseSelection(c.selection) || c.selection.report.id !== c.report_id)
  )
    return null;
  if (c.operation === "candidates") {
    if (
      !["page", "gsc", "ga4"].includes(c.kind) ||
      !c.target ||
      !c.action_id ||
      c.delivery_id
    )
      return null;
  } else if (c.operation === "history") {
    if (c.kind !== "history" || c.target || c.action_id || c.delivery_id)
      return null;
  } else if (c.operation === "versions") {
    if (
      !["deliveries", "implementations"].includes(c.kind) ||
      c.target ||
      c.action_id ||
      (c.kind === "implementations") !== !!c.delivery_id
    )
      return null;
  }
  return c;
}
export function parseResponse(
  raw: unknown,
  c: Command,
): WorkspaceView | Directory | null {
  if (["candidates", "history", "versions"].includes(c.operation)) {
    if (!directoryValid(raw) || !("kind" in c)) return null;
    const d = raw as Directory;
    if (
      d.case_id !== c.case_id ||
      d.report_id !== c.report_id ||
      d.kind !== c.kind ||
      new Set(d.items.map((i) => `${i.id}:${i.revision}`)).size !==
        d.items.length
    )
      return null;
    const target = "target" in c ? c.target : null,
      delivery =
        target?.delivery_id ?? ("delivery_id" in c ? c.delivery_id : null);
    if (delivery && d.items.some((i) => i.delivery_id !== delivery))
      return null;
    if (d.next_cursor) {
      const last = d.items.at(-1);
      if (
        d.items.length !== 20 ||
        !last ||
        !same(d.next_cursor, {
          at: last.at,
          id: last.id,
          revision: last.revision,
        })
      )
        return null;
    }
    return d;
  }
  if (!viewValid(raw)) return null;
  const v = raw as WorkspaceView,
    s = parseSelection(v.selection);
  const state =
    c.operation === "read" || c.operation === "save" ? "saved" : c.operation;
  if (
    !s ||
    v.case_id !== c.case_id ||
    v.report_id !== c.report_id ||
    v.state !== state ||
    s.report.id !== c.report_id ||
    !same(
      v.actions.map((a) => a.action_id),
      s.actions.map((a) => a.action_id),
    )
  )
    return null;
  if (
    (v.state === "preview") !== !!v.confirmation_fingerprint ||
    (v.state === "saved") !== !!v.review_id ||
    (v.state === "saved") !== !!v.frozen_at
  )
    return null;
  if ("review_id" in c && v.review_id !== c.review_id) return null;
  if ("selection" in c && !same(s, c.selection)) return null;
  if (
    "target" in c &&
    c.target &&
    (s.delivery.id !== c.target.delivery_id ||
      s.implementation.id !== c.target.implementation_id ||
      s.implementation.revision !== c.target.implementation_revision)
  )
    return null;
  if (
    c.operation === "context" &&
    s.actions.some(
      (a) => a.page_current_id || a.page_previous_id || a.gsc_id || a.ga4_id,
    )
  )
    return null;
  if (c.operation === "source") {
    const key =
      c.kind === "page"
        ? "page_current_id"
        : c.kind === "gsc"
          ? "gsc_id"
          : "ga4_id";
    if (
      !s.actions.some(
        (a) => a.action_id === c.action_id && a[key] === c.source_id,
      ) ||
      s.actions.some((a) =>
        ["page_current_id", "page_previous_id", "gsc_id", "ga4_id"].some(
          (k) =>
            a[k as keyof typeof a] !== null &&
            (a.action_id !== c.action_id || k !== key),
        ),
      )
    )
      return null;
  }
  if (
    v.actions.some(
      (a, i) =>
        !!a.page !== !!s.actions[i].page_current_id ||
        !!a.gsc !== !!s.actions[i].gsc_id ||
        !!a.ga4 !== !!s.actions[i].ga4_id ||
        (a.ga4?.state === "withheld" &&
          [
            a.ga4.before,
            a.ga4.after,
            a.ga4.difference,
            a.ga4.relative_change_percent,
          ].some((x) => x !== null)),
    )
  )
    return null;
  return v;
}
