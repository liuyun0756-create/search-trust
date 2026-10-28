"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCommand } from "@/lib/review-workspace/contracts";
import {
  requestWorkspace,
  WorkspaceError,
  errorMessage,
  type Identity,
} from "@/lib/review-workspace/client";
import {
  locationQuery,
  type WorkspaceLocation,
} from "@/lib/review-workspace/navigation";
import type {
  ReviewFreezeSelection,
  ReviewSourceSelection,
  SaveCommand,
  WorkspaceView,
} from "@/lib/review-workspace/types";
import { EvidenceFacts, PriorReport, instant } from "./EvidenceFacts";
import { SourcePicker } from "./SourcePicker";
import { VersionPicker, SavedHistory } from "./VersionPicker";
import styles from "./workspace.module.css";
import { DecisionEntry } from "../review-decisions/DecisionEntry";

type Stage =
  | "loading"
  | "selecting"
  | "previewing"
  | "confirming"
  | "saving"
  | "saved"
  | "unknown"
  | "error"
  | "forbidden";
type Pending = Omit<SaveCommand, "user_id" | "case_id" | "report_id">;
const count = (s: ReviewSourceSelection) =>
  [s.page_current_id, s.page_previous_id, s.gsc_id, s.ga4_id].filter(Boolean)
    .length;
