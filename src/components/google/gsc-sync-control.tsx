"use client";
import { useEffect, useRef, useState } from "react";

type State = { job: { status: string; attempt_count: number; error_code: string | null } | null;
  snapshot: { effective_health_status: string; fetched_at: string; health_reasons: string[] } | null };
const reasons: Record<string, string> = {
  GSC_NO_CURRENT_DATA: "No search impressions in the current period.", GSC_NO_QUERY_ROWS: "No query rows available.",
  GSC_NO_PAGE_ROWS: "No page rows available.", GSC_NO_ACTIVITY_DATES: "No dated search activity available.",
  GSC_RECENT_ACTIVITY_MISSING_REVIEW: "Recent search activity is missing; review the property and traffic history.",
  GSC_ACTIVITY_GAP_REVIEW: "A long gap in search activity needs review; this does not prove tracking is broken.",
  GSC_COMPARISON_UNAVAILABLE: "The previous comparison period has no data.", GSC_DETAIL_TRUNCATED: "Only top detail rows were saved.",
};
export function GscSyncControl({ caseId, bindingId, identityMatched }: { caseId: string; bindingId: string; identityMatched: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);
  const endpoint = `/api/v2/cases/${caseId}/gsc-sync`;
  const active = !!state?.job && ["queued", "running"].includes(state.job.status);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`${endpoint}?binding_id=${bindingId}`, { cache: "no-store", signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Sync status could not be loaded.");
        if (abort.signal.aborted) return;
        setState(data); setError("");
        if (data.job && ["queued", "running"].includes(data.job.status)) timer = setTimeout(poll, 4000);
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Sync status could not be loaded."); }
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [endpoint, bindingId, revision]);
  async function sync() {
    setBusy(true); setError("");
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ binding_id: bindingId, request_key: requestKey.current, confirm_sync: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Sync could not be requested.");
      requestKey.current = null;
      setState(previous => ({ snapshot: previous?.snapshot ?? null, job: { status: data.status, attempt_count: 0, error_code: null } }));
      setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Sync could not be requested."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Search Console sync" className="mt-4 space-y-2 border-t pt-3 text-sm">
    <p>Sync 90 days of finalized search data and the previous 90 days. No report or purchase is started.</p>
    <button disabled={busy || active || !identityMatched} onClick={sync} className="rounded-lg border px-4 py-2 disabled:opacity-40">
      {busy || active ? "GSC sync in progress…" : state?.job?.status === "failed" ? "Retry GSC sync" : "Sync GSC data"}
    </button>
    {!identityMatched && <p>Confirm this resource&apos;s identity before syncing.</p>}
    {active && <p role="status">{state?.job?.status === "queued" ? "Queued for the background worker." : "Collecting search data."} You can leave this page.</p>}
    {state?.job?.status === "failed" && <p role="alert">The latest sync failed ({state.job.error_code}). Check authorization and the selected property, then retry. Earlier snapshots are retained.</p>}
    {state?.snapshot && <div><p>Latest snapshot: {new Date(state.snapshot.fetched_at).toLocaleString()} · {identityMatched ? state.snapshot.effective_health_status : "Identity needs confirmation"}</p>
      <ul className="list-disc pl-5">{state.snapshot.health_reasons.filter(code => reasons[code]).map(code => <li key={code}>{reasons[code]}</li>)}</ul>
      <p>Top rows only; privacy filtering applies. Property-wide breakdowns are not additive.</p></div>}
    {error && <p role="alert">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Refresh status</button></p>}
  </section>;
}
