import { MetricReviewGuide } from "../metric-review/MetricReviewGuide";
import metricStyles from "../metric-review/metric-review.module.css";
import type {
  ActionFacts,
  ComparisonWindows,
  PriorDiagnosis,
} from "@/lib/review-workspace/types";
import styles from "./workspace.module.css";
export const human = (value: string) => value.replaceAll("_", " ");
export const instant = (value: string) =>
  `${value.replace("T", " ").replace(/Z$/, "")} UTC`;
function Windows({ value: w }: { value: ComparisonWindows }) {
  return (
    <dl className={styles.dates}>
      <div>
        <dt>Before</dt>
        <dd>
          {w.before.start} — {w.before.end}
        </dd>
      </div>
      <div>
        <dt>After</dt>
        <dd>
          {w.after.start} — {w.after.end}
        </dd>
      </div>
      <div>
        <dt>Excluded</dt>
        <dd>
          {w.excluded.start} — {w.excluded.end}
        </dd>
      </div>
      <div>
        <dt>Timezone</dt>
        <dd>{w.timezone}</dd>
      </div>
    </dl>
  );
}
function Notes({ items }: { items: string[] }) {
  return items.length ? (
    <ul className={styles.notes}>
      {items.map((text, i) => (
        <li key={i}>{human(text)}</li>
      ))}
    </ul>
  ) : null;
}
export function PriorReport({ value: p }: { value: PriorDiagnosis }) {
  return (
    <section className={styles.prior}>
      <p className={styles.eyebrow}>
        Original diagnosis · Not rechecked in this review
      </p>
      <h2>{p.title}</h2>
      <p>{p.summary}</p>
      {p.findings.map((f, i) => (
        <div key={i} className={styles.finding}>
          <strong>{f.target}</strong>
          <p>{f.observed_fact}</p>
          <p>
            {f.judgment} · {f.interpretation}
          </p>
          <p className={styles.small}>
            Observed: {instant(f.observed_at)} · {f.comparison_scope}
          </p>
          <Notes items={f.limitations} />
        </div>
      ))}
      <Notes items={p.limitations} />
    </section>
  );
}
function EvidenceDetails({
  action: a,
  only,
}: {
  action: ActionFacts;
  only?: "page" | "gsc" | "ga4";
}) {
  const p = a.page,
    g = a.gsc,
    ga = a.ga4;
  return (
    <div className={styles.facts}>
      {(!only || only === "page") && (
        <section>
          <h3>
            Page check{" "}
            <span className={styles.tag}>
              {p ? human(p.status) : "Not selected"}
            </span>
          </h3>
          {p ? (
            <>
              <p className={styles.target}>{p.target_url}</p>
              <p className={styles.small}>
                Observed {instant(p.observed_at)}
                {p.previous_observed_at
                  ? ` · Previous ${instant(p.previous_observed_at)}`
                  : ""}
              </p>
              <ul className={styles.conditions}>
                {p.conditions.map((c) => (
                  <li key={c.id}>
                    <span>
                      <strong>{human(c.kind)}</strong> · {c.value}
                    </span>
                    <b>
                      {human(
                        p.results.find((r) => r.condition_id === c.id)?.state ??
                          "not checked",
                      )}
                    </b>
                  </li>
                ))}
              </ul>
              <p>
                {human(p.comparison)}
                {p.comparison_reason ? ` · ${human(p.comparison_reason)}` : ""}
              </p>
              {p.changes.map((c) => (
                <p key={c.condition_id}>
                  {p.conditions.find((v) => v.id === c.condition_id)?.value ??
                    c.condition_id}
                  : {human(c.change)}
                </p>
              ))}
              {p.failure && (
                <p className={styles.warning}>{human(p.failure)}</p>
              )}
              <p className={styles.notice}>{p.limitation}</p>
            </>
          ) : (
            <p>No page observation included.</p>
          )}
        </section>
      )}
      {(!only || only === "gsc") && (
        <section>
          <h3>
            Search Console{" "}
            <span className={styles.tag}>
              {g ? human(g.state) : "Not selected"}
            </span>
          </h3>
          {g ? (
            <>
              <p className={styles.target}>
                {human(g.scope.dimension)} · {g.scope.key} ·{" "}
                {human(g.scope.channel)}
              </p>
              <p className={styles.small}>
                Evaluated {instant(g.evaluated_at)}
              </p>
              {g.scope.filters.map((f, i) => (
                <p key={i} className={styles.small}>
                  {human(f.dimension)}: {f.value}
                </p>
              ))}
              <Windows value={g.windows} />
              {g.state === "comparable" && g.reading.length > 0 ? (
                <table className={styles.metrics}>
                  <caption>Descriptive counts · not evidence of impact</caption>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.reading.map((r) => (
                      <tr key={r.metric}>
                        <th>
                          {r.metric === "ctr"
                            ? "CTR · clicks / impressions"
                            : human(r.metric)}
                        </th>
                        <td>
                          {r.before_count}
                          {r.before_denominator !== null
                            ? ` / ${r.before_denominator}`
                            : ""}
                        </td>
                        <td>
                          {r.after_count}
                          {r.after_denominator !== null
                            ? ` / ${r.after_denominator}`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.warning}>
                  A comparable reading is not available. Values are not treated
                  as zero.
                </p>
              )}
              <Notes
                items={[
                  ...g.reasons,
                  ...g.reading.flatMap((r) => r.notes),
                  ...g.limitations,
                ]}
              />
            </>
          ) : (
            <p>No search comparison included.</p>
          )}
        </section>
      )}
      {(!only || only === "ga4") && (
        <section>
          <h3>
            Google Analytics{" "}
            <span className={styles.tag}>
              {ga ? human(ga.state) : "Not selected"}
            </span>
          </h3>
          {ga ? (
            <>
              <p className={styles.target}>
                {ga.scope.resource_id} · {ga.scope.hosts.join(", ")} ·{" "}
                {ga.scope.landing_path ?? "All landing paths"} ·{" "}
                {human(ga.scope.channel)}
              </p>
              <p className={styles.small}>
                Collected {instant(ga.completed_at)}
              </p>
              <Windows value={ga.windows} />
              {ga.state === "available" ? (
                <table className={styles.metrics}>
                  <caption>Organic sessions · not enquiries or revenue</caption>
                  <thead>
                    <tr>
                      <th>Before</th>
                      <th>After</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{ga.before}</td>
                      <td>{ga.after}</td>
                      <td>{ga.difference}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className={styles.warning}>
                  Reading withheld. No values are shown.
                </p>
              )}
              <Notes items={ga.reasons} />
              <p className={styles.notice}>
                Measurement history: {human(ga.measurement_history)}. Processing
                completeness: {human(ga.processing_completeness)}. These
                sessions do not establish lead quality or the effect of your
                work.
              </p>
            </>
          ) : (
            <p>No sessions reading included.</p>
          )}
        </section>
      )}
      {!only && <Notes items={a.checks.map((c) => c.text)} />}
    </div>
  );
}

export function EvidenceFacts({action, only}: {action: ActionFacts; only?: "page" | "gsc" | "ga4"}) {
  if (only === "page") return <EvidenceDetails action={action} only={only}/>;
  return <div><MetricReviewGuide action={action} only={only}/><details className={metricStyles.sourceDetails}><summary>Inspect selected source details</summary><EvidenceDetails action={action} only={only}/></details></div>;
}
