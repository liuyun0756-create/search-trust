"use client";
import { useEffect, useRef, useState } from "react";
import type { Identity, Revision } from "@/lib/review-decisions/types";
import {
  command,
  reviewJob,
  type Command,
  type ReviewJob,
  type Selection,
} from "@/lib/review-intake/contracts";
import { boundedJson } from "@/lib/review-decisions/json";
import styles from "./decisions.module.css";
class IntakeError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function GenerateReview({
  identity,
  revision,
}: {
  identity: Identity;
  revision: Revision;
}) {
  const [job, setJob] = useState<ReviewJob | null>(null),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<Selection | null>(null);
  const mounted = useRef(true),
    lock = useRef(false),
    pendingRef = useRef<Selection | null>(null);
  const key = `searchtrust:review-generation:${identity.ownerId}:${identity.caseId}:${identity.reportId}:${revision.id}`;
  const path = `/api/v2/cases/${identity.caseId}/reports/${identity.reportId}/review-generation`;
  const find: Command = {
    operation: "find",
    review_id: revision.review_id,
    decision_id: revision.id,
  };
  async function request(c: Command, signal?: AbortSignal) {
    const write = c.operation === "start",
      q = new URLSearchParams();
    if (!write) for (const [k, v] of Object.entries(c)) q.set(k, String(v));
    const r = await fetch(write ? path : `${path}?${q}`, {
      method: write ? "POST" : "GET",
      headers: write ? { "Content-Type": "application/json" } : undefined,
      body: write ? JSON.stringify(c) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(65000)])
        : AbortSignal.timeout(65000),
    });
    const raw = await boundedJson(r, r.ok ? 16384 : 2048);
    if (!r.ok)
      throw new IntakeError(
        r.status,
        (raw as { code?: string; error?: { code?: string } })?.code ??
          (raw as { error?: { code?: string } })?.error?.code ??
          "UNAVAILABLE",
      );
    if (raw === null && c.operation !== "start") return null;
    if (
      !reviewJob(raw, identity, c) ||
      raw.selection.review_checksum !== revision.bundle_checksum ||
      raw.selection.decision_checksum !== revision.checksum
    )
      throw new IntakeError(503, "UNAVAILABLE");
    return raw;
  }
  function accept(value: ReviewJob | null) {
    if (!mounted.current) return;
    setJob(value);
    setLoaded(true);
    setMessage("");
    if (value) {
      pendingRef.current = null;
      setPending(null);
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  }
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const c: unknown = JSON.parse(raw);
        if (
          command(c) &&
          c.operation === "start" &&
          c.selection.review_id === revision.review_id &&
          c.selection.review_checksum === revision.bundle_checksum &&
          c.selection.decision_id === revision.id &&
          c.selection.decision_checksum === revision.checksum
        ) {
          pendingRef.current = c.selection;
          setPending(c.selection);
        }
      }
    } catch {}
    request(find, abort.signal)
      .then(accept)
      .catch(() => {
        if (!abort.signal.aborted)
          setMessage(
            "The saved task could not be checked. Check again before generating.",
          );
      });
    return () => {
      mounted.current = false;
      abort.abort();
    };
    // This component is keyed to the exact saved decision revision by its parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await request(
          { operation: "status", job_id: job!.job_id },
          abort.signal,
        );
        if (result) {
          accept(result);
          if (["queued", "running"].includes(result.status))
            timer = setTimeout(poll, 3000);
        }
      } catch {
        if (!abort.signal.aborted) {
          setMessage(
            "Connection interrupted. This same task is still being checked; no new analysis has been requested.",
          );
          timer = setTimeout(poll, 6000);
        }
      }
    }
    timer = setTimeout(poll, 3000);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job_id, job?.status]);
  async function check() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      accept(await request(find));
    } catch {
      setMessage(
        "The saved task could not be checked. Keep this page and try again.",
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function start() {
    if (lock.current || (!pendingRef.current && !confirmed)) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const selected = pendingRef.current ?? {
      job_id: crypto.randomUUID(),
      review_id: revision.review_id,
      review_checksum: revision.bundle_checksum,
      decision_id: revision.id,
      decision_checksum: revision.checksum,
    };
    pendingRef.current = selected;
    setPending(selected);
    const c: Command = {
      operation: "start",
      selection: selected,
      confirmed: true,
    };
    try {
      localStorage.setItem(key, JSON.stringify(c));
    } catch {}
    try {
      accept(await request(c));
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof IntakeError && e.code === "V22_PUBLIC_ENTRY_PAUSED") {
        setMessage(
          "New review generation is temporarily paused. No new analysis was started. Your saved report remains available.",
        );
      } else if (
        e instanceof IntakeError &&
        [400, 402, 404, 409, 413].includes(e.status)
      ) {
        if (e.code === "CONFLICT" || e.code === "BUSY") {
          try {
            const existing = await request(find);
            if (existing) {
              accept(existing);
              return;
            }
          } catch {}
        }
        if (e.status === 402)
          setMessage(
            "You need 1 credit to generate this review. Add credits, then retry this request.",
          );
        else if (e.code === "STALE")
          setMessage(
            "A newer Verified report exists. Return to the Case and review the latest report.",
          );
        else if (e.code === "BUSY")
          setMessage(
            "Another analysis is active in this Case. Check that task before starting this review.",
          );
        else
          setMessage(
            "This request could not be accepted. Check the saved decision and Case before continuing.",
          );
      } else
        setMessage(
          "The start result is unknown. Check the same request; do not start another analysis.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function again() {
    setJob(null);
    setConfirmed(false);
    pendingRef.current = null;
    setPending(null);
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  return (
    <section className={styles.note} aria-label="Generate a review report">
      <p className={styles.eyebrow}>Next · Generate the report</p>
      <h3>Your evidence. Your saved decisions. One new review.</h3>
      <p>
        Uses evidence snapshot and decision version {revision.revision} exactly
        as saved. Later edits do not change this analysis.
      </p>
      <p>
        Generating uses 1 credit, including a completed diagnosis with no next
        actions. Technical failure returns the reserved credit. Editing and
        approving delivery are free.
      </p>
      {message ? <p role="alert">{message}</p> : null}
      {job ? (
        <>
          <p role="status">
            {job.status === "succeeded"
              ? "Review ready · 1 credit used"
              : job.status === "failed"
                ? "Review failed · reserved credit returned"
                : job.status === "running"
                  ? "Preparing your review · 1 credit reserved"
                  : "Review queued · 1 credit reserved"}
          </p>
          {job.status === "succeeded" ? (
            <a
              className={`${styles.primary} ${styles.deliveryLink}`}
              href={`/cases/${identity.caseId}/reports/${job.report_id}/review`}
            >
              Review & approve the report →
            </a>
          ) : job.status === "failed" ? (
            <button disabled={busy} onClick={again}>
              Prepare a new attempt
            </button>
          ) : (
            <small>
              You can leave this page. The saved task continues in the
              background.
            </small>
          )}
        </>
      ) : (
        <>
          {!loaded ? (
            <button disabled={busy} onClick={check}>
              Check saved task
            </button>
          ) : pending ? (
            <button className={styles.primary} disabled={busy} onClick={start}>
              {busy ? "Checking…" : "Check the same generation request"}
            </button>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I confirm this saved evidence and decision version. Generate a
                review for 1 credit.
              </label>
              <button
                className={styles.primary}
                disabled={!confirmed || busy}
                onClick={start}
              >
                {busy ? "Starting…" : "Generate review · 1 credit"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
