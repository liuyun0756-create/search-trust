import { allowedReferences } from "@/lib/review-decisions/contracts";
import { changeType, labels } from "@/lib/review-decisions/draft";
import type {
  Context,
  Decision,
  Disposition,
} from "@/lib/review-decisions/types";
import styles from "./decisions.module.css";
const descriptions = {
  continue: "Keep the approved direction",
  adjust: "Change the work or target",
  observe: "Review after recorded work",
  defer: "Set a condition to revisit",
};
export function DecisionForm({
  context: c,
  actionId,
  decision: d,
  onChange,
  onClear,
  disabled,
  showErrors = false,
}: {
  context: Context;
  actionId: string;
  decision?: Decision;
  onChange: (d: Decision) => void;
  onClear: () => void;
  disabled: boolean;
  showErrors?: boolean;
}) {
  const isNew = d?.disposition === "new",
    facts = c.evidence.actions.find((a) => a.action_id === actionId);
  const refs = allowedReferences(c, isNew ? undefined : actionId).filter(
    (r, i, all) => all.findIndex((x) => x.id === r.id) === i,
  );
  function choose(kind: Disposition) {
    if (d?.disposition === kind) return;
    if (
      d &&
      [d.target, d.work, d.completion_statement, d.reconsider_when].some(
        Boolean,
      ) &&
      !window.confirm(
        "Changing decision type will clear fields that do not apply. Keep the reason and references and continue?",
      )
    )
      return;
    onChange(changeType(actionId, kind, c, d));
  }
  function field(
    key:
      "reason" | "target" | "work" | "completion_statement" | "reconsider_when",
    label: string,
    max: number,
  ) {
    if (!d) return null;
    const value = d[key] ?? "",
      length = Array.from(value).length;
    return (
      <label className={styles.field} htmlFor={`decision-${key}`} key={key}>
        {label}
        <textarea
          id={`decision-${key}`}
          value={value}
          rows={key === "target" ? 2 : 3}
          disabled={disabled}
          aria-describedby={`count-${key}${showErrors ? " decision-validation-error" : ""}`}
          aria-invalid={length > max || (showErrors && !value.trim())}
          onChange={(e) => onChange({ ...d, [key]: e.target.value })}
        />
        <small id={`count-${key}`}>
          {length.toLocaleString()} / {max.toLocaleString()} characters
        </small>
      </label>
    );
  }
  return (
    <fieldset className={styles.form} disabled={disabled}>
      <legend className={styles.srOnly}>Your decision for this action</legend>
      {isNew ? (
        <p className={styles.note}>
          New proposed work · Ground it in this snapshot. It does not change the
          approved report.
        </p>
      ) : (
        <fieldset className={styles.choices}>
          <legend className={styles.srOnly}>Decision type</legend>
          {(Object.keys(descriptions) as (keyof typeof descriptions)[]).map(
            (kind) => {
              const unavailable =
                (kind === "observe" &&
                  facts?.recorded_work.state !== "seo_recorded") ||
                (kind === "adjust" && !refs.length);
              return (
                <label
                  key={kind}
                  className={
                    d?.disposition === kind ? styles.chosen : undefined
                  }
                >
                  <input
                    type="radio"
                    name={`disposition-${actionId}`}
                    checked={d?.disposition === kind}
                    disabled={unavailable}
                    onChange={() => choose(kind)}
                  />
                  <span>
                    <b>{labels[kind]}</b>
                    <small>
                      {unavailable
                        ? kind === "observe"
                          ? "No implementation recorded"
                          : "No selectable evidence"
                        : descriptions[kind]}
                    </small>
                  </span>
                </label>
              );
            },
          )}
        </fieldset>
      )}
      {!d ? (
        <p className={styles.note}>
          No decision is recorded by default. Choose a direction when you are
          ready, or leave this action undecided.
        </p>
      ) : (
        <>
          {(d.disposition === "adjust" || isNew) && (
            <>
              {field("target", "Target", 2000)}
              {field("work", "Work to do", 4000)}
            </>
          )}
          {d.disposition === "observe" &&
            field("completion_statement", "Your completion statement", 1200)}
          {d.disposition === "defer" &&
            field("reconsider_when", "Reconsider when…", 1200)}
          {field("reason", "Why this decision?", 1200)}
          <fieldset className={styles.references}>
            <legend>
              Evidence behind your decision ·{" "}
              {d.disposition === "adjust" || isNew ? "Required" : "Optional"}
            </legend>
            {refs.length ? (
              refs.map((r) => (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    aria-invalid={
                      showErrors &&
                      (d.disposition === "adjust" || isNew) &&
                      !d.references.length
                    }
                    checked={d.references.includes(r.id)}
                    onChange={(e) =>
                      onChange({
                        ...d,
                        references: e.target.checked
                          ? [...d.references, r.id]
                          : d.references.filter((id) => id !== r.id),
                      })
                    }
                  />
                  <span>
                    <b>{r.label}</b>
                    <small>{r.detail}</small>
                    {isNew && (
                      <small>
                        From:{" "}
                        {c.approved
                          .filter((a) =>
                            c.references.some(
                              (x) =>
                                x.id === r.id && x.action_id === a.action_id,
                            ),
                          )
                          .map((a) => a.title)
                          .join(" · ")}
                      </small>
                    )}
                  </span>
                </label>
              ))
            ) : (
              <p>No selectable sources in this snapshot.</p>
            )}
          </fieldset>
          <button type="button" className={styles.textButton} onClick={onClear}>
            {isNew ? "Remove proposed work" : "Clear this decision"}
          </button>
        </>
      )}
    </fieldset>
  );
}
