import type { ActionFacts } from "@/lib/review-reports/types";
import type { MetricReview } from "@/lib/metric-review-guidance/types";
import { buildMetricReviewGuidance } from "@/lib/metric-review-guidance/build";
import {
  metricNames,
  stateNames,
  nextChecks,
  noteCopy,
} from "@/lib/metric-review-guidance/copy";
import { checkReason } from "@/lib/comparison-checks/copy";
import { sessionReason } from "@/lib/ga4-session-readings/copy";
import styles from "./metric-review.module.css";
const n = (v: number) =>
  v !== 0 && Math.abs(v) < 0.01
    ? v.toExponential(2)
    : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
const signed = (v: number) => `${v > 0 ? "+" : ""}${n(v)}`;
function Values({ m }: { m: MetricReview }) {
  if (m.before === null || m.after === null)
    return <p className={styles.empty}>No comparable values shown</p>;
  return (
    <>
      <p className={styles.values}>
        <span>
          <small>Before</small>
          {n(m.before)}
          {m.before_denominator !== null ? (
            <span className={styles.denominator}>
              {" "}
              / {n(m.before_denominator)}
            </span>
          ) : null}
        </span>
        <span aria-label="to" className={styles.arrow}>
          →
        </span>
        <span>
          <small>After</small>
          {n(m.after)}
          {m.after_denominator !== null ? (
            <span className={styles.denominator}>
              {" "}
              / {n(m.after_denominator)}
            </span>
          ) : null}
        </span>
      </p>
      {m.metric === "ctr" ? (
        <p className={styles.delta}>
          {m.percentage_point_change === null
            ? "CTR change unavailable"
            : `${signed(m.percentage_point_change)} percentage points`}
          <span>Clicks / impressions in each period</span>
        </p>
      ) : (
        <p className={styles.delta}>
          {signed(m.absolute_change!)}{" "}
          {m.metric === "sessions" ? "sessions" : m.metric}
          {m.relative_change !== null
            ? ` · ${signed(m.relative_change * 100)}%`
            : ""}
          <span>Observed count difference</span>
        </p>
      )}
    </>
  );
}
function Scope({ a, source }: { a: ActionFacts; source: "gsc" | "ga4" }) {
  const s = a[source];
  if (!s) return <p>No source selected for this action.</p>;
  return (
    <dl className={styles.scope}>
      <div>
        <dt>Before</dt>
        <dd>
          {s.windows.before.start} — {s.windows.before.end}
        </dd>
      </div>
      <div>
        <dt>After</dt>
        <dd>
          {s.windows.after.start} — {s.windows.after.end}
        </dd>
      </div>
      <div>
        <dt>Excluded</dt>
        <dd>
          {s.windows.excluded.start} — {s.windows.excluded.end}
        </dd>
      </div>
      <div>
        <dt>Timezone</dt>
        <dd>{s.windows.timezone}</dd>
      </div>
      {source === "gsc" && a.gsc ? (
        <>
          <div>
            <dt>Search scope</dt>
            <dd>
              {a.gsc.scope.dimension} · {a.gsc.scope.key ?? "Selected property"}{" "}
              · {a.gsc.scope.channel.replaceAll("_", " ")}
            </dd>
          </div>
          {a.gsc.scope.filters.map((f, i) => (
            <div key={i}>
              <dt>{f.dimension}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </>
      ) : a.ga4 ? (
        <>
          <div>
            <dt>Analytics scope</dt>
            <dd>
              {a.ga4.scope.resource_id} · {a.ga4.scope.hosts.join(", ")} ·{" "}
              {a.ga4.scope.landing_path ?? "All landing paths"} ·{" "}
              {a.ga4.scope.channel.replaceAll("_", " ")}
            </dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}
export function MetricReviewGuide({
  action: a,
  only,
}: {
  action: ActionFacts;
  only?: "gsc" | "ga4";
}) {
  const guide = buildMetricReviewGuidance(a);
  if (!guide)
    return (
      <p role="alert" className={styles.unavailable}>
        Metric guidance could not be verified. Reopen the saved evidence before
        deciding the next work.
      </p>
    );
  const metrics = guide.metrics.filter(
    (m) =>
      !only ||
      (only === "gsc"
        ? ["impressions", "clicks", "ctr"].includes(m.metric)
        : ["sessions", "key_events"].includes(m.metric)),
  );
  return (
    <section
      aria-label={`Metric review for ${a.title}`}
      className={styles.guide}
    >
      <header>
        <p className={styles.eyebrow}>Your evidence review</p>
        <h3>What can guide your next decision?</h3>
        <p>
          Read each metric within its own scope. These checks help you decide
          what to investigate; they do not choose or change your next action.
        </p>
      </header>
      <div className={styles.grid}>
        {metrics.map((m) => (
          <article
            key={m.metric}
            className={styles.card}
            data-metric={m.metric}
          >
            <div className={styles.cardHead}>
              <h4>{metricNames[m.metric]}</h4>
              <span className={styles.status}>{stateNames[m.state]}</span>
            </div>
            <Values m={m} />
            <div className={styles.next}>
              <strong>Your next check</strong>
              <p>{nextChecks[m.next_checks[0]]}</p>
            </div>
            <details>
              <summary>
                Basis &amp; checks for {metricNames[m.metric].toLowerCase()}
              </summary>
              <ul>
                {m.next_checks.slice(1).map((code) => (
                  <li key={code}>{nextChecks[code]}</li>
                ))}
                {m.notes.map((code) => (
                  <li key={code}>{noteCopy[code]}</li>
                ))}
                {m.source_reasons.map((code, i) => (
                  <li key={i}>
                    {["sessions", "key_events"].includes(m.metric)
                      ? (sessionReason[code as keyof typeof sessionReason] ??
                        "Review this source restriction before interpreting the saved counts.")
                      : checkReason(code)}
                  </li>
                ))}
              </ul>
              <Scope
                a={a}
                source={
                  ["sessions", "key_events"].includes(m.metric) ? "ga4" : "gsc"
                }
              />
              {m.metric === "key_events" ? (
                <p>
                  Source details describe the session observation only; they do
                  not establish an event comparison. Review event configuration
                  and collection history in the evidence workspace.
                </p>
              ) : null}
            </details>
          </article>
        ))}
      </div>
      {!only ? (
        <aside className={styles.context}>
          <strong>Before changing the plan</strong>
          <p>
            {guide.implementation_state === "not_recorded"
              ? "No implementation date is recorded for this action. Confirm what changed and when."
              : `Implementation recorded by the SEO: ${a.recorded_work.implemented_on} (${a.recorded_work.timezone}). This is not system-verified completion.`}
          </p>
          <p>
            {guide.concurrent_changes === "reported"
              ? "Other changes were reported. Review their timing and scope alongside this work."
              : guide.concurrent_changes === "none_reported"
                ? "No concurrent changes were reported. That does not rule out other causes."
                : "Other changes have not been established here. Check releases, tracking changes and changes in demand."}
          </p>
          <p>
            No metric-specific effect threshold has been validated. Larger
            totals or a positive percentage alone do not prove success. Keep,
            adjust, defer or observe only after your own review.
          </p>
        </aside>
      ) : null}
      <p className={styles.footnote}>
        Reading aid · saved evidence and client report unchanged · no new
        collection or credits used
      </p>
    </section>
  );
}
