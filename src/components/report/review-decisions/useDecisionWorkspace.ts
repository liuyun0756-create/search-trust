"use client";
import { useEffect, useRef, useState } from "react";
import {
  requestDecision,
  DecisionError,
  accessLost,
  errorMessage,
} from "@/lib/review-decisions/client";
import { revisionFits } from "@/lib/review-decisions/contracts";
import {
  makeRequest,
  markerKey,
  readMarker,
  validateDraft,
  type Draft,
} from "@/lib/review-decisions/draft";
import type {
  Context,
  History,
  Identity,
  Revision,
  SaveDecision,
} from "@/lib/review-decisions/types";

export function useDecisionWorkspace(
  identity: Identity,
  reviewId: string,
  decisionId?: string,
) {
  const [context, setContext] = useState<Context | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [selectedVersion, setSelectedVersion] = useState<Revision | null>(null),
    [head, setHead] = useState<Revision | null>(null);
  const [draft, setDraft] = useState<Draft>({}),
    [editing, setEditing] = useState(false),
    [active, setActive] = useState(""),
    [tab, setTab] = useState<"decisions" | "history">("decisions");
  const [busy, setBusy] = useState(false),
    [stage, setStage] = useState<"loading" | "ready" | "error" | "forbidden">(
      "loading",
    ),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState(""),
    [confirming, setConfirming] = useState(false),
    [pendingId, setPendingId] = useState<string | null>(null),
    [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState(0),
    [saved, setSaved] = useState(false);
  const pending = useRef<SaveDecision | null>(null),
    gate = useRef(false),
    epoch = useRef(0),
    baseline = useRef("{}"),
    viewSequence = useRef(0);
  const key = markerKey(identity, reviewId),
    identityKey = JSON.stringify(identity);
  const dirty = editing && JSON.stringify(draft) !== baseline.current;
  function clearPending() {
    pending.current = null;
    setPendingId(null);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  function forbidden() {
    setContext(null);
    setHistory(null);
    setSelectedVersion(null);
    setHead(null);
    setDraft({});
    setEditing(false);
    setConfirming(false);
    clearPending();
    setStage("forbidden");
  }
  function handleError(e: unknown) {
    setSaved(false);
    setMessage(errorMessage(e));
    if (accessLost(e)) forbidden();
  }
  function checked(r: Revision, c: Context) {
    if (!revisionFits(r, c)) throw new DecisionError(503, "UNAVAILABLE");
    return r;
  }
  async function latest(c: Context) {
    const h = await requestDecision(identity, {
      operation: "history",
      review_id: reviewId,
    });
    const first = h.items[0],
      r = first
        ? checked(
            await requestDecision(identity, {
              operation: "read",
              review_id: reviewId,
              decision_id: first.id,
            }),
            c,
          )
        : null;
    if (
      r &&
      first &&
      (r.checksum !== first.checksum || r.revision !== first.revision)
    )
      throw new DecisionError(503, "UNAVAILABLE");
    return { h, r };
  }
  useEffect(() => {
    const run = ++epoch.current;
    gate.current = true;
    setBusy(true);
    setStage("loading");
    setContext(null);
    setHistory(null);
    setSelectedVersion(null);
    setHead(null);
    setDraft({});
    setEditing(false);
    setMessage("");
    pending.current = null;
    setPendingId(null);
    (async () => {
      try {
        const c = await requestDecision(identity, {
          operation: "context",
          review_id: reviewId,
        });
        const { h, r } = await latest(c);
        const selected = decisionId
          ? checked(
              await requestDecision(identity, {
                operation: "read",
                review_id: reviewId,
                decision_id: decisionId,
              }),
              c,
            )
          : r;
        if (run !== epoch.current) return;
        let marker = null;
        try {
          marker = readMarker(sessionStorage, identity, reviewId);
        } catch {
          setNotice(
            "Browser recovery storage is unavailable. Keep this page open while saving.",
          );
        }
        setContext(c);
        setHistory(h);
        setHead(r);
        setSelectedVersion(selected);
        setActive(c.approved[0]?.action_id ?? "");
        setTab(decisionId ? "history" : "decisions");
        setEditing(!r && !decisionId && !marker);
        baseline.current = "{}";
        if (marker) {
          setPendingId(marker.requestId);
          setMessage(
            "A previous save needs checking. Verify its result before making another decision version.",
          );
        }
        setStage("ready");
      } catch (e) {
        if (run !== epoch.current) return;
        handleError(e);
        if (!accessLost(e)) setStage("error");
      } finally {
        if (run === epoch.current) {
          gate.current = false;
          setBusy(false);
        }
      }
    })();
    return () => {
      epoch.current++;
    };
    // Page is keyed by immutable owner/case/report/review identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey, reviewId, decisionId, retry]);
  useEffect(() => {
    if (!dirty && !pendingId && !busy) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest?.("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (
        !window.confirm(
          pendingId
            ? "A save may still complete. Leave this page and check its result when you return?"
            : "Leave without saving your decision draft?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, pendingId, busy]);
  async function task(fn: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    const run = epoch.current;
    try {
      await fn();
    } catch (e) {
      if (run === epoch.current) handleError(e);
    } finally {
      if (run === epoch.current) {
        gate.current = false;
        setBusy(false);
      }
    }
  }
  async function startEditing() {
    if (pendingId) return;
    if (
      dirty &&
      !window.confirm(
        "Replace your unsaved draft with the latest saved version?",
      )
    )
      return;
    await task(async () => {
      if (!context) return;
      const { h, r } = await latest(context);
      setHistory(h);
      setHead(r);
      setSelectedVersion(r);
      const next = Object.fromEntries(
        (r?.decisions ?? []).map((d) => [d.action_id, structuredClone(d)]),
      );
      setDraft(next);
      baseline.current = JSON.stringify(next);
      setEditing(true);
      setTab("decisions");
      setConflict(false);
      setMessage("");
      setSaved(false);
      setActive(
        context.approved[0]?.action_id ?? r?.decisions[0]?.action_id ?? "",
      );
    });
  }
  async function selectVersion(id: string) {
    await task(async () => {
      if (!context) return;
      const sequence = ++viewSequence.current;
      const r = checked(
        await requestDecision(identity, {
          operation: "read",
          review_id: reviewId,
          decision_id: id,
        }),
        context,
      );
      if (sequence === viewSequence.current) {
        setSelectedVersion(r);
        setMessage("");
      }
    });
  }
  async function refreshHistory() {
    await task(async () => {
      const h = await requestDecision(identity, {
        operation: "history",
        review_id: reviewId,
      });
      setHistory(h);
      setNotice("");
    });
  }
  async function loadOlder() {
    await task(async () => {
      if (!history?.next_cursor) return;
      const page = await requestDecision(identity, {
        operation: "history",
        review_id: reviewId,
        cursor: history.next_cursor,
      });
      const last = history.items.at(-1),
        first = page.items[0];
      if (
        !first ||
        !last ||
        last.previous_id !== first.id ||
        last.revision !== first.revision + 1
      )
        throw new DecisionError(503, "UNAVAILABLE");
      setHistory({ ...page, items: [...history.items, ...page.items] });
    });
  }
  function review() {
    if (!context || pendingId || conflict || busy) return;
    const errors = validateDraft(draft, context);
    if (errors.length) {
      setMessage(errors[0].message);
      if (errors[0].actionId) setActive(errors[0].actionId);
      return;
    }
    setMessage("");
    setConfirming(true);
  }
  async function accept(r: Revision) {
    if (!context) return;
    checked(r, context);
    clearPending();
    setSelectedVersion(r);
    setHead(r);
    setEditing(false);
    setDraft({});
    baseline.current = "{}";
    setTab("history");
    setSaved(true);
    setConflict(false);
    setMessage(
      "Decision version saved. Original report unchanged. No credits used.",
    );
    // The saved receipt is authoritative even if the independent directory refresh fails.
    try {
      const h = await requestDecision(identity, {
        operation: "history",
        review_id: reviewId,
      });
      setHistory(h);
    } catch (e) {
      if (accessLost(e)) {
        handleError(e);
        return;
      }
      setNotice(
        "The version is saved. History could not refresh; retry loading the directory.",
      );
    }
  }
  async function save(recover = false) {
    if (!context || gate.current) return;
    if (!recover) {
      if (validateDraft(draft, context).length) return;
      pending.current = makeRequest(draft, context, head, crypto.randomUUID());
      setPendingId(pending.current.id);
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            ...identity,
            reviewId,
            requestId: pending.current.id,
          }),
        );
      } catch {
        setNotice(
          "Your browser cannot retain a recovery marker. Keep this page open until the save is verified.",
        );
      }
    }
    const request = pending.current;
    if (!request) return;
    setConfirming(false);
    gate.current = true;
    setBusy(true);
    try {
      await accept(
        await requestDecision(identity, { operation: "save", request }),
      );
    } catch (e) {
      if (accessLost(e)) {
        handleError(e);
      } else if (
        e instanceof DecisionError &&
        [400, 409, 413].includes(e.status)
      ) {
        clearPending();
        setConflict(e.status === 409);
        setMessage(errorMessage(e));
      } else
        setMessage(
          "Save result unknown. Do not create another request. Check this save or retry the same request.",
        );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function checkPending() {
    await task(async () => {
      if (!pendingId || !context) return;
      try {
        await accept(
          await requestDecision(identity, {
            operation: "read",
            review_id: reviewId,
            decision_id: pendingId,
          }),
        );
      } catch (e) {
        if (e instanceof DecisionError && e.status === 404) {
          // Distinguish unavailable record from lost context; absence cannot prove rollback.
          await requestDecision(identity, {
            operation: "context",
            review_id: reviewId,
          });
          setMessage(
            "This save is not visible yet. It may still complete. Check again or inspect history before proceeding.",
          );
        } else throw e;
      }
    });
  }
  async function leaveRecovery() {
    if (
      !window.confirm(
        "The previous save may still complete. Start from the latest saved version without assuming it was cancelled?",
      )
    )
      return;
    await task(async () => {
      if (!context) return;
      const { h, r } = await latest(context);
      clearPending();
      setHistory(h);
      setHead(r);
      setSelectedVersion(r);
      setDraft({});
      baseline.current = "{}";
      setEditing(false);
      setTab("history");
      setMessage(
        "Review the latest saved version before editing. An earlier request may still complete.",
      );
    });
  }
  return {
    context,
    history,
    selectedVersion,
    head,
    draft,
    setDraft: (next: Draft) => {
      setDraft(next);
      if (!conflict && !pendingId) setMessage("");
    },
    editing,
    active,
    setActive,
    tab,
    setTab,
    busy,
    stage,
    message,
    notice,
    confirming,
    setConfirming,
    pendingId,
    conflict,
    saved,
    startEditing,
    selectVersion,
    refreshHistory,
    loadOlder,
    review,
    save,
    checkPending,
    leaveRecovery,
    retry: () => setRetry((x) => x + 1),
    canRetrySave: !!pending.current,
    dirty,
  };
}
