"use client";
import { useEffect, useRef, useState } from "react";
import type { Identity } from "@/lib/review-decisions/types";
import {
  blank,
  getDecision,
  labels,
  ordered,
  validateDraft,
} from "@/lib/review-decisions/draft";
import { useDecisionWorkspace } from "./useDecisionWorkspace";
import {
  EvidenceFacts,
  PriorReport,
  instant,
} from "../review-workspace/EvidenceFacts";
import { DecisionForm } from "./DecisionForm";
import { DecisionSummary } from "./DecisionSummary";
import { SaveConfirmation } from "./SaveConfirmation";
import styles from "./decisions.module.css";
import { GenerateReview } from "./GenerateReview";

export function DecisionWorkspace({
  identity,
  reviewId,
  decisionId,
  generationEnabled = false,
}: {
  identity: Identity;
  reviewId: string;
  decisionId?: string;
  generationEnabled?: boolean;
}) {
  const w = useDecisionWorkspace(identity, reviewId, decisionId),
    [sourceAction, setSourceAction] = useState(""),
    [showErrors, setShowErrors] = useState(false);
  const error = useRef<HTMLParagraphElement>(null),
    editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (w.message && !w.saved) {
      const invalid = showErrors
        ? editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        : null;
      (invalid ?? error.current)?.focus();
    }
  }, [w.message, w.saved, w.active, showErrors]);
  const base = `/cases/${identity.caseId}/reports/${identity.reportId}`;
  const c = w.context,
    d = getDecision(w.draft, w.active),
    original = c?.approved.find((a) => a.action_id === w.active),
    isNew = d?.disposition === "new";
  const facts = c?.evidence.actions.find(
    (a) =>
      a.action_id ===
      (isNew ? sourceAction || c.approved[0]?.action_id : w.active),
  );
  function add() {
    if (!c) return;
    const id = crypto.randomUUID();
    w.setDraft({ ...w.draft, [id]: blank(id, "new") });
    w.setActive(id);
    setSourceAction(c.approved[0]?.action_id ?? "");
  }
  const rows = c
    ? [
        ...c.approved.map((a) => ({ id: a.action_id, title: a.title })),
        ...Object.values(w.draft)
          .filter((d) => d.disposition === "new")
          .map((d, i) => ({
            id: d.action_id,
            title: `New proposed work ${i + 1}`,
          })),
      ]
    : [];
  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href={base}>← Back to report</a>
        <span>/</span>
        <a href={`${base}/review-evidence?reviewId=${reviewId}`}>
          Saved evidence
        </a>
        <span>/ Your decisions</span>
      </div>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your private SEO workspace</p>
          <h1>
            The evidence stays.
            <br />
            Your judgment moves.
          </h1>
          <p>
            Review what changed, decide the next move, and keep a record of your
            reasoning.
          </p>
        </div>
        <span className={styles.badge}>Original report unchanged</span>
      </header>
      {w.stage === "loading" && (
        <p role="status" className={styles.note}>
          Loading the saved evidence and decision history…
        </p>
      )}
      {w.message && (
        <p
          role={w.saved ? "status" : "alert"}
          ref={error}
          id="decision-validation-error"
          tabIndex={-1}
          className={w.saved ? styles.success : styles.error}
        >
          {w.message}
        </p>
      )}
      {w.notice && (
        <div role="status" className={styles.note}>
          {w.notice}
          {w.saved && (
            <button disabled={w.busy} onClick={w.refreshHistory}>
              Refresh version history
            </button>
          )}
        </div>
      )}
      {w.stage === "error" && (
        <button onClick={w.retry}>Retry loading workspace</button>
      )}
      {w.stage === "forbidden" && (
        <p className={styles.note}>
          Private evidence and drafts have been cleared. Return to the report to
          check your access.
        </p>
      )}
      {c && w.stage === "ready" && (
        <>
          <div className={styles.context}>
            <span>
              Report<b>Version {c.evidence.report_version}</b>
            </span>
            <span>
              Evidence snapshot<b>{instant(c.evidence.frozen_at!)}</b>
            </span>
            <span>
              Sources<b>Read-only</b>
            </span>
            <span>
              Case website<b>{c.evidence.site_url}</b>
            </span>
          </div>
          <nav className={styles.tabs} aria-label="Decision views">
            <button
              aria-pressed={w.tab === "decisions"}
              onClick={() => w.setTab("decisions")}
            >
              Your decisions
              {w.editing ? ` · ${Object.keys(w.draft).length} selected` : ""}
            </button>
            <button
              aria-pressed={w.tab === "history"}
              onClick={() => w.setTab("history")}
            >
              Version history
            </button>
          </nav>
          {w.pendingId && (
            <section className={styles.note}>
              <b>Save result needs checking</b>
              <p>
                The original request may still complete. Check its result before
                saving a different version.
              </p>
              <div className={styles.footer}>
                <button disabled={w.busy} onClick={w.checkPending}>
                  Check this save
                </button>
                {w.canRetrySave && (
                  <button disabled={w.busy} onClick={() => w.save(true)}>
                    Retry the same request
                  </button>
                )}
                <button disabled={w.busy} onClick={w.leaveRecovery}>
                  Review latest and leave recovery
                </button>
              </div>
            </section>
          )}
          {w.conflict && (
            <div className={styles.note}>
              <button disabled={w.busy} onClick={() => w.setTab("history")}>
                Inspect saved versions
              </button>
              <button disabled={w.busy} onClick={w.startEditing}>
                Start again from latest version
              </button>
              <p>
                Your current draft remains here until you choose to replace it.
              </p>
            </div>
          )}
          {w.tab === "decisions" && w.editing ? (
            <div className={styles.workspace}>
              <aside className={styles.rail} aria-label="Actions to review">
                <p className={styles.eyebrow}>Work to review</p>
                {rows.map((a, i) => {
                  const d = getDecision(w.draft, a.id),
                    invalid = d && validateDraft({ [a.id]: d }, c).length > 0;
                  return (
                    <button
                      key={a.id}
                      aria-current={w.active === a.id ? "true" : undefined}
                      onClick={() => w.setActive(a.id)}
                    >
                      <span className={styles.eyebrow}>
                        {String(i + 1).padStart(2, "0")}
                      </span>{" "}
                      {a.title}
                      <small>
                        {d
                          ? `${labels[d.disposition]}${invalid ? " · Incomplete" : " · Draft"}`
                          : "No decision recorded"}
                      </small>
                    </button>
                  );
                })}
                <button
                  disabled={
                    w.busy ||
                    !!w.pendingId ||
                    !c.references.length ||
                    Object.values(w.draft).filter(
                      (d) => d.disposition === "new",
                    ).length >= 3
                  }
                  onClick={add}
                >
                  ＋ Propose new work
                  <small>
                    {c.references.length
                      ? "Ground it in this snapshot"
                      : "No selectable evidence"}
                  </small>
                </button>
              </aside>
              <section className={styles.panel} id="decision-evidence">
                <div className={styles.panelTop}>
                  <p className={styles.eyebrow}>01 / Frozen evidence</p>
                  <span className={styles.badge}>Read-only</span>
                </div>
                <h2>
                  {isNew
                    ? "Evidence for new work"
                    : (original?.title ?? "Original diagnosis")}
                </h2>
                <a className={styles.mobileLink} href="#decision-editor">
                  Jump to decision editor ↓
                </a>
                {isNew && (
                  <label className={styles.field}>
                    Inspect evidence from
                    <select
                      value={facts?.action_id ?? ""}
                      onChange={(e) => setSourceAction(e.target.value)}
                    >
                      {c.approved.map((a) => (
                        <option key={a.action_id} value={a.action_id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {original && (
                  <div className={styles.approved}>
                    <p className={styles.target}>{original.target}</p>
                    <h3>Approved work</h3>
                    <ol>
                      {original.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                    <h3>Completion criteria</h3>
                    <ul>
                      {original.completion.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                    <h3>Review arrangement</h3>
                    <p>{original.review}</p>
                  </div>
                )}
                {facts ? (
                  <>
                    <p className={styles.note}>
                      {facts.recorded_work.state === "seo_recorded"
                        ? `SEO-recorded implementation: ${facts.recorded_work.implemented_on} · ${facts.recorded_work.timezone}`
                        : "No implementation record for this action."}{" "}
                      System-verified completion is not established.
                    </p>
                    <EvidenceFacts action={facts} />
                    <details className={styles.originalDiagnosis}>
                      <summary>Original diagnosis and its limits</summary>
                      <PriorReport value={c.evidence.prior_diagnosis} />
                    </details>
                  </>
                ) : (
                  <PriorReport value={c.evidence.prior_diagnosis} />
                )}
              </section>
              <section
                className={styles.panel}
                ref={editor}
                id="decision-editor"
                tabIndex={-1}
              >
                <div className={styles.panelTop}>
                  <p className={styles.eyebrow}>02 / Your next decision</p>
                  <span className={styles.badge}>Unsaved draft</span>
                </div>
                <h2>What should happen next?</h2>
                <a className={styles.mobileLink} href="#decision-evidence">
                  Review evidence ↑
                </a>
                {w.active ? (
                  <DecisionForm
                    key={w.active}
                    context={c}
                    actionId={w.active}
                    decision={d}
                    showErrors={showErrors && !!w.message}
                    disabled={w.busy || !!w.pendingId}
                    onChange={(d) =>
                      w.setDraft({ ...w.draft, [d.action_id]: d })
                    }
                    onClear={() => {
                      if (
                        !window.confirm(
                          isNew
                            ? "Remove this proposed work from the draft?"
                            : "Clear this decision in the next version? Earlier saved versions stay unchanged.",
                        )
                      )
                        return;
                      const next = { ...w.draft };
                      delete next[w.active];
                      w.setDraft(next);
                      if (isNew)
                        w.setActive(
                          c.approved[0]?.action_id ??
                            Object.keys(next)[0] ??
                            "",
                        );
                    }}
                  />
                ) : (
                  <p className={styles.note}>
                    This snapshot has no approved actions. You can record an
                    empty decision version; no work will be invented.
                  </p>
                )}
                <footer className={styles.footer}>
                  <small>
                    Decisions may remain unrecorded.
                    <br />
                    Saving never edits the report.
                  </small>
                  <button
                    className={styles.primary}
                    disabled={w.busy || !!w.pendingId || w.conflict}
                    onClick={() => {
                      setShowErrors(true);
                      w.review();
                    }}
                  >
                    Review & save →
                  </button>
                </footer>
              </section>
            </div>
          ) : (
            <div className={styles.history}>
              <aside className={styles.historyList}>
                <p className={styles.eyebrow}>Saved versions</p>
                {w.history?.items.map((r) => (
                  <button
                    key={r.id}
                    aria-label={`Version ${r.revision} · ${instant(r.recorded_at)} · ${r.decision_count} decisions recorded`}
                    aria-current={
                      w.selectedVersion?.id === r.id ? "true" : undefined
                    }
                    disabled={w.busy}
                    onClick={() => w.selectVersion(r.id)}
                  >
                    <b>Version {r.revision}</b>
                    <small>
                      {instant(r.recorded_at)}
                      <br />
                      {r.decision_count} decisions recorded
                    </small>
                  </button>
                ))}
                {w.history?.next_cursor && (
                  <button disabled={w.busy} onClick={w.loadOlder}>
                    Load older versions
                  </button>
                )}
              </aside>
              <section className={styles.panel}>
                {w.selectedVersion ? (
                  <>
                    <div className={styles.panelTop}>
                      <p className={styles.eyebrow}>
                        Decision version {w.selectedVersion.revision}
                      </p>
                      <span className={styles.badge}>Read-only history</span>
                    </div>
                    <h2>Your reasoning, preserved.</h2>
                    <p>
                      Recorded {instant(w.selectedVersion.recorded_at)} · Same
                      frozen evidence snapshot.
                    </p>
                    {generationEnabled && <GenerateReview key={w.selectedVersion.id} identity={identity} revision={w.selectedVersion} />}
                    <DecisionSummary
                      context={c}
                      decisions={w.selectedVersion.decisions}
                    />
                  </>
                ) : (
                  <>
                    <h2>No decision versions yet.</h2>
                    <p>
                      The evidence snapshot is saved. Next-action decisions are
                      separate.
                    </p>
                  </>
                )}
                <footer className={styles.footer}>
                  <small>
                    Earlier versions cannot be overwritten.
                    <br />
                    New edits start from the latest saved version.
                  </small>
                  {w.editing ? (
                    <button onClick={() => w.setTab("decisions")}>
                      Return to your draft →
                    </button>
                  ) : (
                    <button
                      disabled={w.busy || !!w.pendingId}
                      className={styles.primary}
                      onClick={w.startEditing}
                    >
                      {w.selectedVersion
                        ? "Edit a new version →"
                        : "Start your decisions →"}
                    </button>
                  )}
                </footer>
              </section>
            </div>
          )}
          {w.confirming && (
            <SaveConfirmation
              context={c}
              decisions={ordered(w.draft, c)}
              onClose={() => w.setConfirming(false)}
              onSave={() => w.save()}
            />
          )}
        </>
      )}
    </main>
  );
}
