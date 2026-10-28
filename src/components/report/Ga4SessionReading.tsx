"use client";
import {useEffect, useId, useState} from "react";
import type {Ga4CollectionView} from "@/lib/ga4-comparison-collections/types";
import type {Ga4SessionReading as Reading} from "@/lib/ga4-session-readings/types";
import {parseSessionReading} from "@/lib/ga4-session-readings/contracts";
import {sessionReason} from "@/lib/ga4-session-readings/copy";

const button = "rounded-lg border border-[#b9cdbb] px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#214532]";
export function Ga4SessionReading({job}: {job: Ga4CollectionView}) {
  // A source change creates a fresh disclosure, never a briefly mislabeled old result.
  return <SessionDisclosure key={`${job.case_id}:${job.report_id}:${job.delivery_revision_id}:${job.id}:${job.qualification?.observation_checksum}`} job={job}/>;
}
function SessionDisclosure({job}: {job: Ga4CollectionView}) {
  const [open, setOpen] = useState(false), id = useId();
  return <div><button type="button" className={button} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
    {open ? "Hide saved session counts" : "View saved session counts"}</button>
    <div id={id}>{open ? <ReadingPanel job={job}/> : null}</div></div>;
}
function ReadingPanel({job}: {job: Ga4CollectionView}) {
  const [view, setView] = useState<Reading | null>(null), [error, setError] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setView(null); setError(false);
    void (async () => {
      try {
        const response = await fetch(`/api/v2/cases/${job.case_id}/reports/${job.report_id}/ga4-session-readings?deliveryRevisionId=${job.delivery_revision_id}&collectionId=${job.id}`, {cache: "no-store", signal: abort.signal});
        const next = parseSessionReading(await response.json(), {caseId: job.case_id, reportId: job.report_id, deliveryRevisionId: job.delivery_revision_id}, job.id, job);
        if (!response.ok || !next) throw new Error("unavailable");
        if (!abort.signal.aborted) setView(next);
      } catch {if (!abort.signal.aborted) setError(true);}
    })();
    return () => abort.abort();
  }, [job, reload]);
  return <section aria-label="Saved organic-search session counts" className="mt-4 min-w-0 space-y-4 rounded-xl border border-[#c8d8c7] bg-[#f6f8f3] p-4 sm:p-5">
    <header><h6 className="text-base font-semibold">Organic-search sessions · saved snapshot</h6>
      <p className="mt-2 text-sm leading-relaxed">Counts returned during this collection. They may change as GA4 processes data. This is not a measure of the effect of your work.</p></header>
    {!view && !error ? <p role="status">Loading saved counts…</p> : null}
    {error ? <div role="status"><p>Saved counts could not be loaded. Retry reading only; no new collection or credits are used.</p><button className={`${button} mt-2`} type="button" onClick={() => setReload(n => n+1)}>Retry reading saved counts</button></div> : null}
    {view ? <>
      <p className="break-words text-xs leading-relaxed">{view.scope.resource_id} · {view.scope.hosts.join(", ")} · {view.scope.landing_path ?? "All website landing pages"}<br/>
        Organic Search · {view.scope.timezone}<br/>Collection: {view.started_at} – {view.completed_at}</p>
      {view.state === "available" ? <dl className="grid min-w-0 gap-px overflow-hidden rounded-lg border border-[#dce6d9] bg-[#dce6d9] sm:grid-cols-2">
        {([['Before', `${view.windows.before.start} – ${view.windows.before.end}`, view.before!.toLocaleString("en-US")],
          ['After', `${view.windows.after.start} – ${view.windows.after.end}`, view.after!.toLocaleString("en-US")],
          ['Count difference', 'After minus before', `${view.difference! > 0 ? "+" : ""}${view.difference!.toLocaleString("en-US")}`],
          ['Relative change', view.relative_change_percent === null ? 'Not calculated: the before count is zero.' : 'Relative to the before count', view.relative_change_percent === null ? "Not calculated" : `${Number(view.relative_change_percent) > 0 ? "+" : ""}${view.relative_change_percent}%`]] as const).map(([label, hint, value]) => <div key={label} className="min-w-0 bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide">{label}</dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</dd><dd className="mt-2 text-xs leading-relaxed">{hint}</dd>
        </div>)}
      </dl> : <div role="status" className="rounded-lg border border-[#dce6d9] bg-white p-4"><p className="font-semibold">Saved count comparison unavailable</p>
        <p className="mt-1 text-xs">{view.windows.before.start} – {view.windows.before.end} / {view.windows.after.start} – {view.windows.after.end}</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{view.reasons.map(reason => <li key={reason}>{sessionReason[reason]}</li>)}</ul></div>}
    </> : null}
    <p className="border-t border-[#dce6d9] pt-3 text-xs leading-relaxed">Processing finality and historical measurement settings are not verified. Engagement and key-event comparisons remain unavailable. Reading this snapshot does not change your report or use credits.</p>
  </section>;
}
