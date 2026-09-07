"use client";
import { useEffect, useRef, useState } from "react";

type State = {
  job: { status: string; attempt_count: number; error_code: string | null } | null;
  snapshot: { effective_health_status: string; fetched_at: string; expires_at: string | null; content_available: boolean; health_reasons: string[] } | null;
};

const reasons: Record<string, string> = {
  GBP_LOCATION_UNVERIFIED: "The location does not have Voice of Merchant access.",
  GBP_LOCATION_NOT_OPEN: "The location is not marked open.",
  GBP_TITLE_MISSING: "The Business Profile name is missing.",
  GBP_WEBSITE_MISSING: "The website is missing from the Business Profile.",
  GBP_PHONE_MISSING: "The primary phone number is missing.",
  GBP_PRIMARY_CATEGORY_MISSING: "The primary category is missing.",
  GBP_REGULAR_HOURS_MISSING: "Regular business hours are missing.",
  GBP_ADDRESS_AND_SERVICE_AREA_MISSING: "Both storefront address and service area are missing.",
  GBP_NO_CURRENT_IMPRESSIONS: "No Search or Maps impressions were found in the current 90-day period.",
  GBP_COMPARISON_UNAVAILABLE: "The previous 90-day period has no impressions.",
  GBP_KEYWORDS_UNAVAILABLE: "Google did not return monthly search keywords.",
  GBP_KEYWORDS_THRESHOLD_APPLIED: "Google privacy thresholds apply to some keyword counts.",
  GBP_KEYWORDS_TRUNCATED: "Only the first 1,000 monthly keyword rows were collected.",
  GBP_CONTENT_EXPIRED: "The stored Business Profile content has reached its 30-day retention limit.",
};

export function GbpSyncControl({ caseId, bindingId, identityMatched, onStateChanged }: { caseId: string; bindingId: string; identityMatched: boolean; onStateChanged?: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);
  const endpoint = `/api/v2/cases/${caseId}/gbp-sync`;
  const active = !!state?.job && ["queued", "running"].includes(state.job.status);

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`${endpoint}?binding_id=${bindingId}`, { cache: "no-store", signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Business Profile sync status could not be loaded.");
        if (abort.signal.aborted) return;
        setState(data); setError("");
        if (data.job && ["queued", "running"].includes(data.job.status)) timer = setTimeout(poll, 4000);
      } catch (value) {
        if (!abort.signal.aborted) setError(value instanceof Error ? value.message : "Business Profile sync status could not be loaded.");
      }
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
      if (!response.ok) throw new Error(data.error?.message || "Business Profile sync could not be requested.");
      requestKey.current = null;
      setState(previous => ({ snapshot: previous?.snapshot ?? null, job: { status: data.status, attempt_count: 0, error_code: null } }));
      setRevision(value => value + 1);
      onStateChanged?.();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Business Profile sync could not be requested.");
    } finally { setBusy(false); }
  }

  return <section aria-label="Google Business Profile sync" className="mt-4 space-y-2 border-t pt-3 text-sm">
    <p>Sync this location&apos;s profile, 90 complete days of Search and Maps activity, the previous 90 days, and monthly keywords. No report or purchase is started.</p>
    <p>Business Profile content is retained for no more than 30 days and then deleted.</p>
    <button disabled={busy || active || !identityMatched} onClick={sync} className="rounded-lg border px-4 py-2 disabled:opacity-40">
      {busy || active ? "Business Profile sync in progress…" : state?.job?.status === "failed" ? "Retry Business Profile sync" : "Sync Business Profile data"}
    </button>
    {!identityMatched && <p>Confirm this Business Profile location&apos;s identity before syncing.</p>}
    {active && <p role="status">{state?.job?.status === "queued" ? "Queued for the background worker." : "Collecting Business Profile data."} You can leave this page.</p>}
    {state?.job?.status === "failed" && <p role="alert">The latest sync failed ({state.job.error_code}). Check authorization and the selected location, then retry. Earlier unexpired snapshots are retained.</p>}
    {state?.snapshot && <div><p>Latest snapshot: {new Date(state.snapshot.fetched_at).toLocaleString()} · {identityMatched ? state.snapshot.effective_health_status : "Identity needs confirmation"}</p>
      {state.snapshot.expires_at && <p>{state.snapshot.content_available ? `Content expires ${new Date(state.snapshot.expires_at).toLocaleString()}.` : "Business Profile content has expired; sync again to refresh it."}</p>}
      <ul className="list-disc pl-5">{state.snapshot.health_reasons.filter(code => reasons[code]).map(code => <li key={code}>{reasons[code]}</li>)}</ul>
      <p>Only the confirmed location is read. Keyword thresholds and collection limits are stated above when present.</p></div>}
    {error && <p role="alert">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Refresh status</button></p>}
  </section>;
}
