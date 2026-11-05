"use client";
import {useState} from 'react';
import type {CapabilityReport,DeliveryRevision,EditableAction} from '@/lib/report-capability/generated/types';
import {actionNeedsVerification} from '@/lib/report-capability/action-visibility';
import {replaceCandidate} from '@/lib/report-capability/candidate-editing';

type Props={report:CapabilityReport;draft:DeliveryRevision;cached:Map<string,EditableAction>;onReplace:(next:DeliveryRevision)=>void;onRestore:()=>void};
export function CapabilityCandidatePicker({report,draft,cached,onReplace,onRestore}:Props){
  const [page,setPage]=useState(0),[slots,setSlots]=useState<Record<string,number>>({});
  const candidates=report.prioritization!.candidate_order!.map(id=>report.action_candidates!.find(a=>a.id===id)!).filter(a=>!draft.actions.some(s=>s.id===a.id));
  const pages=Math.max(1,Math.ceil(candidates.length/10)),current=Math.min(page,pages-1);
  return <section aria-label="Other candidates" className="scroll-mt-28 space-y-4 rounded-xl border border-[#ccd9ce] bg-white p-5">
    <h3 className="text-xl font-semibold">Other candidates ({candidates.length})</h3>
    <p className="text-sm leading-6">Replace one existing slot. The client report contains at most three actions. Candidates below are for advisor review and do not appear in the client report.</p>
    <button type="button" className="rounded-lg border px-4 py-2" onClick={onRestore}>Restore system selection</button>
    {!draft.actions.length && <p>No selected slots are available. Candidates cannot be added to this report.</p>}
    {candidates.slice(current*10,current*10+10).map(action=>{
      const decision=report.prioritization!.candidates.find(d=>d.input.action_id===action.id)!;
      const slot=slots[action.id]??0,weak=actionNeedsVerification(report,action.id);
      const next=replaceCandidate(report,draft,action.id,slot,cached.get(action.id));
      return <article key={action.id} className="space-y-3 border-t pt-4" aria-label={action.title}>
        <h4 className="font-semibold">{action.title}</h4>
        {action.finding_ids.some(id=>report.findings.find(f=>f.id===id)?.rule_id==='v22_public.gbp_name_alignment')&&<p className="text-sm font-medium">Business name correction</p>}<p className="break-words text-sm">{action.target}</p>
        {weak && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold">Advisor only · verification needed</p>}
        <p className="text-sm">System rank {report.prioritization!.candidate_order!.indexOf(action.id)+1} · Confidence: {decision.confidence}</p>
        <p className="text-sm">Evidence: {action.finding_ids.map(id=>report.findings.find(f=>f.id===id)?.status??'not assessed').join(', ')}</p>
        <p className="text-sm leading-6">{decision.explanation}</p>
        <details><summary className="cursor-pointer">Review steps and materials</summary><ol className="list-inside list-decimal">{action.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>{action.materials.map(m=><div key={m.id} className="mt-3"><h5 className="font-medium">{m.title}</h5><p className="whitespace-pre-wrap text-sm">{m.body}</p></div>)}</details>
        {draft.actions.length>0 && <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Replace slot <select aria-label={`Slot for ${action.title}`} className="rounded-lg border p-2" value={slot} onChange={e=>setSlots({...slots,[action.id]:Number(e.target.value)})}>{draft.actions.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.title}</option>)}</select></label><button type="button" disabled={!next} className="rounded-lg border border-[#234c39] px-4 py-2 disabled:opacity-40" onClick={()=>next&&onReplace(next)}>Compare replacement</button></div>}
        {draft.actions.length>0&&!next&&<p className="text-sm text-amber-900">This slot would break a prerequisite or its order. Choose another slot or first change the selected order. Prerequisites cannot be hidden from the client.</p>}
      </article>;
    })}
    {pages>1&&<nav aria-label="Candidate pages" className="flex gap-4"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous candidates</button><span>Page {current+1} of {pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next candidates</button></nav>}
  </section>;
}