export function ReviewWorkspace({
  identity,
  location,
  decisionsEnabled = false,
}: {
  identity: Identity;
  location: WorkspaceLocation;
  decisionsEnabled?: boolean;
}) {
  const router = useRouter();
  const base = `/cases/${identity.caseId}/reports/${identity.reportId}`,
    path = `${base}/review-evidence`;
  const [stage, setStage] = useState<Stage>(
    location.target || location.reviewId ? "loading" : "selecting",
  );
  const [context, setContext] = useState<WorkspaceView | null>(null),
    [facts, setFacts] = useState<WorkspaceView | null>(null),
    [confirmed, setConfirmed] = useState<WorkspaceView | null>(null);
  const [selection, setSelection] = useState<ReviewFreezeSelection | null>(
      null,
    ),
    [active, setActive] = useState(""),
    [checked, setChecked] = useState(false);
  const [message, setMessage] = useState(""),
    [storageNotice, setStorageNotice] = useState(""),
    [loadingFacts, setLoadingFacts] = useState(false),
    [retry, setRetry] = useState(0),
    [history, setHistory] = useState(false);
  const pending = useRef<Pending | null>(null),
    busy = useRef(false),
    epoch = useRef(0);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === "confirming" || stage === "saved")
      confirmationHeading.current?.focus();
  }, [stage]);
  const storageKey = `review-evidence:v1:${identity.ownerId}:${identity.caseId}:${identity.reportId}:${location.target?.delivery_id}:${location.target?.implementation_id}:${location.target?.implementation_revision}`;
  const identityKey = JSON.stringify(identity),
    locationKey = JSON.stringify(location);
  const dirty =
    stage !== "saved" &&
    (!!selection?.actions.some((a) => count(a) > 0) || stage === "unknown");
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function clearPending() {
    pending.current = null;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* In-memory recovery remains available while mounted. */
    }
  }
  function fail(error: unknown) {
    setMessage(errorMessage(error));
    if (
      error instanceof WorkspaceError &&
      [401, 403, 404].includes(error.status)
    ) {
      setContext(null);
      setFacts(null);
      setSelection(null);
      setConfirmed(null);
      setChecked(false);
      setStage("forbidden");
      epoch.current++;
    }
  }
  useEffect(() => {
    if (!location.target && !location.reviewId) return;
    const controller = new AbortController();
    setStage("loading");
    void requestWorkspace(
      JSON.parse(identityKey),
      location.reviewId
        ? { operation: "read", review_id: location.reviewId }
        : { operation: "context", target: location.target! },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!("actions" in result)) throw new Error("view");
        setContext(result);
        setFacts(result);
        setSelection(result.selection);
        setActive(result.actions[0]?.action_id ?? "");
        setMessage("");
        if (location.reviewId) {
          setStage("saved");
          return;
        }
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            if (stored.length > 48 * 1024) throw new Error("invalid");
            const raw = JSON.parse(stored);
            const command =
              raw?.schema === "review_pending_v1"
                ? parseCommand({
                    ...raw.command,
                    user_id: identity.ownerId,
                    case_id: identity.caseId,
                    report_id: identity.reportId,
                  })
                : null;
            if (
              !command ||
              command.operation !== "save" ||
              command.selection.delivery.id !== location.target!.delivery_id ||
              command.selection.implementation.id !==
                location.target!.implementation_id ||
              command.selection.implementation.revision !==
                location.target!.implementation_revision
            )
              throw new Error("invalid");
            pending.current = {
              operation: "save",
              review_id: command.review_id,
              selection: command.selection,
              confirmation_fingerprint: command.confirmation_fingerprint,
            };
            setSelection(command.selection);
            setFacts(null);
            setStage("unknown");
            setMessage(
              "A previous save needs checking. Recover this request before starting another snapshot.",
            );
            return;
          }
        } catch {
          setStorageNotice(
            "Browser recovery storage is unavailable or invalid. Check Saved snapshots before starting another save.",
          );
        }
        setStage("selecting");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStage("error");
          fail(error);
        }
      });
    return () => controller.abort();
    // Immutable page identity/location; changing the route remounts the workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey, locationKey, retry]);
  function navigate(next: WorkspaceLocation) {
    if (busy.current) return;
    if (
      dirty &&
      !window.confirm(
        stage === "unknown"
          ? "The original save may still succeed. Leave this request and find it later in Saved snapshots?"
          : "Discard these unsaved evidence selections and change the review basis?",
      )
    )
      return;
    router.push(path + locationQuery(next));
    // A route already without a query can be the same URL after local state changes.
    if (
      !next.target &&
      !next.reviewId &&
      !location.target &&
      !location.reviewId
    ) {
      setContext(null);
      setSelection(null);
      setFacts(null);
      setStage("selecting");
    }
  }
  async function choose(
    actionId: string,
    key: keyof Omit<ReviewSourceSelection, "action_id">,
    value: string | null,
  ) {
    if (!selection || stage !== "selecting") return;
    const next = structuredClone(selection),
      action = next.actions.find((a) => a.action_id === actionId)!;
    action[key] = value;
    let notice = "";
    if (
      key === "page_current_id" &&
      (!value || value === action.page_previous_id)
    ) {
      action.page_previous_id = null;
      notice =
        "The previous page check was cleared with the current-check change.";
    }
    setSelection(next);
    setConfirmed(null);
    setChecked(false);
    setFacts(null);
    setMessage(notice);
    setLoadingFacts(true);
    const token = ++epoch.current;
    try {
      const result = await requestWorkspace(identity, {
        operation: "preview",
        selection: next,
      });
      if (token !== epoch.current) return;
      if (!("actions" in result)) throw new Error("view");
      setFacts(result);
    } catch (error) {
      if (token === epoch.current) fail(error);
    } finally {
      if (token === epoch.current) setLoadingFacts(false);
    }
  }
  async function preview() {
    if (!selection || busy.current) return;
    busy.current = true;
    epoch.current++;
    setLoadingFacts(false);
    setStage("previewing");
    setMessage("");
    setChecked(false);
    try {
      const result = await requestWorkspace(identity, {
        operation: "preview",
        selection,
      });
      if (!("actions" in result)) throw new Error("view");
      setConfirmed(result);
      setFacts(result);
      setStage("confirming");
    } catch (error) {
      setStage("selecting");
      fail(error);
    } finally {
      busy.current = false;
    }
  }
  async function save(recover = false) {
    if (
      busy.current ||
      (!recover && (!checked || !confirmed?.confirmation_fingerprint))
    )
      return;
    const command =
      pending.current ??
      (confirmed
        ? {
            operation: "save" as const,
            review_id: crypto.randomUUID(),
            selection: confirmed.selection,
            confirmation_fingerprint: confirmed.confirmation_fingerprint!,
          }
        : null);
    if (!command) return;
    pending.current = command;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ schema: "review_pending_v1", command }),
      );
    } catch {
      setStorageNotice(
        "Browser recovery storage is unavailable. Keep this page open; after a refresh, check Saved snapshots to recover the result.",
      );
    }
    busy.current = true;
    setStage("saving");
    setMessage("");
    try {
      const result = await requestWorkspace(identity, command);
      if (!("actions" in result) || result.state !== "saved")
        throw new Error("view");
      clearPending();
      setContext(result);
      setFacts(result);
      setSelection(result.selection);
      setConfirmed(null);
      setChecked(false);
      setStage("saved");
      window.history.replaceState(
        null,
        "",
        path + locationQuery({ reviewId: result.review_id! }),
      );
      setMessage("Evidence snapshot saved. Your original report is unchanged.");
    } catch (error) {
      if (
        (error instanceof WorkspaceError &&
          [400, 413].includes(error.status)) ||
        (error instanceof WorkspaceError && error.code === "STALE")
      ) {
        clearPending();
        setConfirmed(null);
        setChecked(false);
        setStage("selecting");
        fail(error);
      } else if (
        error instanceof WorkspaceError &&
        [401, 403, 404].includes(error.status)
      ) {
        fail(error);
      } else {
        setStage("unknown");
        setMessage(
          error instanceof WorkspaceError && error.code === "CONFLICT"
            ? errorMessage(error)
            : "Save could not be confirmed. Recover this request before starting another snapshot.",
        );
      }
    } finally {
      busy.current = false;
    }
  }
  const saving = stage === "saving",
    locked = saving || stage === "previewing";
  const current = context?.actions.find((a) => a.action_id === active),
    selected = selection?.actions.find((a) => a.action_id === active),
    resolved = facts?.actions.find((a) => a.action_id === active);
  const display = stage === "saved" ? context : confirmed;
  const selectedCount =
    selection?.actions.reduce((n, a) => n + count(a), 0) ?? 0;
  return (
    <main className={styles.page}>
      <div className={styles.topline}>
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "Leave this review? Unsaved selections will be discarded; an unconfirmed save may still complete.",
              )
            )
              router.push(`${base}#implementation-records`);
          }}
        >
          ← Back to report
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => setHistory((v) => !v)}
          aria-expanded={history}
        >
          Saved snapshots
        </button>
      </div>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>
          Review evidence · Your private workspace
        </p>
        <h1>
          Bring the evidence
          <br />
          into one review.
        </h1>
        <p>
          Choose the saved records you want to review. Keep the original report
          unchanged.
        </p>
        <div className={styles.steps} aria-label="Review progress">
          <span
            aria-current={
              ["selecting", "previewing"].includes(stage) ? "step" : undefined
            }
          >
            01 Select evidence
          </span>
          <span
            aria-current={
              ["confirming", "saving", "unknown"].includes(stage)
                ? "step"
                : undefined
            }
          >
            02 Confirm selection
          </span>
          <span aria-current={stage === "saved" ? "step" : undefined}>
            03 Saved snapshot
          </span>
        </div>
      </header>
      {context && (
        <div className={styles.context}>
          <div>
            <strong>{context.site_url}</strong>
            <span>
              Report v{context.report_version} · Approved delivery{" "}
              {context.selection.delivery.revision} · Implementation{" "}
              {context.selection.implementation.revision}
            </span>
            <small>
              Pinned versions, not a claim about the client’s current situation.
            </small>
          </div>
          {stage !== "saved" && (
            <button
              type="button"
              disabled={locked}
              onClick={() => navigate({})}
            >
              Change versions
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {storageNotice && <p className={styles.warning}>{storageNotice}</p>}
      {stage === "loading" && (
        <p role="status" className={styles.empty}>
          Loading your report and saved versions…
        </p>
      )}
      {stage === "error" && (
        <div className={styles.empty}>
          <p>The workspace could not be loaded.</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry workspace
          </button>
        </div>
      )}
      {stage === "forbidden" && (
        <div className={styles.empty}>
          <h2>Evidence is unavailable.</h2>
          <p>
            Previously displayed evidence has been cleared. Reopen the report to
            check your access.
          </p>
          <a href={base}>Return to report</a>
        </div>
      )}
      {!location.target &&
        !location.reviewId &&
        !context &&
        stage === "selecting" && (
          <VersionPicker
            identity={identity}
            onSelect={(target) => navigate({ target })}
            onFailure={fail}
          />
        )}
      {history && stage !== "forbidden" && (
        <SavedHistory
          identity={identity}
          onOpen={(reviewId) => navigate({ reviewId })}
          onFailure={fail}
        />
      )}
      {stage === "unknown" && (
        <section className={styles.empty}>
          <p className={styles.eyebrow}>Save needs confirmation</p>
          <h2>Recover the same request.</h2>
          <p>
            No new request will be created. The original save may already have
            succeeded.
          </p>
          <p className={styles.small}>Request: {pending.current?.review_id}</p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void save(true)}
          >
            Recover this save
          </button>
          {pending.current && (
            <button
              type="button"
              onClick={() => navigate({ reviewId: pending.current!.review_id })}
            >
              Open saved record
            </button>
          )}
        </section>
      )}
      {context && selection && ["selecting", "previewing"].includes(stage) && (
        <div className={styles.layout}>
          <nav className={styles.actions} aria-label="Approved actions">
            <p className={styles.eyebrow}>
              Approved actions · {context.actions.length}
            </p>
            {context.actions.map((a, i) => (
              <button
                type="button"
                key={a.action_id}
                disabled={locked}
                aria-pressed={active === a.action_id}
                onClick={() => setActive(a.action_id)}
              >
                <span className={styles.number}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    {count(
                      selection.actions.find(
                        (s) => s.action_id === a.action_id,
                      )!,
                    )}{" "}
                    sources selected{active === a.action_id ? " · Viewing" : ""}
                  </small>
                </span>
              </button>
            ))}
          </nav>
          <div className={styles.editor}>
            {current && selected ? (
              <>
                <header className={styles.actionHeading}>
                  <p className={styles.eyebrow}>Evidence for this action</p>
                  <h2>{current.title}</h2>
                  <p className={styles.target}>{current.target}</p>
                  <p className={styles.notice}>
                    {current.recorded_work.state === "seo_recorded"
                      ? `Self-recorded · ${current.recorded_work.implemented_on} · ${current.recorded_work.timezone}`
                      : "Implementation not recorded for this action."}{" "}
                    · Not a system completion check.
                  </p>
                </header>
                {loadingFacts && (
                  <p role="status">Checking the selected sources…</p>
                )}
                {(["page", "gsc", "ga4"] as const).map((kind) => (
                  <section key={`${active}:${kind}`} className={styles.source}>
                    <p className={styles.eyebrow}>
                      {kind === "page"
                        ? "01 · Page evidence"
                        : kind === "gsc"
                          ? "02 · Search evidence"
                          : "03 · On-site evidence"}
                    </p>
                    <SourcePicker
                      identity={identity}
                      target={location.target!}
                      actionId={active}
                      kind={kind}
                      value={
                        kind === "page"
                          ? selected.page_current_id
                          : kind === "gsc"
                            ? selected.gsc_id
                            : selected.ga4_id
                      }
                      previous={selected.page_previous_id}
                      onChange={(value) =>
                        void choose(
                          active,
                          kind === "page"
                            ? "page_current_id"
                            : kind === "gsc"
                              ? "gsc_id"
                              : "ga4_id",
                          value,
                        )
                      }
                      onPrevious={(value) =>
                        void choose(active, "page_previous_id", value)
                      }
                      disabled={locked}
                      onFailure={fail}
                    />
                    {resolved ? (
                      <EvidenceFacts action={resolved} only={kind} />
                    ) : (
                      <p className={styles.small}>
                        Selected records need a validated reading. Review
                        selection to retry verification.
                      </p>
                    )}
                  </section>
                ))}
              </>
            ) : (
              <>
                <h2>No approved actions</h2>
                <p>
                  The diagnosis remains available. This workspace does not
                  invent actions.
                </p>
                <PriorReport value={context.prior_diagnosis} />
              </>
            )}
          </div>
          <aside className={styles.summary}>
            <p className={styles.eyebrow}>Your selection</p>
            <div className={styles.total}>
              {selectedCount}
              <span>saved sources</span>
            </div>
            <ul>
              {context.actions.map((a) => {
                const s = selection.actions.find(
                  (v) => v.action_id === a.action_id,
                )!;
                const reading = facts?.actions.find(
                  (v) => v.action_id === a.action_id,
                );
                const limited =
                  reading?.page?.status === "unable_to_check" ||
                  (reading?.gsc && reading.gsc.state !== "comparable") ||
                  reading?.ga4?.state === "withheld";
                return (
                  <li key={a.action_id}>
                    <strong>{a.title}</strong>
                    <span>
                      {s.page_current_id
                        ? "Page selected"
                        : "Page not selected"}{" "}
                      · {s.gsc_id ? "GSC selected" : "GSC not selected"} ·{" "}
                      {s.ga4_id ? "GA4 selected" : "GA4 not selected"}
                    </span>
                    {limited && (
                      <span>
                        Selected evidence includes a limited or withheld
                        reading.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p>
              Missing sources stay explicit. A selected but unavailable source
              must be resolved before saving.
            </p>
            <button
              type="button"
              className={styles.primary}
              disabled={locked || loadingFacts}
              onClick={() => void preview()}
            >
              {stage === "previewing"
                ? "Checking selection…"
                : "Review selection →"}
            </button>
            <p className={styles.small}>No credits used · No new report</p>
          </aside>
        </div>
      )}
      {display && ["confirming", "saving", "saved"].includes(stage) && (
        <section className={styles.confirmation}>
          <header>
            <p className={styles.eyebrow}>
              {stage === "saved"
                ? "Immutable evidence snapshot"
                : "Confirm your selection"}
            </p>
            <h2 ref={confirmationHeading} tabIndex={-1}>
              {stage === "saved"
                ? "Evidence snapshot saved."
                : "Check exactly what this review will keep."}
            </h2>
            <p>
              These versions and saved sources will not be replaced by newer
              data.
            </p>
            {stage === "saved" && (
              <>
                <p className={styles.small}>
                  {display.review_id} · {instant(display.frozen_at!)}
                </p>
                <div className={styles.outcomes}>
                  <span>Report unchanged</span>
                  <span>No new report generated</span>
                  <span>0 credits used</span>
                  {!decisionsEnabled && <span>Decision editing is not enabled</span>}
                </div>
                {decisionsEnabled && <DecisionEntry identity={identity} reviewId={display.review_id!} />}
                <a href="#selected-review-sources">
                  Inspect selected sources ↓
                </a>{" "}
                <button type="button" onClick={() => navigate({})}>
                  Prepare another snapshot
                </button>
              </>
            )}
          </header>
          <PriorReport value={display.prior_diagnosis} />
          <div id="selected-review-sources">
            {display.actions.map((a, i) => (
              <article key={a.action_id} className={styles.reviewAction}>
                <p className={styles.eyebrow}>
                  Action {String(i + 1).padStart(2, "0")} · Implementation
                  revision {display.selection.implementation.revision}
                </p>
                <h2>{a.title}</h2>
                <p className={styles.target}>{a.target}</p>
                <p className={styles.small}>
                  {a.recorded_work.state === "seo_recorded"
                    ? `Self-recorded ${a.recorded_work.implemented_on} · ${a.recorded_work.timezone}`
                    : "No implementation recorded"}{" "}
                  · No system completion attestation.
                </p>
                <EvidenceFacts action={a} />
              </article>
            ))}
          </div>
          {stage !== "saved" && (
            <footer className={styles.confirmFooter}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                I have checked the report, implementation version and selected
                sources. Save this selection without generating a report.
              </label>
              <div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setConfirmed(null);
                    setChecked(false);
                    setStage("selecting");
                  }}
                >
                  Change selection
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || !checked}
                  onClick={() => void save()}
                >
                  {saving
                    ? "Saving this request…"
                    : "Save evidence snapshot · Free"}
                </button>
              </div>
            </footer>
          )}
        </section>
      )}
      {saving && !display && <p role="status">Recovering the original save…</p>}
    </main>
  );
}
