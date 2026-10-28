"use client";

import {useState} from "react";
import {comparisonLengths, planImplementationWindow, type ComparisonLength} from "@/lib/implementation-records/comparison-window";
import type {ImplementationRecord, ImplementationSource} from "@/lib/implementation-records/contracts";

export function ComparisonWindowPreview({record, actions}: {record: ImplementationRecord; actions: ImplementationSource["actions"]}) {
  const [days, setDays] = useState<ComparisonLength>(28);
  const [now, setNow] = useState(() => new Date());
  if (!record.entries.length) return null;
  return <section aria-labelledby="comparison-window-title" className="mt-6 space-y-4 rounded-xl border border-[#dce6d9] bg-white p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#52695b]">Dates only · no data checked</p>
        <h3 id="comparison-window-title" className="font-semibold">Plan a comparison window</h3>
        <p className="text-sm text-[#52695b]">Based on saved implementation revision {record.revision}, not unsaved edits.</p>
      </div>
      <label className="text-sm">Days per window<select className="ml-2 rounded-lg border border-[#c8d8c7] bg-white p-2" value={days} onChange={e => setDays(Number(e.target.value) as ComparisonLength)}>
        {comparisonLengths.map(length => <option value={length} key={length}>{length} days</option>)}
      </select></label>
    </header>
    <div className="space-y-4">{record.entries.map(entry => {
      const window = planImplementationWindow(entry, days, now);
      return <article key={entry.action_id} className="space-y-3 rounded-lg bg-[#f6f9f4] p-4">
        <h4 className="text-sm font-semibold">{actions.find(action => action.id === entry.action_id)?.title ?? entry.action_id}</h4>
        {window ? <>
          <p className="text-xs text-[#52695b]">Planning dates in {window.timezone}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg border border-[#dce6d9] bg-white p-3"><dt className="font-semibold">Before · {days} full days</dt><dd className="mt-1">{window.before.start}<br/>to {window.before.end}</dd></div>
            <div className="rounded-lg border border-dashed border-[#bbcdb9] p-3"><dt className="font-semibold">Excluded</dt><dd className="mt-1">{entry.implemented_on}<br/><span className="text-xs">Implementation day</span></dd></div>
            <div className="rounded-lg border border-[#dce6d9] bg-white p-3"><dt className="font-semibold">After · {days} full days</dt><dd className="mt-1">{window.after.start}<br/>to {window.after.end}</dd></div>
          </dl>
          <p className="text-sm font-medium">{window.calendar_state === "waiting" ? "After window still open · wait for the full dates." : "Calendar window elapsed · source checks still pending."}</p>
        </> : <p className="text-sm">The saved date cannot be previewed safely. Check the implementation date and timezone before planning a comparison.</p>}
      </article>;
    })}</div>
    <p className="text-xs leading-relaxed text-[#52695b]">Elapsed dates do not mean data is ready. GSC and GA4 still need matching scope, source timezone, complete data and valid measurement checks. A different source timezone can require excluding an additional date. No effect is assessed here.</p>
    <div className="flex flex-wrap items-center gap-3 text-xs text-[#52695b]">
      <button type="button" className="font-medium underline underline-offset-4" onClick={() => setNow(new Date())}>Check calendar again · free</button>
      <span>No collection, analysis or credit use is started.</span>
    </div>
  </section>;
}
