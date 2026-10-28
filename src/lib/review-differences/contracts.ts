import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/schema.json";
import type { ReportDifference, ActionFacts, PlanAction } from "./types";
import type { VerifiedReviewReport } from "../review-reports/types";
import { canonicalDigest } from "../verified-analysis-v22/digest";
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const shape = ajv.compile(schema);
const WORK = [
  "title",
  "target",
  "steps",
  "completion",
  "review",
  "materials",
] as const;
const EVIDENCE = ["recorded_work", "page", "gsc", "ga4", "checks"] as const;
const equal = (a: unknown, b: unknown) =>
  canonicalDigest(a) === canonicalDigest(b);
export function workFields(a: PlanAction) {
  return {
    title: a.title,
    target: a.target,
    steps: a.steps,
    completion: a.completion,
    review: a.review,
    materials: a.materials.map(({ id: _, evidence_ids: __, ...m }) => m),
  };
}
export function evidenceSections(f: ActionFacts) {
  const raw = structuredClone(f);
  const omit = (value: unknown, keys: string[]) =>
    value === null
      ? null
      : Object.fromEntries(
          Object.entries(value as object).filter(
            ([key]) => !keys.includes(key),
          ),
        );
  return {
    recorded_work: raw.recorded_work,
    page: omit(raw.page, [
      "observed_at",
      "previous_observed_at",
      "comparison",
      "comparison_reason",
      "changes",
    ]),
    gsc: omit(raw.gsc, ["evaluated_at"]),
    ga4: omit(raw.ga4, ["started_at", "completed_at"]),
    checks: raw.checks,
  };
}
export function parseReportDifference(
  value: unknown,
  r: VerifiedReviewReport,
): ReportDifference {
  const fail = () => {
    throw new Error("REVIEW_DIFFERENCE_INVALID");
  };
  if (
    new TextEncoder().encode(JSON.stringify(value)).length > 5_000_000 ||
    !shape(value)
  )
    return fail();
  const d = value as unknown as ReportDifference,
    { checksum, ...body } = d;
  if (
    checksum !== canonicalDigest(body) ||
    d.report_checksum !== canonicalDigest(r) ||
    d.report_id !== r.id ||
    d.user_id !== r.business.user_id ||
    d.case_id !== r.business.case_id ||
    d.report_version !== r.version ||
    d.generated_at !== r.generated_at ||
    d.input_checksum !== r.input_reference.input_checksum ||
    d.basis.report_id !== r.input_reference.report_id ||
    d.basis.report_version + 1 !== r.version ||
    d.basis.report_id === d.report_id
  )
    return fail();
  const oldOrder: string[] = d.basis_action_order,
    newOrder: string[] = d.current_action_order;
  const old = r.content.seo_actions.map((a) => a.approved_action),
    current = r.actions;
  if (
    !equal(
      d.basis_action_order,
      old.map((a) => a.id),
    ) ||
    !equal(
      d.current_action_order,
      current.map((a) => a.id),
    ) ||
    !equal(
      d.evidence.map((a) => a.action_id),
      d.basis_action_order,
    ) ||
    !equal(
      d.work.map((a) => a.action_id),
      [
        ...d.current_action_order,
        ...d.basis_action_order.filter((id) => !newOrder.includes(id)),
      ],
    )
  )
    return fail();
  if (
    d.plan_order_changed !==
    !equal(
      d.basis_action_order.filter((id) => newOrder.includes(id)),
      d.current_action_order.filter((id) => oldOrder.includes(id)),
    )
  )
    return fail();
  for (const a of d.work) {
    const before = old.find((x) => x.id === a.action_id) ?? null,
      after = current.find((x) => x.id === a.action_id) ?? null;
    if (
      !equal(before, a.before) ||
      !equal(after, a.after) ||
      (!before && !after)
    )
      return fail();
    const fields =
      before && after
        ? WORK.filter(
            (k) => !equal(workFields(a.before!)[k], workFields(a.after!)[k]),
          )
        : [];
    const state = !before
      ? "added"
      : !after
        ? "not_carried_forward"
        : fields.length
          ? "updated"
          : "unchanged";
    if (a.state !== state || !equal(fields, a.changed_fields)) return fail();
  }
  for (const a of d.evidence) {
    const expected = r.content.seo_actions.find(
      (x) => x.facts.action_id === a.action_id,
    )?.facts;
    if (
      !expected ||
      !equal(expected, a.after) ||
      a.after.action_id !== a.action_id ||
      (a.before && a.before.action_id !== a.action_id)
    )
      return fail();
    if (a.state === "compared") {
      if (!a.before || a.reason !== null || a.before.target !== a.after.target)
        return fail();
      const left = evidenceSections(a.before),
        right = evidenceSections(a.after);
      if (
        !equal(
          a.changed_sections,
          EVIDENCE.filter((k) => !equal(left[k], right[k])),
        )
      )
        return fail();
    } else {
      if (a.changed_sections.length) return fail();
      if (
        a.state === "first_baseline" &&
        (a.before !== null ||
          !["no_previous_review", "no_previous_action_observation"].includes(
            a.reason ?? "",
          ))
      )
        return fail();
      if (
        a.state === "not_comparable" &&
        (!a.before ||
          !["different_business_scope", "different_target"].includes(
            a.reason ?? "",
          ))
      )
        return fail();
    }
    if (
      d.evidence_basis === "first_review" &&
      (a.state !== "first_baseline" || a.reason !== "no_previous_review")
    )
      return fail();
    if (
      d.evidence_basis === "previous_review" &&
      a.reason === "no_previous_review"
    )
      return fail();
  }
  return d;
}
