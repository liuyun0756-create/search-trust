"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RefreshCw, ShieldCheck } from "lucide-react";
import {
  parseEntryCommand,
  type EntryCommand,
  type EntryView,
} from "@/lib/first-service-setup/entry-contract";
import { PlanningSettings, type PlanningStatus } from "./PlanningSettings";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#26432e] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40";
const messages = {
  discovering: [
    "Checking the market",
    "We are collecting and checking relevant competitors. You can leave this page and return to the same Case.",
  ],
  needs_competitors: [
    "No suitable competitor to confirm yet",
    "You can submit up to three websites for checking against the observed market. A submitted website is not automatically accepted.",
  ],
  awaiting_confirmation: [
    "Choose the businesses that really compete",
    "Confirm 1–3 businesses serving the same demand and area. You make the final call—not a ranking screenshot.",
  ],
  refresh_required: [
    "These market results have expired",
    "Refresh the evidence before confirming a competitor. This uses the same reserved credit and the remaining execution allowance.",
  ],
  analyzing: [
    "Preparing your first service diagnosis",
    "Your confirmed scope is saved. The public and connected evidence are being prepared for the report. No additional credit is charged.",
  ],
  completed: [
    "Your diagnosis is ready",
    "Review the findings and next actions, then prepare the client delivery.",
  ],
  failed: [
    "This analysis could not be completed",
    "The reserved credit has been returned once. Starting another analysis needs a new, explicit 1-credit confirmation.",
  ],
} as const;

