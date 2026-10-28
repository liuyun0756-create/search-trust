import Link from "next/link";
import type { ReactNode } from "react";
import type {
  ReportDifference,
  ActionFacts,
  PlanAction,
} from "@/lib/review-differences/types";
const SECTION = {
  recorded_work: "Recorded implementation",
  page: "Page checks",
  gsc: "Search Console",
  ga4: "Organic search sessions",
  checks: "Checks still needed",
};
const FIELD = {
  title: "Title",
  target: "Target",
  steps: "Work steps",
  completion: "Completion checks",
  review: "Review basis",
  materials: "Execution materials",
};
const STATE = {
  added: "New work proposed",
  updated: "Work updated",
  unchanged: "Work retained",
  not_carried_forward: "Not proposed this time",
};
const box = "rounded-xl border border-[#dce6d9] bg-white p-4";
const readable = (s: string) => s.replaceAll("_", " ");
const range = (w: { start: string; end: string }) => `${w.start} – ${w.end}`;
function Pair({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      <div className={`${box} bg-[#f7f8f5]`}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#65776b]">
          Previous basis
        </p>
        {before}
      </div>
      <div className={`${box} border-[#bad2b0]`}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#426b3c]">
          This generated version
        </p>
        {after}
      </div>
    </div>
  );
}
function Fact({
  facts: f,
  section,
}: {
  facts: ActionFacts | null;
  section: keyof typeof SECTION;
}) {
  if (!f) return <p>No earlier observation for this action.</p>;
  if (section === "recorded_work")
    return (
      <>
        <p>
          {f.recorded_work.state === "seo_recorded"
            ? `Recorded for ${f.recorded_work.implemented_on} (${f.recorded_work.timezone}).`
            : "Implementation not recorded."}
        </p>
        <p className="mt-2 text-xs text-[#65776b]">
          Recorded by the SEO; not system-verified completion.
        </p>
      </>
    );
  if (section === "checks")
    return (
      <ul className="space-y-2">
        {f.checks.map((c) => (
          <li key={c.code}>{c.text}</li>
        ))}
      </ul>
    );
  const data = f[section];
  if (!data) return <p>Not selected in this review.</p>;
  if (section === "page" && f.page) {
    const p = f.page;
    return (
      <div className="space-y-2">
        <p className="break-all">{p.target_url}</p>
        <p>
          {readable(p.status)} · {p.observed_at}
        </p>
        <ul className="space-y-2">
          {p.conditions.map((c) => (
            <li key={c.id}>
              <span className="font-semibold">{readable(c.kind)}: </span>
              <span className="whitespace-pre-wrap break-words">{c.value}</span>
              <p className="text-[#65776b]">
                Result:{" "}
                {readable(
                  p.results.find((r) => r.condition_id === c.id)?.state ??
                    "unavailable",
                )}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#65776b]">
          Static response only. Rendering and the full contact path are not
          verified.
        </p>
      </div>
    );
  }
  if (section === "gsc" && f.gsc) {
    const g = f.gsc;
    return (
      <div className="space-y-3">
        <p>
          {range(g.windows.before)} versus {range(g.windows.after)} ·{" "}
          {g.windows.timezone}
        </p>
        <p className="break-all">
          {readable(g.scope.dimension)}: {g.scope.key} · {readable(g.state)}
        </p>
        {g.scope.filters.map((f, i) => (
          <p key={i} className="break-all text-xs">
            Filter · {readable(f.dimension)}: {f.value}
          </p>
        ))}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Saved Search Console comparison values
            </caption>
            <thead>
              <tr>
                <th className="py-2">Metric</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {g.metrics.map((m) => (
                <tr key={m.metric} className="border-t border-[#e0e8db]">
                  <th className="py-2 pr-2 font-medium">
                    {readable(m.metric)} ({m.unit})
                    <p className="font-normal text-[#65776b]">
                      {readable(m.state)}
                      {m.reasons.length
                        ? ` · ${m.reasons.map(readable).join("; ")}`
                        : ""}
                    </p>
                  </th>
                  <td className="pr-2">{m.before ?? "Unavailable"}</td>
                  <td>{m.after ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#65776b]">
          Descriptive values. Effect calibration is pending; no causal result is
          claimed.
        </p>
        {[...g.reasons, ...g.limitations].map((line, i) => (
          <p key={i} className="text-xs text-[#65776b]">
            {readable(line)}
          </p>
        ))}
      </div>
    );
  }
  if (section === "ga4" && f.ga4) {
    const g = f.ga4;
    return (
      <div className="space-y-2">
        <p>
          {range(g.windows.before)} versus {range(g.windows.after)} ·{" "}
          {g.windows.timezone}
        </p>
        <p className="break-all">
          Landing scope: {g.scope.landing_path ?? "All landing paths"}
        </p>
        <p className="break-all text-xs">
          Website · {g.scope.hosts.join(", ")}
        </p>
        <p className="text-lg font-semibold">
          {g.state === "available"
            ? `${g.before} → ${g.after} sessions`
            : "Values withheld"}
        </p>
        {g.reasons.length ? <p>{g.reasons.map(readable).join("; ")}</p> : null}
        <p className="text-xs text-[#65776b]">
          Processing completeness is not attested; measurement history is
          unverified. This does not establish enquiry quality or effect.
        </p>
      </div>
    );
  }
  return null;
}
function WorkValue({
  action: a,
  field,
}: {
  action: PlanAction | null;
  field: keyof typeof FIELD;
}) {
  if (!a) return <p>Not proposed in this plan.</p>;
  if (field === "materials")
    return a.materials.length ? (
      <div className="space-y-3">
        {a.materials.map((m, i) => (
          <div key={i}>
            <p className="font-semibold">{m.title}</p>
            <p className="break-all">{m.target}</p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="mt-2 text-xs">{readable(m.readiness)}</p>
            {m.confirmation_items.map((c, j) => (
              <p key={j}>Confirm: {c}</p>
            ))}
          </div>
        ))}
      </div>
    ) : (
      <p>No execution material in this plan.</p>
    );
  const value = a[field];
  return Array.isArray(value) ? (
    <ol className="list-inside list-decimal space-y-2">
      {value.map((x, i) => (
        <li key={i} className="whitespace-pre-wrap break-words">
          {x}
        </li>
      ))}
    </ol>
  ) : (
    <p className="whitespace-pre-wrap break-words">{value}</p>
  );
}
export function ReportDifferencePanel({
  difference: d,
  unavailable = false,
}: {
  difference: ReportDifference | null;
  unavailable?: boolean;
}) {
  if (unavailable)
    return (
      <section
        aria-label="Generated version comparison"
        className={`${box} mb-6`}
      >
        <h2 className="font-semibold">Version comparison unavailable</h2>
        <p role="alert" className="mt-2 text-sm leading-6">
          The saved comparison could not be verified. Your report remains
          available. Reload this page to check again.
        </p>
      </section>
    );
  if (!d)
    return (
      <section
        aria-label="Generated version comparison"
        className={`${box} mb-6`}
      >
        <h2 className="font-semibold">No saved comparison for this version</h2>
        <p className="mt-2 text-sm leading-6">
          This historical report has no recorded version comparison. Its
          original content and approved deliveries remain unchanged.
        </p>
      </section>
    );
  const evidenceChanged = d.evidence.filter(
    (a) => a.state === "compared" && a.changed_sections.length,
  ).length;
  const workChanged = d.work.filter((a) => a.state !== "unchanged").length;
  const priorPath = `/cases/${d.case_id}/reports/${d.basis.report_id}${d.evidence_basis === "previous_review" ? `/review?revision=${d.basis.delivery_id}` : ""}`;
  return (
    <section
      aria-label="Generated version comparison"
      className="mb-7 overflow-hidden rounded-2xl border border-[#bfd2b5] bg-[#edf4e8]"
    >
      <header className="border-b border-[#d2e0ca] p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#63865c]">
          Saved comparison · generated reports
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          What changed in version {d.report_version}?
        </h2>
        <p className="mt-3 text-sm leading-6">
          Compared with report version {d.basis.report_version}, approved plan
          revision {d.basis.delivery_revision}.{" "}
          <Link
            href={priorPath}
            className="font-semibold underline underline-offset-4"
          >
            Open the previous report →
          </Link>
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-[#617469]">
          Evidence and recommendations are compared separately against the
          approved plan used for this review. Your delivery edits below are not
          included.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className={box}>
            {evidenceChanged} action{evidenceChanged === 1 ? "" : "s"} with
            changed evidence
          </span>
          <span className={box}>
            {workChanged} work item{workChanged === 1 ? "" : "s"} changed
          </span>
          {d.plan_order_changed ? (
            <span className={box}>Plan order updated</span>
          ) : null}
        </div>
      </header>
      <div className="space-y-7 p-4 sm:p-7">
        <section aria-label="Evidence changes">
          <h3 className="mb-3 text-lg font-semibold">
            Evidence and recorded work
          </h3>
          {d.evidence_basis === "first_review" ? (
            <p className="mb-3 text-sm leading-6 text-[#617469]">
              First review evidence baseline. The previous report did not
              contain a comparable review observation.
            </p>
          ) : null}
          {!d.evidence.length ? (
            <p className="text-sm">
              No implementation actions were available for evidence comparison.
            </p>
          ) : null}
          <div className="space-y-3">
            {d.evidence.map((a) => {
              const changed =
                a.state === "compared" && a.changed_sections.length > 0;
              const sections = changed
                ? a.changed_sections
                : (Object.keys(SECTION) as (keyof typeof SECTION)[]).filter(
                    (k) =>
                      k === "recorded_work" ||
                      k === "checks" ||
                      a.after[k] ||
                      a.before?.[k],
                  );
              return (
                <details
                  key={a.action_id}
                  open={
                    changed &&
                    a.action_id ===
                      d.evidence.find(
                        (x) =>
                          x.state === "compared" && x.changed_sections.length,
                      )?.action_id
                  }
                  className={box}
                >
                  <summary className="cursor-pointer list-none space-y-2">
                    <span className="block break-words font-semibold">
                      {a.after.title}
                    </span>
                    <span
                      data-change={changed ? "evidence" : undefined}
                      className={`inline-block rounded-md px-2 py-1 text-xs ${changed ? "bg-[#d8e9cd] font-semibold" : "bg-[#f2f5ef] text-[#617469]"}`}
                    >
                      {changed
                        ? "Evidence changed"
                        : a.state === "first_baseline"
                          ? "First observation basis"
                          : a.state === "not_comparable"
                            ? "Different comparison basis"
                            : "No change in selected evidence"}
                    </span>
                    <span className="ml-3 text-xs underline underline-offset-4">
                      View saved observations
                    </span>
                  </summary>
                  <p className="mt-3 break-all text-xs text-[#617469]">
                    {a.after.target}
                  </p>
                  {a.state === "not_comparable" ? (
                    <p className="mt-3 text-sm">
                      {a.reason === "different_target"
                        ? "The target changed. These observations are not treated as a like-for-like change."
                        : "The business scope changed. These observations are not treated as a like-for-like change."}
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-5 text-sm leading-6">
                    {sections.map((k) => (
                      <section key={k}>
                        <h4 className="mb-2 font-semibold">{SECTION[k]}</h4>
                        <Pair
                          before={<Fact facts={a.before} section={k} />}
                          after={<Fact facts={a.after} section={k} />}
                        />
                      </section>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
        <section aria-label="Work recommendation changes">
          <h3 className="mb-3 text-lg font-semibold">The next work proposed</h3>
          {!workChanged ? (
            <p className="mb-3 text-sm leading-6">
              No changes to the proposed work from the approved plan.
            </p>
          ) : null}
          {!d.work.length ? (
            <p className="text-sm">
              Neither plan proposes an action. The diagnosis is still part of
              the report.
            </p>
          ) : null}
          {d.plan_order_changed ? (
            <p className="mb-3 text-sm">
              The order of retained actions changed:{" "}
              {d.basis_action_order.join(" → ")} to{" "}
              {d.current_action_order.join(" → ")}.
            </p>
          ) : null}
          <div className="space-y-3">
            {d.work.map((a) => {
              const fields = a.changed_fields.length
                ? a.changed_fields
                : ([
                    "title",
                    "target",
                    "steps",
                    "completion",
                    "review",
                    "materials",
                  ] as const);
              return (
                <details
                  key={a.action_id}
                  open={
                    a.state !== "unchanged" &&
                    a.action_id ===
                      d.work.find((x) => x.state !== "unchanged")?.action_id
                  }
                  className={box}
                >
                  <summary className="cursor-pointer list-none space-y-2">
                    <span className="block break-words font-semibold">
                      {(a.after ?? a.before)!.title}
                    </span>
                    <span
                      data-change={a.state !== "unchanged" ? "work" : undefined}
                      className={`inline-block rounded-md px-2 py-1 text-xs ${a.state !== "unchanged" ? "bg-[#d8e9cd] font-semibold" : "bg-[#f2f5ef] text-[#617469]"}`}
                    >
                      {STATE[a.state]}
                    </span>
                    <span className="ml-3 text-xs underline underline-offset-4">
                      View work comparison
                    </span>
                  </summary>
                  {a.state === "not_carried_forward" ? (
                    <p className="mt-3 text-sm leading-6">
                      Not proposed in this generated version. This does not mark
                      the earlier work as completed or delete its history.
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-5 text-sm leading-6">
                    {fields.map((k) => (
                      <section key={k}>
                        <h4 className="mb-2 font-semibold">{FIELD[k]}</h4>
                        <Pair
                          before={<WorkValue action={a.before} field={k} />}
                          after={<WorkValue action={a.after} field={k} />}
                        />
                      </section>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
