"use client";
import { useEffect, useState } from "react";
import { requestDecision } from "@/lib/review-decisions/client";
import type { History, Identity } from "@/lib/review-decisions/types";
import styles from "./decisions.module.css";
export function DecisionEntry({
  identity,
  reviewId,
}: {
  identity: Identity;
  reviewId: string;
}) {
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const key = JSON.stringify(identity);
  useEffect(() => {
    const controller = new AbortController();
    setHistory(null);
    setError(false);
    requestDecision(
      identity,
      { operation: "history", review_id: reviewId },
      controller.signal,
    )
      .then((h) => {
        if (!controller.signal.aborted) setHistory(h);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reviewId, retry]);
  const first = history?.items[0],
    path = `/cases/${identity.caseId}/reports/${identity.reportId}/review-decisions?reviewId=${reviewId}`;
  return (
    <div className={styles.entry}>
      <span role="status">
        {error
          ? "Decision history could not be checked."
          : history
            ? first
              ? `Next-action decisions: version ${first.revision}`
              : "No next-action decisions recorded."
            : "Checking decision history…"}
      </span>
      {error && (
        <button onClick={() => setRetry((x) => x + 1)}>
          Retry decision history
        </button>
      )}
      <a href={path}>
        {first ? "Review your decisions →" : "Open decision workspace →"}
      </a>
    </div>
  );
}
