"use client";
import { useEffect, useRef, useState } from "react";

type State = { job: { status: string; attempt_count: number; error_code: string | null } | null;
  snapshot: { effective_health_status: string; fetched_at: string; health_reasons: string[] } | null };
const reasons: Record<string, string> = {
  GA4_NO_CURRENT_SESSIONS: "No Analytics sessions were found in the current period.",
  GA4_NO_LANDING_PAGE_ROWS: "No landing-page rows were available.",
  GA4_NO_ACTIVITY_DATES: "No dated Analytics activity was available.",
  GA4_NO_CONFIGURED_KEY_EVENTS: "This property has no configured key events.",
  GA4_RECENT_ACTIVITY_MISSING_REVIEW: "Recent Analytics activity is missing; review the property and tracking history.",
  GA4_ACTIVITY_GAP_REVIEW: "A long activity gap needs review; this does not prove tracking code is broken.",
  GA4_CONFIGURED_KEY_EVENTS_NO_ACTIVITY: "Key events are configured but none occurred in the current period.",
  GA4_NO_ENGAGED_SESSIONS_REVIEW: "No engaged sessions were reported in the current period.",
  GA4_COMPARISON_UNAVAILABLE: "The previous comparison period has no sessions.",
  GA4_SAMPLED_DATA: "Google sampled at least one report; counts may be incomplete.",
  GA4_THRESHOLDING_APPLIED: "Google privacy thresholds apply to at least one report.",
  GA4_OTHER_ROW_DATA_LOSS: "High-cardinality values were grouped into an (other) row.",
  GA4_METRIC_RESTRICTIONS: "The connected account has metric restrictions.",
  GA4_LANDING_PAGE_TRUNCATED: "Only the top landing pages were saved.",
  GA4_KEY_EVENT_TRUNCATED: "Only the top key-event rows were saved.",
};
export function Ga4SyncControl({ caseId, bindingId, identityMatched }: { caseId: string; bindingId: string; identityMatched: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);
  const endpoint = `/api/v2/cases/${caseId}/ga4-sync`;
  const active = !!state?.job && ["queued", "running"].includes(state.job.status);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`${endpoint}?binding_id=${bindingId}`, { cache: "no-store", signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Analytics sync status could not be loaded.");
        if (abort.signal.aborted) return;
        setState(data); setError("");
        if (data.job && ["queued", "running"].includes(data.job.status)) timer = setTimeout(poll, 4000);
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Analytics sync status could not be loaded."); }
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [endpoint, bindingId, revision]);
  async function sync() {
    setBusy(true); setError(""); requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ binding_id: bindingId, request_key: requestKey.current, confirm_sync: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Analytics sync could not be requested.");
      requestKey.current = null;
      setState(previous => ({ snapshot: previous?.snapshot ?? null, job: { status: data.status, attempt_count: 0, error_code: null } }));
      setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Analytics sync could not be requested."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Google Analytics sync" className="mt-4 space-y-2 border-t pt-3 text-sm">
    <p>Sync 90 complete days of site-filtered Analytics data and the previous 90 days. No report or purchase is started.</p>
    <button disabled={busy || active || !identityMatched} onClick={sync} className="rounded-lg border px-4 py-2 disabled:opacity-40">
      {busy || active ? "GA4 sync in progress…" : state?.job?.status === "failed" ? "Retry GA4 sync" : "Sync GA4 data"}
    </button>
    {!identityMatched && <p>Confirm this Analytics property&apos;s identity before syncing.</p>}
    {active && <p role="status">{state?.job?.status === "queued" ? "Queued for the background worker." : "Collecting Analytics data."} You can leave this page.</p>}
    {state?.job?.status === "failed" && <p role="alert">The latest sync failed ({state.job.error_code}). Check authorization and the selected property, then retry. Earlier snapshots are retained.</p>}
    {state?.snapshot && <div><p>Latest snapshot: {new Date(state.snapshot.fetched_at).toLocaleString()} · {identityMatched ? state.snapshot.effective_health_status : "Identity needs confirmation"}</p>
      <ul className="list-disc pl-5">{state.snapshot.health_reasons.filter(code => reasons[code]).map(code => <li key={code}>{reasons[code]}</li>)}</ul>
      <p>Current Case hostname only; top aggregate rows only. Sampling, privacy thresholds and (other) aggregation are stated above when present.</p></div>}
    {error && <p role="alert">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Refresh status</button></p>}
  </section>;
}
