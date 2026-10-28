import { useEffect, useRef, useState } from "react";
import type { Context, Decision } from "@/lib/review-decisions/types";
import { DecisionSummary } from "./DecisionSummary";
import styles from "./decisions.module.css";
export function SaveConfirmation({
  context,
  decisions,
  onClose,
  onSave,
}: {
  context: Context;
  decisions: Decision[];
  onClose: () => void;
  onSave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [ack, setAck] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <p className={styles.eyebrow}>Review before saving</p>
      <h2 id="confirm-title">Save your reasoning as a new version.</h2>
      <p>
        This is the complete decision list for this version. Any original action
        not listed as decided will remain undecided. Earlier versions stay
        unchanged.
      </p>
      <DecisionSummary context={context} decisions={decisions} />
      <label className={styles.ack}>
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I have reviewed these decisions and the work left undecided.
      </label>
      <p className={styles.small}>
        This does not generate, approve or send a report. Saving uses 0 credits.
      </p>
      <footer className={styles.footer}>
        <button onClick={onClose}>Back to editing</button>
        <button className={styles.primary} disabled={!ack} onClick={onSave}>
          Save version · 0 credits
        </button>
      </footer>
    </dialog>
  );
}
