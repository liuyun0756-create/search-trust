import { boundDecisions, parseSave } from "./contracts";
import { uuid } from "../implementation-records/contracts";
import type {
  Context,
  Decision,
  Disposition,
  Identity,
  Revision,
  SaveDecision,
} from "./types";
export type Draft = Record<string, Decision>;
// Action IDs are data, so inherited object names must never become decisions.
export const getDecision = (draft: Draft, id: string): Decision | undefined =>
  Object.hasOwn(draft, id) ? draft[id] : undefined;
export const labels: Record<Disposition, string> = {
  continue: "Continue",
  adjust: "Adjust",
  observe: "Observe",
  defer: "Defer",
  new: "New work",
};
export const blank = (id: string, kind: Disposition): Decision => ({
  source: "seo_recorded",
  action_id: id,
  disposition: kind,
  reason: "",
  references: [],
  target: kind === "adjust" || kind === "new" ? "" : null,
  work: kind === "adjust" || kind === "new" ? "" : null,
  completion_statement: kind === "observe" ? "" : null,
  reconsider_when: kind === "defer" ? "" : null,
});
export function changeType(
  id: string,
  kind: Disposition,
  c: Context,
  old?: Decision,
) {
  const a = c.approved.find((a) => a.action_id === id),
    d = blank(id, kind);
  return {
    ...d,
    reason: old?.reason ?? "",
    references: old?.references ?? [],
    target: kind === "adjust" ? (a?.target ?? "") : d.target,
    work: kind === "adjust" ? (a?.steps.join("\n") ?? "") : d.work,
  };
}
export function ordered(d: Draft, c: Context) {
  return [
    ...c.approved.flatMap((a) => {
      const item = getDecision(d, a.action_id);
      return item ? [item] : [];
    }),
    ...Object.values(d).filter((a) => a.disposition === "new"),
  ].map((d) => ({ ...d, references: [...d.references].sort() }));
}
export function makeRequest(
  draft: Draft,
  c: Context,
  head: Revision | null,
  id: string,
): SaveDecision {
  return {
    id,
    review_id: c.evidence.review_id!,
    previous_id: head?.id ?? null,
    previous_checksum: head?.checksum ?? null,
    decisions: ordered(draft, c),
  };
}
export function validateDraft(draft: Draft, c: Context) {
  const ds = ordered(draft, c);
  const errors: { actionId?: string; message: string }[] = [];
  if (ds.filter((d) => d.disposition !== "defer").length > 3)
    errors.push({
      message:
        "Keep no more than three active decisions, including observation. Defer or clear other work.",
    });
  if (ds.length > 6 || ds.filter((d) => d.disposition === "new").length > 3)
    errors.push({
      message: "A version supports up to six decisions and three new actions.",
    });
  for (const d of ds) {
    const request = makeRequest(
      { [d.action_id]: d },
      c,
      null,
      "70000000-0000-4000-8000-000000000001",
    );
    if (!parseSave(request) || !boundDecisions([d], c))
      errors.push({
        actionId: d.action_id,
        message: `Complete the reason and required fields for ${c.approved.find((a) => a.action_id === d.action_id)?.title ?? "new work"}. Use only sources from this evidence snapshot.`,
      });
  }
  if (
    !errors.length &&
    !parseSave(
      makeRequest(draft, c, null, "70000000-0000-4000-8000-000000000001"),
    )
  )
    errors.push({
      message:
        "These decisions exceed the supported size. Shorten the text before saving.",
    });
  return errors;
}
export function parseLocation(
  q: Record<string, string | string[] | undefined>,
) {
  if (
    Object.keys(q).some((k) => !["reviewId", "decisionId"].includes(k)) ||
    !uuid(q.reviewId) ||
    (q.decisionId !== undefined && !uuid(q.decisionId))
  )
    return null;
  return {
    reviewId: q.reviewId as string,
    decisionId: q.decisionId as string | undefined,
  };
}
export type Marker = Identity & { reviewId: string; requestId: string };
export const markerKey = (i: Identity, r: string) =>
  `review-decisions:v1:${i.ownerId}:${i.caseId}:${i.reportId}:${r}`;
export function readMarker(
  storage: Pick<Storage, "getItem">,
  i: Identity,
  r: string,
): Marker | null {
  try {
    const m = JSON.parse(storage.getItem(markerKey(i, r)) ?? "null");
    return m &&
      Object.keys(m).sort().join(",") ===
        "caseId,ownerId,reportId,requestId,reviewId" &&
      m.ownerId === i.ownerId &&
      m.caseId === i.caseId &&
      m.reportId === i.reportId &&
      m.reviewId === r &&
      uuid(m.requestId)
      ? m
      : null;
  } catch {
    return null;
  }
}
