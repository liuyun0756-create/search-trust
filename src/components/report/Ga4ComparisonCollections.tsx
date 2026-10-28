"use client";
import {useEffect, useId, useRef, useState} from "react";
import {sameImplementationJson, uuid, type ImplementationRecord} from "@/lib/implementation-records/contracts";
import {parseGa4Context, parseGa4Selection, parseGa4View, validLandingPath} from "@/lib/ga4-comparison-collections/contracts";
import type {Ga4CollectionContext, Ga4CollectionSelection, Ga4CollectionView} from "@/lib/ga4-comparison-collections/types";
import {ga4QualificationReason} from "@/lib/ga4-comparison-collections/copy";
import {Ga4EvidenceReview} from "./Ga4EvidenceReview";
import {Ga4SessionReading} from "./Ga4SessionReading";

const button = "rounded-lg border border-[#b9cdbb] px-4 py-2 text-sm font-semibold disabled:opacity-50";
const field = "mt-1 block w-full min-w-0 rounded-lg border border-[#c8d8c7] bg-white p-2 text-sm";
type Pending = {id: string; selection: Ga4CollectionSelection};
type Props = {record: ImplementationRecord; actionId: string; days: Ga4CollectionSelection["days"]; sessionReadingEnabled?: boolean};
export function Ga4ComparisonCollections({record, actionId, days, sessionReadingEnabled = false}: Props) {
  const prefix = useId(), [context, setContext] = useState<Ga4CollectionContext | null>(null), [reload, setReload] = useState(0);
  const [bindingId, setBindingId] = useState(""), [path, setPath] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [pending, setPending] = useState<Pending | null>(null);
  const lock = useRef(false), controller = useRef<AbortController | null>(null);
  const url = `/api/v2/cases/${record.case_id}/reports/${record.report_id}/ga4-comparison-collections?deliveryRevisionId=${record.delivery_revision_id}`;
  const storageKey = `ga4-collection:${record.case_id}:${record.report_id}:${record.delivery_revision_id}`;
  const reference = {id: record.id, revision: record.revision, checksum: record.checksum};
  const binding = context?.bindings.find(b => b.binding_id === bindingId);
  const preview = context?.previews.find(p => p.binding_id === bindingId && p.action_id === actionId && p.days === days);
  const stale = !!context && !sameImplementationJson(context.implementation, reference);
  const active = context?.jobs.some(j => j.selection.binding_id === bindingId && ["queued", "running"].includes(j.status));
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved && uuid(saved.id) && parseGa4Selection(saved.selection)) setPending(saved);
    } catch { /* Storage is optional; the in-memory ID still protects retries. */ }
  }, [storageKey]);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; lock.current = true; setBusy(true); setConfirmed(false); setContext(null);
    void (async () => {
      try {
        const response = await fetch(url, {cache: "no-store", signal: abort.signal});
        const next = parseGa4Context(await response.json(), {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id});
        if (!response.ok || !next) throw new Error("context");
        if (!abort.signal.aborted) {setContext(next); setBindingId(current => next.bindings.some(b => b.binding_id === current) ? current : next.bindings[0]?.binding_id ?? "");}
      } catch {if (!abort.signal.aborted) setMessage("GA4 collection details could not be loaded. Refresh below; no credits are used.");}
      finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
    })();
    return () => abort.abort();
  }, [url, reload, record.case_id, record.report_id, record.delivery_revision_id]);
  useEffect(() => {setConfirmed(false);}, [actionId, days, bindingId, path, record.checksum]);
  useEffect(() => () => controller.current?.abort(), []);
  function remember(value: Pending | null) {
    setPending(value);
    try {if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);} catch { /* Optional recovery across reloads. */ }
  }
  async function collect(recover = false) {
    if (lock.current) return;
    if (recover ? !pending : !confirmed || !binding || !preview?.elapsed || stale || active || pending || !validLandingPath(path || null)) return;
    const request: Pending = recover ? pending! : {id: crypto.randomUUID(), selection: {
      implementation: reference, action_id: actionId, days, binding_id: binding!.binding_id,
      scope_snapshot_id: binding!.scope_snapshot_id, landing_path: path || null,
    }};
    remember(request); setConfirmed(false);
    const abort = new AbortController(); controller.current = abort; lock.current = true; setBusy(true); setMessage("");
    try {
      // A lost acknowledgement reuses the exact ID and originally confirmed selection.
      const response = await fetch(url, {cache: "no-store", signal: abort.signal,
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({collectionId: request.id, selection: request.selection})});
      if (response.status === 409) {remember(null); setMessage("The record or GA4 scope changed. Refresh details and confirm the current selection again."); setReload(n => n + 1); return;}
      const next = parseGa4View(await response.json(), {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id}, request.id, request.selection);
      if (!response.ok || !next) throw new Error("response");
      if (abort.signal.aborted) return;
      setContext(current => current ? {...current, jobs: [next, ...current.jobs.filter(j => j.id !== next.id)].slice(0, 20)} : current);
      remember(null); setMessage("GA4 task saved · no credits used. Your report and implementation record are unchanged.");
    } catch {if (!abort.signal.aborted) setMessage("The response could not be confirmed. Check the saved request below before starting another collection.");}
    finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  return <section aria-labelledby={`${prefix}-heading`} className="space-y-4 rounded-xl border border-[#c8d8c7] bg-[#eef5f0] p-4">
    <header><h4 id={`${prefix}-heading`} className="font-semibold">Collect GA4 around this change</h4>
      <p className="mt-2 text-sm">Use the selected action and period length above. Collect organic-search visits for this confirmed website; a single landing path is optional. No credits used.</p></header>
    {busy ? <p role="status" className="text-sm">Loading GA4 collection details…</p> : null}
    {stale ? <p role="alert" className="text-sm">A newer implementation record exists. Reload the saved record before collecting.</p> : null}
    {context && !context.bindings.length ? <p className="text-sm">No current GA4 website scope is available. Confirm the property and refresh its data in <a className="underline" href={`/cases/${record.case_id}/connections`}>Evidence &amp; connections</a>, then refresh here.</p> : null}
    {binding ? <>
      <fieldset disabled={busy || stale || !!pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <legend className="sr-only">GA4 collection scope</legend>
        <label className="min-w-0 text-sm">Confirmed GA4 property<select className={field} value={bindingId} onChange={e => setBindingId(e.target.value)}>{context!.bindings.map(b => <option key={b.binding_id} value={b.binding_id}>{b.scope.resource_id} · {b.scope.hosts.join(", ")}</option>)}</select></label>
        <label className="text-sm">Exact landing path · optional<input className={field} value={path} maxLength={2048} placeholder="/services/repair" aria-invalid={!validLandingPath(path || null)} onChange={e => setPath(e.target.value)}/></label>
        {!validLandingPath(path || null) ? <p role="alert" className="text-sm sm:col-span-2">Enter a path starting with /, without a domain, query, fragment or spaces.</p> : null}
      </fieldset>
      <p className="break-words text-xs">Website: {binding.scope.hosts.join(", ")} · Organic Search · Property timezone: {binding.scope.timezone}<br/>Scope last observed: {binding.observed_at}. {path ? "Only the exact landing path entered above will be requested." : "All landing pages within this website will be requested."}</p>
      {preview ? <>
        <dl className="grid gap-2 text-xs sm:grid-cols-3">{([['Before', preview.windows.before], ['Implementation excluded', preview.windows.excluded], ['After', preview.windows.after]] as const).map(([label, range]) => <div key={label} className="rounded-lg bg-white p-3"><dt className="font-semibold">{label}</dt><dd className="mt-1">{range.start} – {range.end}</dd></div>)}</dl>
        {!preview.elapsed ? <p role="status" className="text-sm">Waiting for the after period to finish in {preview.windows.timezone}. No request will start yet.</p> : null}
      </> : null}
      <p className="text-xs">An elapsed window is not proof that GA4 has finished processing. This collection checks availability and limitations, not the effect of your work.</p>
      {active ? <p role="status" className="text-sm">A collection for this property is already queued or running. Refresh to check its status.</p> : null}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || stale || !!active || !!pending || !preview?.elapsed || !validLandingPath(path || null)} onChange={e => setConfirmed(e.target.checked)}/>I confirm this website, landing scope and the dates shown for this GA4 collection.</label>
      <button type="button" className={`${button} bg-[#214532] text-white`} disabled={busy || !confirmed || stale || !!active || !!pending || !preview?.elapsed || !validLandingPath(path || null)} onClick={() => void collect()}>Collect GA4 periods · free</button>
    </> : null}
    {pending ? <button type="button" disabled={busy} className={button} onClick={() => void collect(true)}>Check saved GA4 request</button> : null}
    <button type="button" disabled={busy} className={button} onClick={() => {setMessage(""); setReload(n => n + 1);}}>Refresh GA4 status</button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {context?.jobs.length ? <div className="space-y-3"><h5 className="text-sm font-semibold">Recent GA4 collections</h5>{context.jobs.map(job => <Ga4CollectionResult key={job.id} job={job} sessionReadingEnabled={sessionReadingEnabled}/>)}</div> : null}
  </section>;
}
function Ga4CollectionResult({job, sessionReadingEnabled}: {job: Ga4CollectionView; sessionReadingEnabled: boolean}) {
  const q = job.qualification;
  return <article className="space-y-2 rounded-lg border border-[#dce6d9] bg-white p-3 text-sm">
    <p className="font-semibold">{({queued: "Queued", running: "Collecting", succeeded: "Collected · review limitations", failed: "Collection could not complete"})[job.status]}</p>
    <p className="break-words text-xs">{job.scope.resource_id} · {job.scope.hosts.join(", ")} · {job.scope.landing_path ?? "All website landing pages"} · {job.selection.days} days each · implementation revision {job.selection.implementation.revision}<br/>{job.windows.before.start}–{job.windows.before.end} / {job.windows.after.start}–{job.windows.after.end} · {job.scope.timezone}</p>
    {job.status === "failed" ? <p>No comparison was published. Check the connection and current scope before confirming a new request.</p> : null}
    {q ? <>
      <ul className="list-disc space-y-1 pl-5">
        <li>Daily observations: {q.complete_daily_observations ? "all requested dates returned; this does not establish completeness." : "some requested dates were not returned."}</li>
        <li>GA4 processing completeness: not verified.</li>
        <li>Key-event settings: {q.event_configuration === "same_at_collection" ? "unchanged during this collection only." : q.event_configuration === "changed_during_collection" ? "changed during collection." : "no key-event settings observed."} Historical settings remain unverified.</li>
      </ul>
      <p>Finalized performance comparisons remain unavailable. {sessionReadingEnabled ? "Saved session counts, when eligible, are shown separately. " : ""}No uplift or causal conclusion is published.</p>
      <details><summary className="cursor-pointer text-xs font-semibold">Original metric qualification</summary><ul className="mt-2 space-y-2 text-xs">{q.metrics.map(m => <li key={m.metric} className="break-words"><strong>{m.metric.replaceAll("_", " ")}</strong> · not comparable<ul className="mt-1 list-disc pl-5">{m.reasons.map(reason => <li key={reason}>{ga4QualificationReason(reason)}</li>)}</ul></li>)}</ul></details>
      {sessionReadingEnabled ? <Ga4SessionReading job={job}/> : null}
      <Ga4EvidenceReview job={job}/>
    </> : null}
  </article>;
}
