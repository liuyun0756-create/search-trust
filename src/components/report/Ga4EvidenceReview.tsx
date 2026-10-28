"use client";
import {useEffect, useId, useRef, useState} from "react";
import {checkKeys, parseReviewInput, parseReviewView, validChecks} from "@/lib/ga4-evidence-reviews/contracts";
import type {Ga4ReviewInput, Ga4ReviewView, SeoChecks} from "@/lib/ga4-evidence-reviews/types";
import type {Ga4CollectionView} from "@/lib/ga4-comparison-collections/types";

const labels = {date_coverage: "Date coverage", event_history: "Historical event settings", measurement_setup: "Measurement setup"};
const hints = {
  date_coverage: "Which dates did you investigate? Note the source and what it did or did not establish. Do not turn absent rows into zero activity.",
  event_history: "Record the settings or change records you reviewed for both periods. Current settings alone do not establish historical consistency.",
  measurement_setup: "Record checks of tags, consent, contact events or tracking changes. An event is not automatically a qualified enquiry.",
};
const statuses = {not_checked: "Not checked", no_issue_found: "No issue found in my checks", issue_found: "Issue found", uncertain: "Still uncertain"};
const emptyChecks = (): SeoChecks => ({date_coverage: {status: "not_checked", note: ""}, event_history: {status: "not_checked", note: ""}, measurement_setup: {status: "not_checked", note: ""}});
const button = "rounded-lg border border-[#b9cdbb] px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function Ga4EvidenceReview({job}: {job: Ga4CollectionView}) {
  const [open, setOpen] = useState(false), [visited, setVisited] = useState(false);
  return <div><button type="button" className={button} aria-expanded={open} onClick={() => {setVisited(true); setOpen(value => !value);}}>{open ? "Hide evidence and SEO checks" : "Inspect evidence and record SEO checks"}</button>
    {/* Keep an opened draft mounted when collapsed, and load only on first opening. */}
    <div hidden={!open}>{visited ? <ReviewPanel job={job}/> : null}</div>
  </div>;
}

