"use client";
import {useEffect, useId, useRef, useState} from "react";
import type {ImplementationRecord, ImplementationSource} from "@/lib/implementation-records/contracts";
import {sameImplementationJson} from "@/lib/implementation-records/contracts";
import {parseCollectionContext, parseCollectionView} from "@/lib/comparison-collections/contracts";
import type {CollectionContext, CollectionSelection, CollectionView} from "@/lib/comparison-collections/types";

const button = "rounded-lg border border-[#b9cdbb] px-3 py-2 text-sm font-semibold disabled:opacity-50";
const labels = {queued: "Queued · waiting to collect", running: "Collecting the selected periods", succeeded: "Collected · qualification still required", failed: "Collection stopped · no usable result published"};
export function ComparisonCollections({record, actions, actionId, days, onUse}: {record: ImplementationRecord; actions: ImplementationSource["actions"]; actionId: string;
  days: CollectionSelection["days"]; onUse: (job: CollectionView) => Promise<boolean>}) {
  const heading = useId(), [context, setContext] = useState<CollectionContext | null>(null), [reload, setReload] = useState(0);
  const [binding, setBinding] = useState(""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const lock = useRef(false), abortRef = useRef<AbortController | null>(null), pending = useRef<{id: string; key: string} | null>(null);
  const reference = {id: record.id, revision: record.revision, checksum: record.checksum};
  const target = {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id};
  const url = `/api/v2/cases/${record.case_id}/reports/${record.report_id}/comparison-collections?deliveryRevisionId=${record.delivery_revision_id}`;
  const storageKey = `v22-collection:${record.user_id}:${record.id}:${record.revision}`;
  useEffect(() => {
    const abort = new AbortController(); abortRef.current = abort; lock.current = true; setBusy(true);
    void (async () => {
      try {
        const response = await fetch(url, {cache: "no-store", signal: abort.signal});
        const next = parseCollectionContext(await response.json(), {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id});
        if (!response.ok || !next) throw new Error("context");
        if (!abort.signal.aborted) {setContext(next); setBinding(b => next.bindings.some(item => item.id === b) ? b : next.bindings[0]?.id ?? "");}
      } catch {if (!abort.signal.aborted) setMessage("Collection status could not be loaded. Refresh status; no collection is started by refreshing.");}
      finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
    })();
    return () => abort.abort();
  }, [url, reload, record.case_id, record.report_id, record.delivery_revision_id]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const preview = context?.previews.find(p => p.action_id === actionId && p.days === days);
  const stale = !!context && !sameImplementationJson(context.implementation, reference);
  const selection: CollectionSelection = {implementation: reference, action_id: actionId, days, binding_id: binding};
  const active = context?.jobs.some(j => j.selection.binding_id === binding && ["queued", "running"].includes(j.status));
  async function collect() {
    if (lock.current || !confirmed || !preview?.elapsed || !binding || stale || active) return;
    const key = JSON.stringify(selection);
    if (!pending.current) {try {const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); if (saved?.key === key && /^[a-f0-9-]{36}$/i.test(saved.id)) pending.current = saved;} catch { /* server history also recovers requests */ }}
    if (pending.current?.key !== key) pending.current = {id: crypto.randomUUID(), key};
    const id = pending.current.id;
    try {sessionStorage.setItem(storageKey, JSON.stringify(pending.current));} catch { /* memory ID remains stable for retries */ }
    const abort = new AbortController(); abortRef.current = abort; lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(url, {method: "POST", cache: "no-store", signal: abort.signal,
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({collectionId: id, selection})});
      if (response.status === 409) {setMessage("The saved record, source or collection availability changed. Refresh status before continuing."); return;}
      const job = parseCollectionView(await response.json(), target, id, selection);
      if (!response.ok || !job) throw new Error("request");
      if (abort.signal.aborted) return;
      setContext(c => c ? {...c, jobs: [job, ...c.jobs.filter(j => j.id !== job.id)].slice(0, 20)} : c);
      setConfirmed(false); pending.current = null;
      try {sessionStorage.removeItem(storageKey);} catch { /* no private source material is stored here */ }
      setMessage("Request saved · no analysis credits used. Refresh status to check progress; nothing is retried automatically.");
    } catch {if (!abort.signal.aborted) setMessage("The response could not be confirmed. Retry with the same selections to recover this request, or refresh status. Do not start a different collection to resolve an uncertain response.");}
    finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  async function use(job: CollectionView) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {setMessage(await onUse(job) ? "Both periods selected. Review the scope above, then choose Check saved data. Selecting periods does not run a comparison." : "This collection is no longer eligible. Refresh sources and check the saved implementation revision.");}
    catch {setMessage("Sources could not be refreshed. No comparison was started.");}
    finally {lock.current = false; setBusy(false);}
  }
  return <section aria-labelledby={heading} className="space-y-4 rounded-xl border border-[#c8d8c7] bg-[#f4f8f1] p-4 sm:p-5">
    <header><p className="text-xs uppercase tracking-wide">Optional · explicitly requested</p><h4 id={heading} className="mt-1 font-semibold">Collect the exact Search Console periods</h4><p className="mt-2 text-sm">Use this when saved observations do not match your implementation window. This requests data, not a new report or an effect conclusion.</p></header>
    {context ? <fieldset disabled={busy || stale || !preview?.elapsed || !!active} className="space-y-3">
      <legend className="sr-only">Confirm a collection</legend>
      <label className="block text-sm">Confirmed Search Console property<select className="mt-1 w-full min-w-0 rounded-lg border border-[#c8d8c7] bg-white p-2" value={binding} onChange={e => {setBinding(e.target.value); setConfirmed(false);}}>
        {!context.bindings.length ? <option value="">No confirmed property available</option> : context.bindings.map(b => <option key={b.id} value={b.id}>{b.resource}</option>)}
      </select></label>
      {preview ? <><dl className="grid gap-2 text-sm sm:grid-cols-3">{(["before", "excluded", "after"] as const).map(p => <div className="rounded-lg bg-white p-3" key={p}><dt className="font-semibold capitalize">{p === "excluded" ? "Dates excluded" : p}</dt><dd>{preview.windows[p].start}<br/>{preview.windows[p].end}</dd></div>)}</dl><p className="text-xs">{days} days per period · {preview.windows.timezone} · saved implementation revision {record.revision}</p></> : null}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>Collect these two periods from the confirmed property. No analysis credits are used. Missing dates or limited rows may still prevent comparison.</span></label>
      <button className={`${button} bg-[#214532] text-white`} disabled={!confirmed || !binding || !preview} onClick={() => void collect()}>Confirm collection · free</button>
    </fieldset> : null}
    {stale ? <p role="alert" className="text-sm">A newer implementation revision exists. Reload the saved record before collecting.</p> : null}
    {preview && !preview.elapsed ? <p className="text-sm">The after window is still open. Return after {preview.windows.after.end} in America/Los_Angeles; collection will not start automatically.</p> : null}
    {active ? <p className="text-sm">A collection for this property is already queued or running. Refresh its status below.</p> : null}
    {context && !context.bindings.length ? <p className="text-sm">Confirm a property in <a href={`/cases/${record.case_id}/connections`} className="underline">Evidence &amp; connections</a> first.</p> : null}
    <button className={button} disabled={busy} onClick={() => {setMessage(""); setReload(n => n + 1);}}>Refresh collection status</button>
    {busy ? <p role="status" className="text-sm">Checking collection information…</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {context?.jobs.length ? <ul aria-label="Collection history" className="space-y-3">{context.jobs.map(job => <li key={job.id} className="min-w-0 rounded-lg border border-[#dce6d9] bg-white p-3 text-sm">
      <p className="font-semibold">{labels[job.status]}</p><p className="mt-1 break-words text-sm">{actions.find(a => a.id === job.selection.action_id)?.title ?? job.selection.action_id}</p><p className="mt-1 break-words text-xs">{job.resource} · {job.selection.days} days · record {job.selection.implementation.revision}<br/>{job.windows.before.start}–{job.windows.before.end} → {job.windows.after.start}–{job.windows.after.end}</p>
      {job.status === "failed" ? <p className="mt-2 text-xs">{job.error_code === "SYNC_BINDING_CHANGED" ? "The business or source permission changed. Review the connection before a new request." : job.error_code === "SYNC_INTERRUPTED" ? "The attempt was interrupted. It will not be repeated automatically." : "The requested data could not be saved. No partial data was published; review the connection before confirming a new request."}</p> : null}
      {job.status === "succeeded" && sameImplementationJson(job.selection.implementation, reference) ? <button disabled={busy || stale} className={`${button} mt-3`} onClick={() => void use(job)}>Use these periods in the comparison</button> : null}
    </li>)}</ul> : null}
  </section>;
}
