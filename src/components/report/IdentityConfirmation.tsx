'use client';
import {useEffect,useState} from 'react';
import type {ContactCheck} from '@/lib/report-capability/generated/types';
import {modeLabels,type Mode,type Workspace,type Preview} from '@/lib/identity-review/view';
import {contactCheckLabel} from '@/lib/report-capability/reader-copy';
export function addressSummary(checks:ContactCheck[],mode:Mode|null){
 if(!mode)return 'Address check unavailable until the operating model and business profile are confirmed.';
 if(mode==='service_area'||mode==='meeting_point')return 'Street address check is not applicable to this operating model.';
 const check=checks.find(c=>c.field==='address');
 return `Street address check applies. ${check?contactCheckLabel(check):'Not checked: saved evidence cannot establish the address use.'}`;
}
export function IdentityConfirmation({caseId,reportId,endpoint,onCommitted}:{caseId:string;reportId:string;endpoint?:string;onCommitted?:(p:Preview)=>void}){
 const [workspace,setWorkspace]=useState<Workspace|null>(null),[mode,setMode]=useState<Mode|''>(''),[branch,setBranch]=useState(''),[reason,setReason]=useState(''),[customersCanVisit,setCustomersCanVisit]=useState(false),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[committed,setCommitted]=useState(false);
 const url=endpoint??`/api/v2/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}/identity-review`;
 async function call(command:Record<string,unknown>){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(command)});const value=await response.json();if(!response.ok)throw Error(response.status===409?'The report changed or this branch lacks saved details. Your choices are retained. Reload the identity workspace before trying again.':'Identity review is unavailable. Your choices are retained.');return value;}
 useEffect(()=>{let active=true;void call({operation:'workspace'}).then(v=>{if(active){setWorkspace(v);setMode(v.identity.operating_model.value??'');const current=v.identity.selected_branch_ref;setBranch(v.branches.find((b:Workspace['branches'][number])=>b.ref.split(':').slice(1).join(':')===current)?.ref??'');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[url]); // eslint-disable-line react-hooks/exhaustive-deps
 const dirty=!!workspace&&(mode!==workspace.identity.operating_model.value||branch.split(':').slice(1).join(':')!==workspace.identity.selected_branch_ref||!!reason||customersCanVisit);
 const inputClass='mt-2 w-full rounded-lg border border-[#c8d4ca] bg-white p-3';
 async function execute(operation:'preview'|'commit'|'workspace'){
  if(!workspace)return;setBusy(true);setError('');
  try{
   const result=await call(operation==='preview'?{operation,request_id:crypto.randomUUID(),base_checksum:workspace.base_checksum,expected_identity_revision:workspace.identity_revision,expected_delivery_revision:workspace.delivery_revision,selection:{operating_model:mode,branch_ref:branch,reason:reason.trim(),customers_can_visit:customersCanVisit}}:operation==='commit'?{operation,request_id:preview!.request_id}:{operation});
   if(operation==='workspace'){setWorkspace(result);setPreview(null);}else if(operation==='preview'){setPreview(result);}else{setCommitted(true);onCommitted?.(result);}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section aria-labelledby="identity-title" className="mx-auto mb-8 max-w-4xl rounded-2xl border-2 border-[#718b73] bg-[#f4f8f0] p-6 text-[#22382c]">
  <p className="text-xs font-semibold uppercase tracking-wider">Review before approving</p><h2 id="identity-title" className="mt-2 text-2xl font-semibold">Identity confirmation</h2>
  <p className="mt-3 text-sm">Confirm how the business serves customers and which Google Business Profile belongs to this location. Changes create a separate report from saved observations.</p>
  {error&&<div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">{error}<button className="ml-3 underline" disabled={busy} onClick={()=>execute('workspace')}>Reload identity workspace</button></div>}
  {!workspace&&!error&&<p role="status" className="mt-4">Loading saved identity…</p>}
  {workspace&&<>
   <p className="mt-4 rounded-lg bg-white p-3" data-testid="current-address">{workspace.identity.operating_model.confirmation_ref?addressSummary(workspace.checks,workspace.identity.operating_model.value):'Identity is not confirmed. Address check is temporarily unavailable.'}</p>
   <details className="mt-3 text-sm"><summary className="cursor-pointer">System suggestion and saved evidence</summary><p className="mt-2">Suggestion: {workspace.automatic.suggested_value?modeLabels[workspace.automatic.suggested_value]:'Needs your confirmation'}. A suggestion does not confirm customer access to an address.</p>{workspace.automatic.evidence_refs.map((e,i)=><blockquote key={i} className="mt-2 border-l-2 pl-3">{e.quote}<span className="block text-xs">{e.url}</span></blockquote>)}</details>
   <fieldset disabled={busy||committed} className="mt-5 grid gap-5 sm:grid-cols-2">
    <label className="font-medium">Operating model<select aria-label="Operating model" className={inputClass} value={mode} onChange={e=>{setMode(e.target.value as Mode);setCustomersCanVisit(false);setPreview(null);}}><option value="">Choose an operating model</option>{Object.entries(modeLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="font-medium">Google Business Profile<select aria-label="Google Business Profile" className={inputClass} value={branch} onChange={e=>{setBranch(e.target.value);setCustomersCanVisit(false);setPreview(null);}}><option value="">Choose the business profile</option>{workspace.branches.map(b=><option key={b.ref} value={b.ref}>{b.name??'Business profile'} · {b.address??'Address not supplied'}{b.available_for_reassessment?'':' · saved details required'}</option>)}</select></label>
    {(mode==='storefront'||mode==='hybrid')&&branch&&<label className="flex items-start gap-3 rounded-lg border border-[#c8d4ca] bg-white p-4 sm:col-span-2"><input type="checkbox" aria-label="Customers can visit this Google Business Profile address" className="mt-1" checked={customersCanVisit} onChange={e=>{setCustomersCanVisit(e.target.checked);setPreview(null);}}/><span>Customers can visit this Google Business Profile address<span className="mt-1 block text-sm font-normal">Confirm this only for the selected profile address. Leaving it unchecked keeps the address check unavailable.</span><span className="mt-2 block text-sm font-normal">{workspace.branches.find(b=>b.ref===branch)?.address??'No saved address is available.'}</span></span></label>}
    <label className="font-medium sm:col-span-2">Confirmation reason<textarea aria-label="Confirmation reason" required className={inputClass} value={reason} maxLength={1000} rows={2} onChange={e=>{setReason(e.target.value);setPreview(null);}} placeholder="How did you confirm the operating model and this branch?"/></label>
   </fieldset>
   {workspace.branches.length===0&&<p role="note" className="mt-3">No business profile passed the website or phone check. Identity remains unconfirmed; missing details are not evidence of a mismatch.</p>}
   {branch&&!workspace.branches.find(b=>b.ref===branch)?.available_for_reassessment&&<p role="note" className="mt-3">This branch is a verified candidate, but its full saved details are unavailable. Offline reassessment cannot use it yet.</p>}
   <p className="mt-3 text-sm">Saved observations: {workspace.evidence_as_of}. No new collection or collection credit is used for reassessment.</p>
   {dirty&&!preview&&!committed&&<p role="status" className="mt-3 font-medium">Your choices have not been applied.</p>}
   {!committed&&<button className="mt-4 rounded-lg bg-[#294d36] px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={busy||!mode||!branch||!reason.trim()||!workspace.branches.find(b=>b.ref===branch)?.available_for_reassessment} onClick={()=>execute('preview')}>{busy?'Working…':'Preview reassessment'}</button>}
   {preview&&<div className="mt-6 border-t border-[#c8d4ca] pt-5" aria-label="Reassessment comparison"><h3 className="text-lg font-semibold">Before and after</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-white p-4"><h4 className="font-semibold">Current report</h4><p className="mt-2">{addressSummary(preview.difference.before,workspace.identity.operating_model.confirmation_ref?workspace.identity.operating_model.value:null)}</p></div><div className="rounded-lg bg-white p-4"><h4 className="font-semibold">Reassessed report</h4><p className="mt-2">{modeLabels[preview.selection.operating_model]}</p><p className="mt-2" data-testid="reassessed-address">{addressSummary(preview.difference.after,preview.selection.operating_model)}</p></div></div>
    <p className="mt-3 text-sm">{preview.difference.removed_action_ids.length} previous candidates removed; {preview.difference.added_action_ids.length} new candidates added. Edited wording is not copied. Review the full new report before approval.</p>
    {preview.difference.removed_actions?.length>0&&<div className="mt-3"><h4 className="font-semibold">Removed recommendations</h4><ul className="list-disc pl-5">{preview.difference.removed_actions.map((a,i)=><li key={i}>{a.title}</li>)}</ul></div>}
    {preview.difference.added_actions?.length>0&&<div className="mt-3"><h4 className="font-semibold">Added recommendations</h4><ul className="list-disc pl-5">{preview.difference.added_actions.map((a,i)=><li key={i}>{a.title}</li>)}</ul></div>}
    <p className="mt-2 text-sm">Reassessed: {preview.difference.evaluated_at}. The original observations, approved report and existing share links are preserved.</p>
    {!committed?<button className="mt-4 rounded-lg bg-[#294d36] px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={busy} onClick={()=>execute('commit')}>Create new report for approval</button>:<div role="status" className="mt-4 rounded-lg border bg-white p-4"><strong>New report created. Approval required.</strong><p>No new client share is available until you approve this report.</p>{!onCommitted&&<a className="mt-2 inline-block underline" href={`/cases/${caseId}/reports/${preview.report.id}`}>Review and approve the new report</a>}</div>}
   </div>}
  </>}
 </section>;
}
