"use client";

import {useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {locationQuery} from "@/lib/review-workspace/navigation";
import {localDate, parseEntries, parseImplementationView, sameImplementationJson, type ImplementationEntry, type ImplementationView} from "@/lib/implementation-records/contracts";
import {ComparisonWindowPreview} from "./ComparisonWindowPreview";
const ComparisonChecks = dynamic(() => import("./ComparisonChecks").then(module => module.ComparisonChecks));
const PageChecks = dynamic(() => import("./PageChecks").then(module => module.PageChecks));
const ImplementationAttachments = dynamic(() => import("./ImplementationAttachments").then(module => module.ImplementationAttachments));

type Props = {caseId: string; reportId: string; deliveryRevisionId: string; ownerId?: string; attachmentsEnabled?: boolean; pageChecksEnabled?: boolean; comparisonsEnabled?: boolean; collectionsEnabled?: boolean; ga4CollectionsEnabled?: boolean; ga4SessionReadingEnabled?: boolean; reviewWorkspaceEnabled?: boolean};
const field = "mt-1 block w-full min-w-0 rounded-lg border border-[#c8d8c7] bg-white p-2 text-sm disabled:opacity-60";
function initialEntries(view: ImplementationView): ImplementationEntry[] {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return view.source.actions.map(action => view.history[0]?.entries.find(e => e.action_id === action.id) ?? {
    action_id: action.id, scope: action.target, implemented_on: "", timezone: zone, note: null, responsible: null,
  });
}
export function ImplementationRecords({caseId, reportId, deliveryRevisionId, ownerId, attachmentsEnabled = false, pageChecksEnabled = false, comparisonsEnabled = false, collectionsEnabled = false, ga4CollectionsEnabled = false, ga4SessionReadingEnabled = false, reviewWorkspaceEnabled = false}: Props) {
  const [view, setView] = useState<ImplementationView | null>(null);
  const [entries, setEntries] = useState<ImplementationEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error" | "conflict">("loading");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [showHistoryFiles, setShowHistoryFiles] = useState(false);
  const saving = useRef(false);
  const url = `/api/v2/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}/implementation?deliveryRevisionId=${encodeURIComponent(deliveryRevisionId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void (async () => {
      try {
        const response = await fetch(url, {cache: "no-store", signal: controller.signal});
        const next = parseImplementationView(await response.json(), caseId, reportId, deliveryRevisionId);
        if (!response.ok || !next) throw new Error("load");
        if (controller.signal.aborted) return;
        setView(next); setEntries(initialEntries(next)); setSelected(next.history[0]?.entries.map(e => e.action_id) ?? []);
        setState("ready"); setMessage("");
      } catch {if (!controller.signal.aborted) {setState("error"); setMessage("Implementation records could not be loaded. No report or credit balance has changed.");}}
    })();
    return () => controller.abort();
  }, [url, caseId, reportId, deliveryRevisionId, reload]);
  function update(id: string, key: keyof Omit<ImplementationEntry, "action_id">, value: string) {
    setEntries(current => current.map(entry => entry.action_id === id ? {...entry, [key]: (key === "note" || key === "responsible") && !value.trim() ? null : value} : entry));
    setMessage("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!view || saving.current || state === "conflict") return;
    const chosen = entries.filter(e => selected.includes(e.action_id));
    if (!parseEntries(chosen, view.source, new Date())) {setMessage("Check the scope, a real implementation date and timezone. Future dates are not implementation records."); return;}
    saving.current = true; setState("saving"); setMessage("");
    const expectedRevision = view.history[0]?.revision ?? 0;
    try {
      const response = await fetch(url, {method: "PUT", cache: "no-store", headers: {"Content-Type": "application/json"}, body: JSON.stringify({expectedRevision, entries: chosen})});
      if (response.status === 409) {setState("conflict"); setMessage("A newer record was saved elsewhere. Your edits are kept here. Reload the saved record and compare before saving again."); return;}
      const next = parseImplementationView(await response.json(), caseId, reportId, deliveryRevisionId);
      if (!response.ok || !next || !sameImplementationJson(next.source, view.source) || next.history[0]?.revision !== expectedRevision + 1
        || !sameImplementationJson(next.history[0].entries, chosen)) throw new Error("save");
      setView(next); setState("ready"); setMessage("Implementation record saved. No credits used; no page check or performance review started.");
    } catch {setState("error"); setMessage("Save could not be confirmed. Your edits are kept. Retry the same save to recover a lost response.");}
    finally {saving.current = false;}
  }
  const busy = state === "loading" || state === "saving";
  return <section id="implementation-records" aria-labelledby="implementation-heading" className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#dce6d9] bg-[#f6f9f4] p-5 sm:p-7">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#52695b]">After publishing · Your work record</p>
      <h2 id="implementation-heading" className="text-xl font-semibold">Record what you actually changed.</h2>
      <p className="text-sm text-[#52695b]">Choose an action, confirm the scope and enter the date it went live. Saving is free and keeps this approved report unchanged.</p>
    </header>
    <dl className="my-5 grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="font-semibold">Implementation</dt><dd>{!view ? "Not loaded" : view.history.length ? `User recorded · revision ${view.history[0].revision}` : "Not recorded yet"}</dd></div>
      <div><dt className="font-semibold">Page verification</dt><dd>Not performed by this record</dd></div>
      <div><dt className="font-semibold">Performance</dt><dd>Not assessed</dd></div>
    </dl>
    {view ? <>
      <p className="mb-4 text-sm">Pinned to approved delivery revision {view.source.deliveryRevision}. New report versions have separate records.</p>
      {view.source.actions.length ? <form onSubmit={save} className="space-y-4">
        {entries.map(entry => {
          const action = view.source.actions.find(a => a.id === entry.action_id)!;
          const checked = selected.includes(entry.action_id), prefix = `implementation-${entry.action_id}`;
          return <fieldset key={entry.action_id} disabled={busy || state === "conflict"} className="min-w-0 rounded-xl border border-[#dce6d9] bg-white p-4">
            <legend className="max-w-full px-1 text-sm font-semibold">{action.title}</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setSelected(current => e.target.checked ? [...current, entry.action_id] : current.filter(id => id !== entry.action_id))}/>I implemented this action</label>
            {checked ? <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label htmlFor={`${prefix}-scope`} className="text-sm sm:col-span-2">Actual scope<textarea id={`${prefix}-scope`} required maxLength={2000} className={field} value={entry.scope} onChange={e => update(entry.action_id, "scope", e.target.value)}/></label>
              <label htmlFor={`${prefix}-date`} className="text-sm">Date implemented<input id={`${prefix}-date`} required type="date" className={field} value={entry.implemented_on} max={(() => {try {return localDate(new Date(), entry.timezone);} catch {return undefined;}})()} onChange={e => update(entry.action_id, "implemented_on", e.target.value)}/></label>
              <label htmlFor={`${prefix}-timezone`} className="text-sm">Implementation timezone<input id={`${prefix}-timezone`} required maxLength={100} className={field} value={entry.timezone} placeholder="Europe/London" onChange={e => update(entry.action_id, "timezone", e.target.value)}/></label>
              <label htmlFor={`${prefix}-person`} className="text-sm">Responsible person · optional<input id={`${prefix}-person`} maxLength={200} className={field} value={entry.responsible ?? ""} onChange={e => update(entry.action_id, "responsible", e.target.value)}/></label>
              <label htmlFor={`${prefix}-note`} className="text-sm">What changed · optional<textarea id={`${prefix}-note`} maxLength={2000} className={field} value={entry.note ?? ""} onChange={e => update(entry.action_id, "note", e.target.value)}/></label>
            </div> : null}
          </fieldset>;
        })}
        <p className="text-xs text-[#52695b]">Unchecking an action corrects the current record. Earlier revisions remain available. Dates are supplied by you, not observed by SearchTrust.</p>
        <button type="submit" disabled={busy || state === "conflict" || (!selected.length && !view.history.length)} className="rounded-lg bg-[#214532] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{state === "saving" ? "Saving…" : "Save implementation record · free"}</button>
      </form> : <p className="text-sm">This report has no proposed actions to mark as implemented. The diagnosis remains available.</p>}
      {attachmentsEnabled && ownerId ? view.history[0] ? <div className="mt-5 space-y-4">
        <h3 className="text-sm font-semibold">Files for the saved implementation record</h3>
        <p className="text-xs text-[#52695b]">Files attach to saved revision {view.history[0].revision}, not to unsaved edits above.</p>
        {view.history[0].entries.map(entry=><div key={entry.action_id}><p className="text-sm font-medium">{view.source.actions.find(a=>a.id===entry.action_id)?.title}</p>
          <ImplementationAttachments ownerId={ownerId} target={{caseId,reportId,deliveryRevisionId,recordId:view.history[0].id,revision:view.history[0].revision,checksum:view.history[0].checksum,actionId:entry.action_id}}/>
        </div>)}
      </div> : <p className="mt-4 text-xs text-[#52695b]">Save the implementation record before adding files.</p> : null}
      {view.history[0] ? comparisonsEnabled
        ? <ComparisonChecks key={view.history[0].checksum} record={view.history[0]} actions={view.source.actions} collectionsEnabled={collectionsEnabled} ga4CollectionsEnabled={ga4CollectionsEnabled} ga4SessionReadingEnabled={ga4SessionReadingEnabled}/>
        : <ComparisonWindowPreview key={view.history[0].checksum} record={view.history[0]} actions={view.source.actions}/> : null}
      {view.history.length ? <details onToggle={e=>setShowHistoryFiles(e.currentTarget.open)} className="mt-5 border-t border-[#dce6d9] pt-4"><summary className="cursor-pointer text-sm font-semibold">Record history · latest {view.history.length} revisions</summary>
        <ol className="mt-3 space-y-3 text-sm">{view.history.map(record => <li key={record.revision} className="rounded-lg bg-white p-3">
          <p className="font-semibold">Revision {record.revision} · recorded {record.recorded_at} (UTC)</p>
          {record.entries.length ? record.entries.map(entry => <p key={entry.action_id} className="mt-1 break-words">{view.source.actions.find(a => a.id === entry.action_id)?.title}: {entry.implemented_on} · {entry.timezone} · {entry.scope}{entry.note ? ` · ${entry.note}` : ""}</p>) : <p>No actions currently marked as implemented.</p>}
          {showHistoryFiles && attachmentsEnabled && ownerId && record.revision!==view.history[0]?.revision ? record.entries.map(entry=><ImplementationAttachments key={entry.action_id} ownerId={ownerId} readOnly target={{caseId,reportId,deliveryRevisionId,recordId:record.id,revision:record.revision,checksum:record.checksum,actionId:entry.action_id}}/>) : null}
        </li>)}</ol>
      </details> : null}
    </> : null}
    {pageChecksEnabled && ownerId ? <PageChecks key={view?.history[0]?.checksum ?? "no-record"} ownerId={ownerId} caseId={caseId} reportId={reportId} deliveryRevisionId={deliveryRevisionId}/> : null}
    {reviewWorkspaceEnabled && view ? <section className="mt-6 rounded-xl border border-[#c8d8c7] bg-white p-5">
      <h3 className="font-semibold">Bring saved evidence into one review.</h3>
      {view.history[0] ? <><p className="my-3 text-sm">Approved delivery {view.source.deliveryRevision} · Saved implementation {view.history[0].revision}. Unsaved edits above are not included. Choose evidence, confirm its scope and save a snapshot. No credits used; no new report generated.</p>
        <Link className="inline-block rounded-lg bg-[#214532] px-4 py-3 text-sm font-semibold text-white" href={`/cases/${caseId}/reports/${reportId}/review-evidence${locationQuery({target:{delivery_id:deliveryRevisionId,implementation_id:view.history[0].id,implementation_revision:view.history[0].revision}})}`}>Prepare review evidence →</Link></>
      : <p className="my-3 text-sm">Save an implementation record before preparing review evidence.</p>}
      <Link className="mt-3 block text-sm underline underline-offset-4" href={`/cases/${caseId}/reports/${reportId}/review-evidence`}>Choose another version or view saved snapshots</Link>
    </section> : null}
    {state === "loading" ? <p role="status" className="mt-4 text-sm">Loading implementation records…</p> : null}
    {message ? <p role={state === "error" || state === "conflict" ? "alert" : "status"} className="mt-4 text-sm">{message}</p> : null}
    {!busy ? <button type="button" className="mt-4 text-sm underline underline-offset-4" onClick={() => setReload(n => n + 1)}>{view ? "Reload saved record (discard local edits)" : "Retry loading records"}</button> : null}
  </section>;
}