export function FirstServiceEntry({
  caseId,
  ownerId,
  intakeEnabled = true,
  planningEnabled = false,
}: {
  caseId: string;
  ownerId: string;
  intakeEnabled?: boolean;
  planningEnabled?: boolean;
}) {
  const [view, setView] = useState<EntryView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false),
    [queries, setQueries] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [urls, setUrls] = useState("");
  const [pending, setPending] = useState<EntryCommand | null>(null);
  const [planning, setPlanning] = useState<PlanningStatus>({
    ready: false,
    revision: null,
  });
  const lock = useRef(false),
    version = useRef(0),
    lastDiscovery = useRef<string | null>(null),
    lastScope = useRef<string | null>(null);
  const storageKey = `searchtrust:first-service:${ownerId}:${caseId}`,
    endpoint = `/api/v2/cases/${caseId}/first-service`;
  const acceptView = useCallback(
    (next: EntryView) => {
      if (
        next.caseId !== caseId ||
        !Array.isArray(next.candidates) ||
        !Array.isArray(next.queries)
      )
        throw Error("Invalid status");
      setView(next);
      if (lastScope.current !== next.scopeHash) {
        setAccepted(false);
        setQueries(next.queries);
        lastScope.current = next.scopeHash;
      } else
        setQueries((previous) => (previous.length ? previous : next.queries));
      if (lastDiscovery.current !== next.workflow?.discoveryId) {
        setSelected([]);
        lastDiscovery.current = next.workflow?.discoveryId ?? null;
      }
    },
    [caseId],
  );
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const revision = ++version.current;
    setBusy(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      if (revision !== version.current) return;
      if (!res.ok)
        throw Error(
          data.error?.message ||
            "Status is unavailable. Your saved request has not been changed.",
        );
      acceptView(data);
      const saved = sessionStorage.getItem(storageKey),
        intent = saved ? parseEntryCommand(JSON.parse(saved)) : null;
      const w = (data as EntryView).workflow;
      const committed =
        intent &&
        w?.id === intent.workflowId &&
        (intent.action === "start" ||
          (intent.action === "confirm" &&
            ["analyzing", "completed", "failed"].includes(w.phase)) ||
          (["supplement", "refresh"].includes(intent.action) &&
            w.discoveryId !== intent.discoveryId));
      if (committed) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      } else setPending(intent);
      setError("");
    } catch (e) {
      if (revision === version.current)
        setError(e instanceof Error ? e.message : "Status is unavailable.");
    } finally {
      if (revision === version.current) setBusy(false);
    }
  }, [endpoint, storageKey, acceptView]);
  useEffect(() => {
    void refresh();
    return () => {
      version.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (
      !view?.workflow ||
      !["discovering", "analyzing"].includes(view.workflow.phase)
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [view?.workflow?.phase, refresh]);

  async function submit(action: EntryCommand["action"], retry?: EntryCommand) {
    if (
      lock.current ||
      !view ||
      (!retry && action === "start" && !intakeEnabled)
    )
      return;
    if (
      !retry &&
      planningEnabled &&
      (action === "start" || action === "confirm") &&
      !planning.ready
    ) {
      setError("Save or reload planning settings before continuing.");
      return;
    }
    if (!retry && (!view.gscSnapshotId || !view.ga4SnapshotId)) return;
    const command: EntryCommand = retry ?? {
      action,
      workflowId: action === "start" ? crypto.randomUUID() : view.workflow!.id,
      discoveryId:
        action === "start" ? crypto.randomUUID() : view.workflow!.discoveryId,
      operationId: crypto.randomUUID(),
      gscSnapshotId: view.gscSnapshotId!,
      ga4SnapshotId: view.ga4SnapshotId!,
      scopeHash: view.scopeHash,
      acceptedCredit: accepted,
      queries: action === "start" ? queries.map((q) => q.trim()) : view.queries,
      websites:
        action === "confirm"
          ? selected
          : action === "refresh"
            ? view.supplements
            : action === "supplement"
              ? urls
                  .split("\n")
                  .map((v) => v.trim())
                  .filter(Boolean)
              : [],
      ...(planningEnabled && action === "confirm" && planning.revision !== null
        ? { planningRevision: planning.revision }
        : {}),
    };
    if (!parseEntryCommand(command)) {
      setError(
        "Check the three distinct search queries and up to three valid website addresses.",
      );
      return;
    }
    lock.current = true;
    version.current++;
    setBusy(true);
    setError("");
    try {
      // Persist before sending. Storage failure means no paid request is sent.
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status < 500) {
          sessionStorage.removeItem(storageKey);
          setPending(null);
        }
        throw Error(
          data.error?.message ||
            "We could not confirm this request. Check the current status.",
        );
      }
      acceptView(data);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setAccepted(false);
      setUrls("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Check the current status before trying again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const phase = view?.workflow?.phase,
    start = !view?.workflow || phase === "failed";
  return (
    <section
      aria-labelledby="first-service-entry-title"
      className="overflow-hidden rounded-2xl border border-[#c8dac7] bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#edf4e9] p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#668a50]">
            03 / First service diagnosis
          </p>
          <h2
            id="first-service-entry-title"
            className="mt-2 text-2xl font-semibold tracking-tight"
          >
            One client. One diagnosis. One credit.
          </h2>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#bdcdbd] px-4 text-sm font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Check current status
        </button>
      </header>
      <div className="space-y-6 p-6 sm:p-8" aria-busy={busy}>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-[#e8ccb3] bg-[#fff7ed] p-4 text-sm leading-6"
          >
            {error}
          </p>
        )}
        {!view && !error && <p role="status">Checking this Case…</p>}
        {pending && (
          <aside className="rounded-xl border border-[#d7e4d2] p-4 text-sm leading-6">
            <p>
              A request is saved on this device. Check the current status first.
              Retrying keeps the same request and credit reservation.
            </p>
            <button
              className={`${button} mt-3`}
              disabled={busy}
              onClick={() => void submit(pending.action, pending)}
            >
              Retry saved request
            </button>
          </aside>
        )}
        {view && (
          <>
            {planningEnabled && (start || phase === "awaiting_confirmation") ? (
              <PlanningSettings
                key={caseId}
                caseId={caseId}
                onStatus={setPlanning}
                locked={busy || !!pending}
              />
            ) : null}
            <ol
              aria-label="First-service analysis steps"
              className="flex flex-wrap gap-4 border-b border-[#e1e9df] pb-4 text-xs font-semibold text-[#526857]"
            >
              <li aria-current={start ? "step" : undefined}>
                01 · Confirm scope & credit
              </li>
              <li
                aria-current={
                  phase &&
                  [
                    "discovering",
                    "needs_competitors",
                    "awaiting_confirmation",
                    "refresh_required",
                  ].includes(phase)
                    ? "step"
                    : undefined
                }
              >
                02 · Check competitors
              </li>
              <li
                aria-current={
                  phase && ["analyzing", "completed"].includes(phase)
                    ? "step"
                    : undefined
                }
              >
                03 · Review diagnosis
              </li>
            </ol>
            {phase && (
              <div role="status">
                <h3 className="text-xl font-semibold">{messages[phase][0]}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526857]">
                  {messages[phase][1]}
                </p>
              </div>
            )}
            {view.otherWork && (
              <p role="alert" className="text-sm">
                This Case already has other report work.{" "}
                <Link className="underline" href="/reports">
                  Open your reports
                </Link>{" "}
                instead of starting another diagnosis.
              </p>
            )}
            {!view.sourcesReady && phase !== "completed" && (
              <p className="rounded-xl bg-[#f4f7f2] p-4 text-sm leading-6">
                Before the next step, confirm the public Business Profile and
                sync healthy, matching GSC and GA4 data above. Then check the
                current status here.
              </p>
            )}
            {start && !intakeEnabled && (
              <p
                role="status"
                className="rounded-xl bg-[#f4f7f2] p-4 text-sm leading-6"
              >
                New first-service analyses are temporarily paused. You can still
                check or continue your saved analysis. No new credit is
                reserved.
              </p>
            )}
            {start && intakeEnabled && !view.otherWork && (
              <div className="grid gap-8 md:grid-cols-[1fr_0.75fr]">
                <div>
                  <h3 className="font-semibold">Search scope to check</h3>
                  <p className="mt-2 text-sm leading-6 text-[#526857]">
                    {view.service} · {view.market}. Review these suggested
                    queries before starting. Search collection currently uses
                    English, mobile results.
                  </p>
                  <div className="mt-4 space-y-3">
                    {queries.map((q, i) => (
                      <label key={i} className="block text-xs font-semibold">
                        Search query {i + 1}
                        <input
                          disabled={busy || !!pending}
                          maxLength={300}
                          value={q}
                          onChange={(e) =>
                            setQueries((a) =>
                              a.map((v, j) => (j === i ? e.target.value : v)),
                            )
                          }
                          className="mt-1 block min-h-11 w-full rounded-lg border border-[#c8dac7] bg-[#fafcf9] px-3 text-sm font-normal"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-[#f4f7f2] p-5">
                  <ShieldCheck size={22} aria-hidden="true" />
                  <p className="mt-3 text-2xl font-semibold">
                    1 credit{" "}
                    <span className="text-sm font-normal text-[#526857]">
                      · {view.creditBalance} available
                    </span>
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    Includes competitor preparation, public evidence and
                    connected-data diagnosis. No separate Prospect purchase.
                  </p>
                  <p className="mt-3 text-xs leading-6 text-[#526857]">
                    A completed diagnosis uses 1 credit even when no action is
                    supported. Technical failure returns that credit once.
                    Competitor confirmation is required; submitted websites are
                    checked, not automatically accepted.
                  </p>
                  <label className="mt-4 flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      checked={accepted}
                      disabled={busy || !!pending}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-1 size-4 accent-[#26432e]"
                    />
                    I confirm this scope and authorize the use of 1 credit.
                  </label>
                  <button
                    className={`${button} mt-4 w-full`}
                    disabled={
                      busy ||
                      !!pending ||
                      !accepted ||
                      !view.sourcesReady ||
                      view.creditBalance < 1 ||
                      (planningEnabled && !planning.ready)
                    }
                    onClick={() => void submit("start")}
                  >
                    Use 1 credit & start{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  {view.creditBalance < 1 && (
                    <Link
                      href="/pricing"
                      className="mt-3 block text-sm underline"
                    >
                      View credit options
                    </Link>
                  )}
                </div>
              </div>
            )}
            {phase === "awaiting_confirmation" && (
              <div>
                <fieldset disabled={busy || !!pending}>
                  <legend className="mb-3 text-sm font-semibold">
                    Select 1–3 relevant competitors
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {view.candidates.map((c) => (
                      <label
                        key={c.website}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selected.includes(c.website) ? "border-[#477848] bg-[#edf4e9]" : "border-[#d7e4d2]"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-[#26432e]"
                          checked={selected.includes(c.website)}
                          disabled={
                            !selected.includes(c.website) &&
                            selected.length >= 3
                          }
                          onChange={(e) =>
                            setSelected((a) =>
                              e.target.checked
                                ? [...a, c.website]
                                : a.filter((v) => v !== c.website),
                            )
                          }
                        />
                        <span>
                          <span className="block text-sm font-semibold">
                            {c.name}
                          </span>
                          <span className="mt-1 block break-all text-xs text-[#526857]">
                            {c.website}
                          </span>
                          <span className="mt-2 block text-sm leading-6">
                            {c.reason}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  className={`${button} mt-5`}
                  disabled={
                    busy ||
                    !!pending ||
                    !selected.length ||
                    !view.sourcesReady ||
                    (planningEnabled && !planning.ready)
                  }
                  onClick={() => void submit("confirm")}
                >
                  <Check size={16} aria-hidden="true" />
                  Confirm competitors & prepare report
                </button>
                <p className="mt-2 text-xs text-[#526857]">
                  Uses your reserved credit. No additional charge.
                </p>
              </div>
            )}
            {phase &&
              [
                "needs_competitors",
                "awaiting_confirmation",
                "refresh_required",
              ].includes(phase) && (
                <div className="border-t border-[#e1e9df] pt-5">
                  <p className="text-xs leading-6 text-[#526857]">
                    {view.workflow!.remainingAttempts} of 3 total executions
                    remain across discovery, technical retries, supplementation
                    and refresh. These steps do not reserve another credit.
                  </p>
                  {view.workflow!.remainingAttempts === 0 ? (
                    <p className="mt-3 rounded-lg bg-[#fff7ed] p-4 text-sm leading-6">
                      No more discovery executions are available.{" "}
                      {phase === "awaiting_confirmation"
                        ? "You can still confirm a suitable current candidate. "
                        : ""}
                      If none is usable, keep this Case and contact support
                      before starting again. No extra credit has been charged; a
                      report cannot proceed without a suitable competitor.
                    </p>
                  ) : phase === "refresh_required" ? (
                    <button
                      className={`${button} mt-3`}
                      disabled={busy || !!pending || !view.sourcesReady}
                      onClick={() => void submit("refresh")}
                    >
                      Refresh expired results · no extra credit
                    </button>
                  ) : (
                    <div className="mt-3">
                      <label className="block text-sm font-semibold">
                        Check other competitor websites
                        <textarea
                          rows={3}
                          disabled={busy || !!pending}
                          value={urls}
                          onChange={(e) => setUrls(e.target.value)}
                          placeholder={
                            "https://competitor.example/\nOne website per line, up to three"
                          }
                          className="mt-2 block w-full rounded-lg border border-[#c8dac7] p-3 text-sm font-normal"
                        />
                      </label>
                      <p className="mt-2 text-xs leading-5 text-[#526857]">
                        Only eligible businesses supported by the observed
                        market can be accepted. This is not an unrestricted
                        website lookup.
                      </p>
                      <button
                        className={`${button} mt-3`}
                        disabled={
                          busy ||
                          !!pending ||
                          !urls.trim() ||
                          !view.sourcesReady
                        }
                        onClick={() => void submit("supplement")}
                      >
                        Check websites · no extra credit
                      </button>
                    </div>
                  )}
                </div>
              )}
            {phase === "completed" && (
              <Link
                className={button}
                href={`/cases/${caseId}/reports/${view.workflow!.id}`}
              >
                Open your diagnosis <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
