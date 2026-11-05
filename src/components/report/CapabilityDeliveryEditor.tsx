"use client";

import { useEffect, useRef, useState } from "react";
import type { CapabilityReport, DeliveryRevision, EditableAction } from "@/lib/report-capability/generated/types";
import { validDeliveryOrder, type DeliveryOrderConstraints } from "@/lib/report-capability/order";

import {CapabilityCandidatePicker} from './CapabilityCandidatePicker';
import {editableCandidate,normalizeSelection,selectionDependenciesValid,technicalOmissionConfirmation} from '@/lib/report-capability/candidate-editing';
import {actionNeedsVerification} from '@/lib/report-capability/action-visibility';

export type CapabilitySaveResult = { ok: true; revision: number; content: DeliveryRevision }
  | { ok: false; code: "CAPABILITY_CONFLICT" | "CAPABILITY_INVALID" | "CAPABILITY_UNAVAILABLE" };
type Props = { candidateReport?:CapabilityReport; initial: DeliveryRevision; onSave: (content: DeliveryRevision) => Promise<CapabilitySaveResult>; orderConstraints?:DeliveryOrderConstraints };
const fieldClass = "mt-2 w-full rounded-lg border border-[#ccd9ce] bg-white p-3 text-[#1d2a22] disabled:opacity-60";
const lines = (value: string): [string, ...string[]] => {
  const [first = "", ...rest] = value.split("\n");
  return [first, ...rest];
};