function ReviewPanel({job}: {job: Ga4CollectionView}) {
  const prefix = useId(), [view, setView] = useState<Ga4ReviewView | null>(null), [draft, setDraft] = useState<SeoChecks>(emptyChecks);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [pending, setPending] = useState<Ga4ReviewInput | null>(null);
  const [conflict, setConflict] = useState(false), lock = useRef(false), dirty = useRef(false), loaded = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const url = `/api/v2/cases/${job.case_id}/reports/${job.report_id}/ga4-evidence-reviews?deliveryRevisionId=${job.delivery_revision_id}&collectionId=${job.id}`;
  const target = {caseId: job.case_id, reportId: job.report_id, deliveryRevisionId: job.delivery_revision_id};
  function parse(raw: unknown, input?: Ga4ReviewInput) {
    const next = parseReviewView(raw, target, job.id, input);
    return next?.audit.observation_checksum === job.qualification?.observation_checksum ? next : null;
  }
  async function load() {
    if (lock.current) return;
    const abort = new AbortController(); abortRef.current = abort; lock.current = true; setBusy(true);
    try {
      const response = await fetch(url, {cache: "no-store", signal: abort.signal});
      const next = parse(await response.json()); if (!response.ok || !next) throw new Error("invalid");
      if (abort.signal.aborted) return;
      setView(next); setConflict(false);
      if (!loaded.current || !dirty.current) setDraft(next.reviews[0]?.checks ?? emptyChecks());
      loaded.current = true;
      setMessage(dirty.current ? "Latest saved revision loaded. Your draft is unchanged; compare it before saving a new revision." : "Saved evidence and review history loaded. No new data collected.");
    } catch {if (!abort.signal.aborted) setMessage("Could not load the evidence review. Your draft has not been changed.");}
    finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  useEffect(() => {void load(); return () => {abortRef.current?.abort(); lock.current = false;}; /* Panel is keyed to one immutable collection. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  async function save() {
    if (lock.current || !view || conflict || !validChecks(draft)) return;
    const input = pending ?? {request_id: crypto.randomUUID(), expected_revision: view.reviews[0]?.revision ?? 0,
      observation_checksum: view.audit.observation_checksum, checks: draft};
    if (!parseReviewInput(input)) return;
    setPending(input); lock.current = true; setBusy(true); setMessage("");
    const abort = new AbortController(); abortRef.current = abort;
    try {
      const response = await fetch(url, {method: "POST", cache: "no-store", signal: abort.signal,
        headers: {"Content-Type": "application/json"}, body: JSON.stringify(input)});
      if (abort.signal.aborted) return;
      if (response.status === 409) {
        setPending(null); setConflict(true); setMessage("A newer review or changed access prevented this save. Your draft is preserved. Reload the latest review before deciding what to save."); return;
      }
      const next = parse(await response.json(), input); if (!response.ok || !next) throw new Error("invalid");
      if (abort.signal.aborted) return;
      setView(next); setPending(null); dirty.current = false; setDraft(next.reviews[0].checks);
      setMessage(`SEO review revision ${next.saved!.revision} saved. ${next.reviews[0].revision > next.saved!.revision ? "A later revision is displayed below. " : ""}System evidence, report and comparison limits are unchanged. No credits used.`);
    } catch {if (!abort.signal.aborted) setMessage("Save confirmation was lost. Keep this panel open and retry the same save; it will not create a duplicate revision.");}
    finally {if (!abort.signal.aborted) {lock.current = false; setBusy(false);}}
  }
  return <section aria-label="GA4 evidence and SEO review" className="mt-4 space-y-5 border-t border-[#dce6d9] pt-4">
    {view ? <>
      <div className="space-y-3"><h6 className="font-semibold">1. System-observed evidence</h6>
        <p className="text-xs">Saved observation: {view.audit.observed_at}. Reading or reviewing it does not fetch new Google data.</p>
        <div className="grid gap-3 sm:grid-cols-2">{view.audit.coverage.map(c => <div key={c.period} className="rounded-lg bg-[#f0f5ed] p-3">
          <p className="font-semibold">{c.period === "previous" ? "Before" : "After"}: {c.returned_dates} / {c.expected_dates} dates returned</p>
          <p className="mt-1 text-xs">{c.missing_dates.length ? `No rows returned for: ${c.missing_dates.join(", ")}.` : "Every requested date has a row."}</p>
        </div>)}</div>
        <p className="text-xs">Absent rows are not assumed to be zero. Returning every date does not prove processing is complete.</p>
        <details><summary className="cursor-pointer font-semibold">Report restrictions and truncation · 6 checks</summary>
          <ul className="mt-2 space-y-2 text-xs">{view.audit.views.map(v => <li className="rounded-lg border border-[#dce6d9] p-3" key={`${v.period}:${v.view}`}>
            <strong>{v.period === "previous" ? "Before" : "After"} · {v.view.replaceAll("_", " ")}</strong>
            <p>{v.truncation_capture === "not_captured" ? "Truncation metadata was not captured in this older observation." : v.truncation_reasons.length ? "Google reported data truncation." : "No data-truncation reason was returned; this is not a completeness guarantee."}</p>
            {v.truncation_reasons.map((r, i) => <p className="break-words" key={i}>{r.type.replace("DATA_TRUNCATION_TYPE_", "").replaceAll("_", " ").toLowerCase()}{r.before_date ? ` · Data before ${r.before_date}` : ""}{r.date_ranges.map(d => ` · ${d.start}–${d.end}`).join("")}</p>)}
            <p>{[v.row_limit_reached && "Row limit / partial event list", v.sampled && "Sampled", v.thresholded && "Thresholding", v.other_row_loss && "Other-row aggregation", v.provider_empty_reason && "Provider reported an empty-result reason", v.restricted_metrics.length > 0 && `Restricted metrics: ${v.restricted_metrics.join(", ")}`].filter(Boolean).join(" · ") || "No additional restriction flags observed."}</p>
          </li>)}</ul>
        </details>
        <p className="text-xs">Key-event settings observed at {view.audit.configuration_before_at} and {view.audit.configuration_after_at}: {view.audit.configuration_change_count} differences. This is not a history of settings across the two report periods.</p>
        <p className="text-xs">Compared fields: event presence, counting method, creation time, and custom/deletable flags. Other settings are not assessed here.</p>
        {view.audit.configuration_changes.length ? <ul className="list-disc pl-5 text-xs">{view.audit.configuration_changes.map(c => <li className="break-words" key={c.event_name}>{c.event_name}: {c.change}{c.fields.length ? ` (${c.fields.join(", ")})` : ""}</li>)}{view.audit.configuration_change_count > 30 ? <li>Showing the first 30 of {view.audit.configuration_change_count} differences.</li> : null}</ul> : null}
      </div>
      <div className="space-y-3"><h6 className="font-semibold">2. Your SEO checks · separate from system evidence</h6>
        <p className="text-xs">Record what you checked and the source or dates you relied on. “No issue found” is your assessment, not system verification. Do not include passwords, tokens or personal customer details.</p>
        <fieldset disabled={busy || !!pending} className="space-y-4"><legend className="sr-only">SEO verification notes</legend>{checkKeys.map(k => <div key={k}>
          <label className="block font-semibold" htmlFor={`${prefix}-${k}`}>{labels[k]}</label>
          <select id={`${prefix}-${k}`} className="mt-1 w-full rounded-lg border p-2" value={draft[k].status} onChange={e => {dirty.current = true; setDraft(d => ({...d, [k]: {...d[k], status: e.target.value as SeoChecks[typeof k]["status"]}}));}}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label htmlFor={`${prefix}-${k}-note`} className="mt-2 block text-xs">{labels[k]} · basis and notes {draft[k].status !== "not_checked" ? "(required)" : "(optional)"}</label>
          <textarea id={`${prefix}-${k}-note`} className="mt-1 w-full rounded-lg border p-2 text-sm" rows={3} maxLength={1200} value={draft[k].note} aria-describedby={`${prefix}-${k}-help`} onChange={e => {dirty.current = true; setDraft(d => ({...d, [k]: {...d[k], note: e.target.value}}));}}/>
          <p id={`${prefix}-${k}-help`} className="text-xs">{hints[k]}</p>
        </div>)}</fieldset>
        <button type="button" className={`${button} bg-[#214532] text-white`} disabled={busy || conflict || !validChecks(draft)} onClick={() => void save()}>{pending ? "Retry the same SEO review save" : "Save SEO checks · free"}</button>
        <p className="text-xs">Each save creates a separate revision. It does not change the collected evidence or the client report.</p>
        {view.reviews.length ? <details><summary className="cursor-pointer font-semibold">Saved SEO review history · latest revision {view.reviews[0].revision}</summary>
          <ol className="mt-2 space-y-3 text-xs">{view.reviews.map(r => <li key={r.revision} className="rounded-lg border p-3"><p className="font-semibold">Revision {r.revision} · SEO recorded · {r.recorded_at}</p>{checkKeys.map(k => <p key={k} className="mt-2 whitespace-pre-wrap break-words"><strong>{labels[k]}: {statuses[r.checks[k].status]}</strong><br/>{r.checks[k].note || "No note recorded."}</p>)}</li>)}</ol>
          {view.reviews[0].revision > 20 ? <p className="text-xs">Showing the latest 20 revisions. Earlier records remain stored.</p> : null}
        </details> : null}
      </div>
      <aside className="rounded-lg bg-[#f5f3e9] p-3"><h6 className="font-semibold">3. Still unverified</h6><p className="mt-1 text-xs">GA4 processing completeness, full historical event consistency and causal effects remain unverified. SEO notes do not unlock traffic, engagement or key-event comparisons.</p></aside>
    </> : null}
    <button type="button" className={button} disabled={busy || !!pending} onClick={() => void load()}>Reload latest SEO review</button>
    {busy ? <p role="status">Loading or saving the evidence review…</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>;
}
