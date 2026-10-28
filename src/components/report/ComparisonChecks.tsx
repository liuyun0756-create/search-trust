"use client";
import {useEffect, useId, useRef, useState} from "react";
import type {ImplementationRecord, ImplementationSource} from "@/lib/implementation-records/contracts";
import {sameImplementationJson} from "@/lib/implementation-records/contracts";
import {parseContext, parseView} from "@/lib/comparison-checks/contracts";
import {checkLimitation, checkReason, checkStates} from "@/lib/comparison-checks/copy";
import type {ComparisonContext, ComparisonSelection, ComparisonView} from "@/lib/comparison-checks/types";
import {ComparisonCollections} from "./ComparisonCollections";
import {Ga4ComparisonCollections} from "./Ga4ComparisonCollections";
import type {CollectionView} from "@/lib/comparison-collections/types";
import {MetricReadingGuide} from "./MetricReadingGuide";

const field = "mt-1 block w-full min-w-0 rounded-lg border border-[#c8d8c7] bg-white p-2 text-sm";
const button = "rounded-lg border border-[#b9cdbb] px-4 py-2 text-sm font-semibold disabled:opacity-50";
type Props = {record: ImplementationRecord; actions: ImplementationSource["actions"]; collectionsEnabled?: boolean; ga4CollectionsEnabled?: boolean; ga4SessionReadingEnabled?: boolean};
export function ComparisonChecks({record, actions, collectionsEnabled = false, ga4CollectionsEnabled = false, ga4SessionReadingEnabled = false}: Props) {
  const prefix = useId(), [open, setOpen] = useState(false), [reload, setReload] = useState(0);
  const [context, setContext] = useState<ComparisonContext | null>(null), [view, setView] = useState<ComparisonView | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [action, setAction] = useState(record.entries[0]?.action_id ?? ""), [days, setDays] = useState<ComparisonSelection["days"]>(28);
  const [source, setSource] = useState<"gsc" | "ga4">("gsc"), [dimension, setDimension] = useState<ComparisonSelection["scope"]["dimension"]>("property"), [scopeKey, setScopeKey] = useState("");
  const [before, setBefore] = useState(""), [after, setAfter] = useState(""), [changes, setChanges] = useState<ComparisonSelection["concurrent_changes"]>("unknown");
  const lock = useRef(false), controller = useRef<AbortController | null>(null), pending = useRef<{key: string; id: string} | null>(null);
  const target = {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id};
  const url = `/api/v2/cases/${record.case_id}/reports/${record.report_id}/comparisons?deliveryRevisionId=${record.delivery_revision_id}`;
  const reference = {id: record.id, revision: record.revision, checksum: record.checksum};
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); controller.current = abort; lock.current = true; setBusy(true); setMessage("");
    void (async () => {
      try {
        const response = await fetch(url, {cache: "no-store", signal: abort.signal});
        const next = parseContext(await response.json(), {caseId: record.case_id, reportId: record.report_id, deliveryRevisionId: record.delivery_revision_id});
        if (!response.ok || !next) throw new Error("load");
        if (!abort.signal.aborted) setContext(next);
      } catch {if (!abort.signal.aborted) setMessage("Saved sources could not be loaded. Retry below; no credits are used.");}
      finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
    })();
    return () => abort.abort();
  }, [open, reload, url, record.case_id, record.report_id, record.delivery_revision_id]);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(id?: string) {
    if (lock.current) return;
    const selection: ComparisonSelection = {implementation: reference, action_id: action, days,
      scope: {source, dimension, key: dimension === "property" ? null : scopeKey.trim(), channel: source === "gsc" ? "organic_search" : "all", filters: []},
      before_snapshot_id: before || null, after_snapshot_id: after || null, concurrent_changes: changes};
    if (!id && (!context || !sameImplementationJson(context.implementation, reference) || !action || (dimension !== "property" && !scopeKey.trim()))) return;
    const key = JSON.stringify(selection);
    if (!id && pending.current?.key !== key) pending.current = {key, id: crypto.randomUUID()};
    const checkId = id ?? pending.current!.id;
    const abort = new AbortController(); controller.current = abort; lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(id ? `${url}&comparisonId=${id}` : url, {cache: "no-store", signal: abort.signal,
        ...(id ? {} : {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({comparisonId: checkId, selection})})});
      if (response.status === 409) {setMessage("The record or selected data changed. Reload sources, or reload the saved implementation record before starting another check."); return;}
      const next = parseView(await response.json(), target, checkId, id ? undefined : selection);
      if (!response.ok || !next) throw new Error("response");
      if (abort.signal.aborted) return;
      setView(next);
      if (!id) {
        pending.current = null;
        setContext(current => current ? {...current, history: [{id: next.id, implementation: next.result.implementation,
          action_id: next.result.action_id, days: next.result.windows.days, source: next.result.scope.source, state: next.result.state,
          evaluated_at: next.result.evaluated_at}, ...current.history.filter(h => h.id !== next.id)].slice(0, 20)} : current);
      }
      setMessage(id ? "Saved check opened. Its data and conclusion are unchanged." : "Check saved · no credits used. The report and implementation record are unchanged.");
    } catch {if (!abort.signal.aborted) setMessage(id ? "This saved check could not be opened. Try again." : "The response could not be confirmed. Retry without changing the selections to recover the same check; no credits are used.");}
    finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  const stale = context && !sameImplementationJson(context.implementation, reference);
  const sources = context?.sources.filter(s => s.source === source) ?? [];
  async function useCollection(job: CollectionView) {
    if (lock.current || !sameImplementationJson(job.selection.implementation, reference)) return false;
    const abort = new AbortController(); controller.current = abort; lock.current = true; setBusy(true);
    try {
    const response = await fetch(url, {cache: "no-store", signal: abort.signal});
    const next = parseContext(await response.json(), target);
    if (!response.ok || !next || !sameImplementationJson(next.implementation, reference)) return false;
    setContext(next);
    if (!next.sources.some(s => s.id === job.id && s.source === "gsc" && s.current_eligible)) return false;
    setSource("gsc"); setAction(job.selection.action_id); setDays(job.selection.days); setBefore(job.id); setAfter(job.id);
    if (dimension === "landing_page") {setDimension("property"); setScopeKey("");}
    pending.current = null;
    return true;
    } finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  return <section aria-labelledby={`${prefix}-heading`} className="mt-6 border-t border-[#dce6d9] pt-5">
    <h3 id={`${prefix}-heading`} className="text-lg font-semibold">Check the data around your change.</h3>
    <p className="mt-2 text-sm text-[#52695b]">Compare saved observations around an implementation date. Free to check; {collectionsEnabled || ga4CollectionsEnabled ? "collection requires separate confirmation below. No paid review or effect claim." : "no new collection, paid review or effect claim."}</p>
    {!open ? <button className={`${button} mt-3`} onClick={() => setOpen(true)}>Open free comparison checks</button> : <div className="mt-4 space-y-4">
      {context ? <>
        {stale ? <p role="alert">A newer implementation record is available. Reload the saved record before a new check. You can still open earlier results.</p> : null}
        <fieldset disabled={busy || !!stale || !record.entries.length} className="grid min-w-0 gap-4 rounded-xl bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">New check · implementation revision {record.revision}</legend>
          <label className="min-w-0 text-sm">Implemented action<select className={field} value={action} onChange={e => setAction(e.target.value)}>{record.entries.map(entry => <option key={entry.action_id} value={entry.action_id}>{actions.find(a => a.id === entry.action_id)?.title ?? entry.action_id}</option>)}</select></label>
          <label className="text-sm">Days in each period<select className={field} value={days} onChange={e => setDays(Number(e.target.value) as typeof days)}>{[7,14,28,90].map(n => <option key={n} value={n}>{n} days</option>)}</select></label>
          <label className="text-sm">Data source<select className={field} value={source} onChange={e => {setSource(e.target.value as typeof source); setBefore(""); setAfter(""); setDimension("property"); setScopeKey("");}}><option value="gsc">Search Console · organic search</option><option value="ga4">GA4 · all traffic (qualification check only)</option></select></label>
          <label className="text-sm">Comparison scope<select className={field} value={dimension} onChange={e => {setDimension(e.target.value as typeof dimension); setScopeKey("");}}>{(source === "gsc" ? ["property", "page", "query", "device", "country"] : ["property", "landing_page"]).map(d => <option key={d} value={d}>{d === "property" ? "Whole property" : d.replace("_", " ")}</option>)}</select></label>
          {dimension !== "property" ? <label className="text-sm sm:col-span-2">Exact scope value<input className={field} value={scopeKey} maxLength={2000} onChange={e => setScopeKey(e.target.value)} placeholder={dimension === "page" ? "Exact page URL from saved data" : "Exact value from saved data"}/></label> : null}
          {(["Before", "After"] as const).map(label => <label key={label} className="min-w-0 text-sm">{label} observation<select className={field} value={label === "Before" ? before : after} onChange={e => label === "Before" ? setBefore(e.target.value) : setAfter(e.target.value)}><option value="">Not selected · check what is missing</option>{sources.filter(s => label === "Before" || s.current_eligible).map(s => <option key={s.id} value={s.id}>{s.resource} · {s.coverage_start}–{s.coverage_end} · fetched {s.fetched_at}</option>)}</select></label>)}
          {[before, after].map((id, index) => {const selected = sources.find(s => s.id === id); return selected ? <p key={index} className="min-w-0 break-words rounded-lg bg-[#f1f6ef] p-3 text-xs"><strong>{index ? "After" : "Before"} selection</strong><br/>{selected.resource}<br/>Coverage: {selected.coverage_start}–{selected.coverage_end}<br/>Fetched: {selected.fetched_at}</p> : <span key={index}/>;})}
          <label className="text-sm sm:col-span-2">Other changes during these periods<select className={field} value={changes} onChange={e => setChanges(e.target.value as typeof changes)}><option value="unknown">Not checked yet</option><option value="reported">Other changes were reported</option><option value="none_reported">No other changes reported (not independently verified)</option></select></label>
          <p className="text-xs text-[#52695b] sm:col-span-2">Source timezone determines the windows; the implementation day or overlapping days are excluded. Whole-property movement does not establish the effect on one page. This comparison does not publish GA4 values. Saved session snapshots, where available, are a separate reading aid, not finalized performance evidence.</p>
          {!sources.length ? <p className="text-sm sm:col-span-2">No eligible saved {source.toUpperCase()} sources are listed. You can save a missing-data check, or review <a className="underline" href={`/cases/${record.case_id}/connections`}>Evidence &amp; connections</a> separately.</p> : null}
          <button className={`${button} bg-[#214532] text-white sm:col-span-2`} disabled={!action || (dimension !== "property" && !scopeKey.trim())} onClick={() => void run()}>Check saved data · free</button>
        </fieldset>
        {!record.entries.length ? <p>No implemented actions in this revision. Earlier checks remain available below.</p> : null}
      </> : null}
      {busy ? <p role="status" className="text-sm">Loading saved comparison data…</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <button disabled={busy} className={button} onClick={() => {setContext(null); setReload(n => n + 1);}}>Reload saved sources &amp; history</button>
      {collectionsEnabled && context && record.entries.length ? <ComparisonCollections key={`${action}:${days}`} record={record} actions={actions} actionId={action} days={days} onUse={useCollection}/> : null}
      {ga4CollectionsEnabled && context && record.entries.length ? <Ga4ComparisonCollections record={record} actionId={action} days={days} sessionReadingEnabled={ga4SessionReadingEnabled}/> : null}
      {view ? <ComparisonResultView view={view} actionTitle={actions.find(a => a.id === view.result.action_id)?.title ?? view.result.action_id}/> : null}
      {context ? <section aria-label="Saved comparison checks" className="rounded-xl border border-[#dce6d9] p-4">
        <h4 className="font-semibold">Saved checks · latest {context.history.length}</h4>
        <p className="mt-1 text-xs">Each check keeps its original data and implementation revision. A new check does not replace an earlier one.</p>
        <ul className="mt-3 space-y-2">{context.history.map(h => <li key={h.id}><button disabled={busy} aria-current={view?.id === h.id ? "true" : undefined} onClick={() => void run(h.id)} className="w-full rounded-lg border border-[#dce6d9] bg-white p-3 text-left text-sm aria-[current=true]:border-[#214532] aria-[current=true]:ring-1 aria-[current=true]:ring-[#214532] disabled:opacity-50">{checkStates[h.state]} · {h.days} days · {h.source.toUpperCase()}<span className="mt-1 block text-xs">{actions.find(a => a.id === h.action_id)?.title ?? h.action_id} · record {h.implementation.revision} · {h.evaluated_at}</span></button></li>)}</ul>
        {!context.history.length ? <p className="mt-2 text-sm">No checks saved yet.</p> : null}
      </section> : null}
    </div>}
  </section>;
}
export function ComparisonResultView({view, actionTitle}: {view: ComparisonView; actionTitle: string}) {
  const r = view.result;
  const number = (value: number | null, ratio = false) => value === null ? "Unavailable" : ratio ? `${(value * 100).toFixed(2)}%` : value.toLocaleString("en-US", {maximumFractionDigits: 2});
  return <article aria-label="Comparison result" className="space-y-4 rounded-xl border border-[#b9cdbb] bg-white p-4 sm:p-5">
    <header><p className="text-xs uppercase tracking-wide">Saved check · record {r.implementation.revision}</p><h4 className="mt-1 text-lg font-semibold">{checkStates[r.state]}</h4><p className="mt-1 text-sm">{actionTitle}</p><p className="mt-1 break-words text-xs">{r.scope.source.toUpperCase()} · {r.scope.dimension} · {r.scope.key ?? "Whole property"} · {r.scope.channel.replace("_", " ")}</p><p className="mt-1 text-xs">Checked {r.evaluated_at} · not live monitoring</p></header>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">{(["before", "excluded", "after"] as const).map(period => <div key={period} className="rounded-lg bg-[#f1f6ef] p-3"><dt className="font-semibold capitalize">{period === "excluded" ? "Excluded from comparison" : period}</dt><dd>{r.windows[period].start}<br/>{r.windows[period].end}</dd></div>)}</dl>
    <p className="text-xs">{r.windows.days} days per period · {r.windows.timezone}</p>
    {r.reasons.length ? <ul className="list-disc space-y-2 pl-5 text-sm">{r.reasons.map(reason => <li key={reason}>{checkReason(reason)}</li>)}</ul> : null}
    {r.metrics.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="pb-2 text-left font-semibold">Observed values · not an effect conclusion</caption><thead><tr>{["Metric", "Before", "After", "Change"].map(t => <th key={t} scope="col" className="p-2">{t}</th>)}</tr></thead><tbody>{r.metrics.map(m => <tr key={m.metric} className="border-t border-[#dce6d9]"><th scope="row" className="p-2 capitalize">{m.metric === "ctr" ? "CTR" : m.metric}</th><td className="p-2">{number(m.before, m.metric === "ctr")}</td><td className="p-2">{number(m.after, m.metric === "ctr")}</td><td className="p-2">{m.metric === "ctr" ? (m.percentage_point_change === null ? "Unavailable" : `${m.percentage_point_change.toFixed(2)} pp`) : number(m.absolute_change)}{m.relative_change !== null ? <span className="block text-xs">{number(m.relative_change, true)} relative</span> : null}{m.reasons.map(reason => <span key={reason} className="block text-xs">{checkReason(reason)}</span>)}</td></tr>)}</tbody></table></div> : null}
    <MetricReadingGuide result={r}/>
    <dl className="grid gap-3 text-xs sm:grid-cols-2">{(["before_source", "after_source"] as const).map((key, i) => <div key={key} className="min-w-0 rounded-lg border border-[#dce6d9] p-3"><dt className="font-semibold">{i ? "After" : "Before"} source</dt><dd className="mt-1 break-words">{r[key] ? <>{r[key].resource_id}<br/>Fetched: {r[key].fetched_at}<br/>Final date observed: {r[key].data_cutoff ?? "Not confirmed"}<br/>Used through: {r[key].used_through ?? "No values published"}</> : "Not selected"}</dd></div>)}</dl>
    <div className="rounded-lg bg-[#f1f6ef] p-3"><p className="text-sm font-semibold">No improvement, decline or causal effect is concluded.</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs">{r.limitations.map(text => <li key={text}>{checkLimitation(text)}</li>)}</ul></div>
  </article>;
}