/** The mounting server route must authenticate and bind onSave to its Case/report. */
export function CapabilityDeliveryEditor({ initial, onSave, orderConstraints, candidateReport }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const saving = useRef(false);
  const cached=useRef(new Map<string,EditableAction>());
  const [pending,setPending]=useState<{next:DeliveryRevision;stage:'compare'|'warning'}|null>(null);
  const modal=useRef<HTMLDialogElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const saved=useRef(JSON.stringify(initial));
  useEffect(()=>{
    if(!candidateReport || JSON.stringify(draft)===saved.current)return;
    const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const navigate=(event:MouseEvent)=>{
      const link=event.target instanceof Element?event.target.closest('a[href]'):null;
      if(!(link instanceof HTMLAnchorElement)||link.target==='_blank'||link.hasAttribute('download')||link.href===window.location.href||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      if(!window.confirm('Leave without saving your delivery edits?')){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',guard);document.addEventListener('click',navigate,true);
    return()=>{window.removeEventListener('beforeunload',guard);document.removeEventListener('click',navigate,true);};
  },[draft,candidateReport]);
  useEffect(()=>{if(pending){if(!returnFocus.current)returnFocus.current=document.activeElement as HTMLElement;if(modal.current?.showModal)modal.current.showModal();else modal.current?.setAttribute('open','');modal.current?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});if(modal.current)modal.current.scrollTop=0;}else{modal.current?.close?.();returnFocus.current?.focus({preventScroll:true});returnFocus.current=null;}},[pending]);
  function acceptSelection(next:DeliveryRevision){
    for(const action of draft.actions)cached.current.set(action.id,structuredClone(action));
    setDraft(next);setReviewed(false);setPending(null);setMessage('Selection changed. Save and approve a new revision for client delivery.');
  }
  function requestSelection(next:DeliveryRevision,compare=false){
    if(!candidateReport){setDraft(next);setReviewed(false);return;}
    next=normalizeSelection(next);
    if(!selectionDependenciesValid(candidateReport,next)){setMessage('Keep every prerequisite selected and visible before its dependent action.');return;}
    const confirmation=technicalOmissionConfirmation(candidateReport,next);
    if(compare)setPending({next,stage:'compare'});
    else if(confirmation && JSON.stringify(confirmation)!==JSON.stringify(draft.technical_omission_confirmation))setPending({next,stage:'warning'});
    else acceptSelection({...next,...(confirmation?{technical_omission_confirmation:confirmation}:{})});
  }
  function finishComparison(){
    if(!pending || !candidateReport)return;
    const confirmation=technicalOmissionConfirmation(candidateReport,pending.next);
    if(confirmation)setPending({...pending,stage:'warning'});else acceptSelection(pending.next);
  }
  function restoreSelection(){
    if(!candidateReport)return;
    const actions=candidateReport.actions.map(a=>draft.actions.find(s=>s.id===a.id)??cached.current.get(a.id)??editableCandidate(a)) as DeliveryRevision['actions'];
    requestSelection({...draft,actions,client_action_ids:actions.filter(a=>!actionNeedsVerification(candidateReport,a.id)).map(a=>a.id) as DeliveryRevision['client_action_ids']},true);
  }
  const restoreOrder=orderConstraints?.actions.filter(a=>draft.actions.some(s=>s.id===a.id)).map(a=>a.id)??[];

  function moved(index:number,delta:number){const next=[...draft.actions];const to=index+delta;
    if(to<0||to>=next.length)return null;[next[index],next[to]]=[next[to],next[index]];
    return !orderConstraints||!validDeliveryOrder(next.map(a=>a.id),orderConstraints)||(candidateReport&&!selectionDependenciesValid(candidateReport,{...draft,actions:next as DeliveryRevision["actions"]}))?null:next;
  }
  function reorder(actions:DeliveryRevision["actions"][number][]){
    if(candidateReport){requestSelection({...draft,actions:actions as DeliveryRevision["actions"]});return;}
    setDraft(current=>({...current,actions:actions as DeliveryRevision["actions"]}));setReviewed(false);setMessage("Order changed. Review and save this delivery; the system recommendation stays unchanged.");
  }
  const actionChange = (index: number, patch: Partial<DeliveryRevision["actions"][number]>) => {
    setDraft((current) => ({ ...current, actions: current.actions.map((a, i) => i === index ? { ...a, ...patch } : a) as DeliveryRevision["actions"] }));
    setMessage("");
  };
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopyMessage(`${label} copied.`); }
    catch { setCopyMessage("Copy failed. Select the text and copy it manually."); }
  }
  async function save(status: DeliveryRevision["status"]) {
    if (saving.current || conflict || !ready || (status === "approved" && !reviewed)) return;
    saving.current = true; setBusy(true); setMessage("");
    const submitted = { ...draft, status };
    if(orderConstraints&&!validDeliveryOrder(submitted.actions.map(a=>a.id),orderConstraints)){
      saving.current=false;setBusy(false);setMessage("Keep prerequisite checks before the work that depends on them.");return;
    }
    try {
      const result = await onSave(submitted);
      if (!result.ok) {
        if (result.code === "CAPABILITY_CONFLICT") {
          setConflict(true);
          setMessage("A newer revision was saved elsewhere. Your edits are still here. Copy them before reloading and comparing the latest revision.");
        } else setMessage(result.code === "CAPABILITY_INVALID" ? "Check the required fields and text limits. Your edits have been kept." : "Could not save. Your edits have been kept; please retry.");
        return;
      }
      if (result.revision !== submitted.expected_revision + 1 || result.content.report_id !== submitted.report_id
        || result.content.expected_revision !== submitted.expected_revision || result.content.status !== status) {
        setMessage("Could not confirm the saved revision. Your edits have been kept; reload only after copying them.");
        return;
      }
      const next={ ...structuredClone(result.content), expected_revision: result.revision };
      saved.current=JSON.stringify(next);setDraft(next);
      setReviewed(false);
      setMessage(status === "approved" ? `Revision ${result.revision} approved for delivery.` : `Draft revision ${result.revision} saved. Not approved for delivery.`);
    } catch { setMessage("Could not save. Your edits have been kept; please retry."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section aria-label="Review delivery content" className="space-y-6 rounded-2xl border border-[#dce6d9] bg-[#f5f8f3] p-5 sm:p-8">
    <header><h2 className="text-2xl font-semibold">Review your client delivery</h2>
      <p className="mt-2 leading-7">Approve the report as it is, or adapt the summary, proposed work and materials. Original observations stay unchanged.</p>
      <p className="mt-2 text-sm">Changing a target or scope does not verify the new scope. Record your own business information in the client note; it is not collected evidence.</p></header>
    <fieldset disabled={busy || conflict || !ready} className="space-y-5" onChangeCapture={() => setReviewed(false)}>
      <legend className="sr-only">Optional delivery edits</legend>
      <label className="block font-medium">Report title<input className={fieldClass} value={draft.title} maxLength={200} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setMessage(""); }} /></label>
      <label className="block font-medium">Client summary<textarea className={fieldClass} value={draft.summary} maxLength={2000} rows={5} onChange={(e) => { setDraft({ ...draft, summary: e.target.value }); setMessage(""); }} /></label>
      <label className="block font-medium">Your client note · optional<textarea className={fieldClass} value={draft.client_note ?? ""} maxLength={2000} rows={3} onChange={(e) => { setDraft({ ...draft, client_note: e.target.value || null }); setMessage(""); }} /></label>
      {orderConstraints && draft.actions.length>1 ? <aside className="rounded-xl bg-white p-4 text-sm leading-6">
        <p className="font-semibold">Your delivery order</p><p>Move independent work up or down. Explicit prerequisites stay before dependent work. No new analysis or credit is used.</p>
        <button type="button" className="mt-3 rounded-lg border border-[#ccd9ce] px-4 py-2 disabled:opacity-50"
          disabled={draft.actions.map(a=>a.id).join()===restoreOrder.join()}
          onClick={()=>reorder(restoreOrder.map(id=>draft.actions.find(a=>a.id===id)!))}>Restore system order</button>
        <p className="mt-2 text-xs">Restoring order keeps your wording and materials.</p>
      </aside> : null}
      {draft.actions.length ? draft.actions.map((action, index) => <section key={action.id} className="space-y-4 rounded-xl border border-[#dce6d9] p-4">
        <h3 className="font-semibold">Action {index + 1}</h3>
        {["v22_delivery_revision_v2","v22_delivery_revision_v3"].includes(draft.schema_version) ? <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" aria-label={`Include action ${index+1} in client report`}
            checked={draft.client_action_ids!.some(id=>id===action.id)}
            onChange={event=>{const include=event.target.checked;requestSelection({...draft,client_action_ids:draft.actions.filter(a=>a.id===action.id ? include : draft.client_action_ids!.some(id=>id===a.id)).map(a=>a.id) as DeliveryRevision["client_action_ids"]});}} />
          Include in client report
          {!draft.client_action_ids!.some(id=>id===action.id) ? <span>Advisor only · verify before including</span> : null}
        </label> : null}
        {orderConstraints && draft.actions.length>1 ? <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" aria-label={`Move action ${index+1} up`} disabled={!moved(index,-1)} className="rounded-lg border border-[#ccd9ce] px-3 py-2 disabled:opacity-40" onClick={()=>{const next=moved(index,-1);if(next)reorder(next);}}>↑ Move up</button>
          <button type="button" aria-label={`Move action ${index+1} down`} disabled={!moved(index,1)} className="rounded-lg border border-[#ccd9ce] px-3 py-2 disabled:opacity-40" onClick={()=>{const next=moved(index,1);if(next)reorder(next);}}>↓ Move down</button>
          {(index>0&&!moved(index,-1))||(index<draft.actions.length-1&&!moved(index,1)) ? <p className="text-[#52685b]">A prerequisite check fixes this boundary.</p> : null}
        </div> : null}
        <label className="block">Action title<input className={fieldClass} value={action.title} maxLength={200} onChange={(e) => actionChange(index, { title: e.target.value })} /></label>
        <label className="block">Action target<textarea className={fieldClass} value={action.target} maxLength={2000} rows={2} onChange={(e) => actionChange(index, { target: e.target.value })} /></label>
        <label className="block">Steps · one per line<textarea className={fieldClass} value={action.steps.join("\n")} rows={4} onChange={(e) => actionChange(index, { steps: lines(e.target.value) })} /></label>
        <label className="block">Completion checks · one per line<textarea className={fieldClass} value={action.completion.join("\n")} rows={3} onChange={(e) => actionChange(index, { completion: lines(e.target.value) })} /></label>
        <label className="block">Review basis<textarea className={fieldClass} value={action.review} maxLength={2000} rows={3} onChange={(e) => actionChange(index, { review: e.target.value })} /></label>
        {action.materials.map((material, materialIndex) => <div key={material.id} className="space-y-3 border-t border-[#dce6d9] pt-4">
          <p className="text-sm font-semibold">{material.readiness === "requires_confirmation" ? "Confirm before publishing" : material.readiness === "ready_to_use" ? "Ready for your review" : "Execution instructions"}</p>
          <p className="break-all text-sm">Original material target: {material.target}</p>
          <label className="block">Material title<input className={fieldClass} value={material.title} maxLength={200} onChange={(e) => actionChange(index, { materials: action.materials.map((m, i) => i === materialIndex ? { ...m, title: e.target.value } : m) as typeof action.materials })} /></label>
          <label className="block">Material content<textarea className={fieldClass} value={material.body} maxLength={2000} rows={7} onChange={(e) => actionChange(index, { materials: action.materials.map((m, i) => i === materialIndex ? { ...m, body: e.target.value } : m) as typeof action.materials })} /></label>
          {material.confirmation_items.length ? <ul aria-label="Confirmation needed" className="list-inside list-disc text-sm">{material.confirmation_items.map((item, i) => <li key={i}>{item}</li>)}</ul> : null}
          <button type="button" className="rounded-lg border border-[#ccd9ce] px-4 py-2" onClick={() => copy(material.body, "Material")}>Copy material</button>
        </div>)}
      </section>) : <p>No action is proposed. You can still review and approve this diagnosis without adding filler work.</p>}
      {candidateReport&&<CapabilityCandidatePicker report={candidateReport} draft={draft} cached={cached.current} onReplace={next=>requestSelection(next,true)} onRestore={restoreSelection}/>}
    </fieldset>
    {pending&&<dialog ref={modal} aria-labelledby="candidate-dialog-title" onCancel={()=>setPending(null)} className="fixed inset-0 m-auto max-h-[85vh] w-[min(900px,94vw)] overflow-y-auto rounded-2xl border border-[#ccd9ce] bg-white p-6 shadow-xl backdrop:bg-black/40">
      <h3 tabIndex={-1} id="candidate-dialog-title" className="text-xl font-semibold">{pending.stage==='compare'?'Compare before replacing':'Technical issue will be omitted'}</h3>
      {pending.stage==='compare'?<><p className="my-3">The same {draft.actions.length} slots are kept. Your saved client delivery changes only after approval.</p><div className="grid gap-5 sm:grid-cols-2">{[{label:'Before',actions:draft.actions},{label:'After',actions:pending.next.actions}].map(side=><div key={side.label}><h4 className="font-semibold">{side.label}</h4>{side.actions.map((a,i)=><div className="my-3 rounded-lg bg-[#f5f8f3] p-3" key={a.id}><p className="font-medium">{i+1}. {a.title}</p><p className="break-words text-sm">{a.target}</p><p className="mt-2 text-sm">{a.steps.join(' ')}</p><p className="mt-2 text-xs">{!(side.label==='After'?pending.next:draft).client_action_ids?.some(id=>id===a.id)?'Advisor only · verification needed':'Client-visible selection'}</p></div>)}</div>)}</div></>:<><p className="my-4 leading-7">This report has a confirmed HTTP error or noindex finding. Continuing will remove the last technical action from the client report. The original finding remains unchanged. You may proceed after acknowledging this warning.</p><p className="mb-4 text-sm">Your confirmation is recorded for this exact selection and client visibility. Explicit prerequisites still apply.</p></>}
      <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2" onClick={()=>setPending(null)}>Cancel</button><button type="button" className="rounded-lg bg-[#234c39] px-4 py-2 text-white" onClick={()=>pending.stage==='compare'?finishComparison():acceptSelection({...pending.next,technical_omission_confirmation:technicalOmissionConfirmation(candidateReport!,pending.next)})}>{pending.stage==='compare'?'Confirm replacement':'Acknowledge and continue'}</button></div>
    </dialog>}
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1" disabled={busy || conflict || !ready} checked={reviewed} onChange={event=>setReviewed(event.target.checked)} />I have reviewed this content and its unresolved confirmations for client delivery.</label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || conflict || !ready || !reviewed} className="rounded-lg bg-[#234c39] px-5 py-3 text-white disabled:opacity-60" onClick={() => save("approved")}>{busy ? "Saving…" : "Approve for delivery"}</button>
      <button type="button" disabled={busy || conflict || !ready} className="rounded-lg border border-[#ccd9ce] px-5 py-3 disabled:opacity-60" onClick={() => save("draft")}>Save draft</button>
      {conflict ? <button type="button" className="rounded-lg border border-[#ccd9ce] px-5 py-3" onClick={() => copy(JSON.stringify(draft, null, 2), "Unsaved edits")}>Copy unsaved edits</button> : null}
    </div>
    <p role="status" aria-live="polite">{message}</p><p role="status" aria-live="polite">{copyMessage}</p>
  </section>;
}
