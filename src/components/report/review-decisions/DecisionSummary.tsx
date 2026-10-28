import { labels } from "@/lib/review-decisions/draft";
import type { Context, Decision } from "@/lib/review-decisions/types";
import styles from "./decisions.module.css";
export function DecisionSummary({
  context,
  decisions,
}: {
  context: Context;
  decisions: Decision[];
}) {
  const rows = [
    ...context.approved.map((a) => ({ id: a.action_id, title: a.title })),
    ...decisions
      .filter((d) => d.disposition === "new")
      .map((d, i) => ({
        id: d.action_id,
        title: `New proposed work ${i + 1}`,
      })),
  ];
  return (
    <div>
      {rows.length === 0 && (
        <p className={styles.note}>
          No actions in this snapshot. This version records no next-action
          decisions.
        </p>
      )}
      {rows.map((a) => {
        const d = decisions.find((d) => d.action_id === a.id);
        return (
          <article className={styles.summary} key={a.id}>
            <span className={styles.badge}>
              {d ? labels[d.disposition] : "No decision recorded"}
            </span>
            <h3>{a.title}</h3>
            {d ? (
              <>
                <p>{d.reason}</p>
                {d.target && (
                  <>
                    <h4>Target</h4>
                    <p>{d.target}</p>
                    <h4>Work to do</h4>
                    <p>{d.work}</p>
                  </>
                )}
                {d.completion_statement && (
                  <>
                    <h4>SEO completion statement</h4>
                    <p>{d.completion_statement}</p>
                  </>
                )}
                {d.reconsider_when && (
                  <>
                    <h4>Reconsider when</h4>
                    <p>{d.reconsider_when}</p>
                  </>
                )}
                {d.references.length > 0 && (
                  <>
                    <h4>Evidence references</h4>
                    <ul>
                      {d.references.map((id) => {
                        const r = context.references.find(
                          (r) =>
                            r.id === id &&
                            (d.disposition === "new" ||
                              r.action_id === d.action_id),
                        );
                        return (
                          <li key={id}>
                            {r?.label}
                            <small>{r?.detail}</small>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p>This version leaves this action undecided.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
