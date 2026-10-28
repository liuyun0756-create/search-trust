"use client";

import { useEffect, useRef, useState } from "react";
import type { DeliveryRevision } from "@/lib/report-capability/generated/types";
import { validDeliveryOrder, type DeliveryOrderConstraints } from "@/lib/report-capability/order";

export type CapabilitySaveResult = { ok: true; revision: number; content: DeliveryRevision }
  | { ok: false; code: "CAPABILITY_CONFLICT" | "CAPABILITY_INVALID" | "CAPABILITY_UNAVAILABLE" };
type Props = { initial: DeliveryRevision; onSave: (content: DeliveryRevision) => Promise<CapabilitySaveResult>; orderConstraints?:DeliveryOrderConstraints };
const fieldClass = "mt-2 w-full rounded-lg border border-[#ccd9ce] bg-white p-3 text-[#1d2a22] disabled:opacity-60";
const lines = (value: string): [string, ...string[]] => {
  const [first = "", ...rest] = value.split("\n");
  return [first, ...rest];
};

/** The mounting server route must authenticate and bind onSave to its Case/report. */
export function CapabilityDeliveryEditor({ initial, onSave, orderConstraints }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const saving = useRef(false);
  function moved(index:number,delta:number){const next=[...draft.actions];const to=index+delta;
    if(to<0||to>=next.length)return null;[next[index],next[to]]=[next[to],next[index]];
    return !orderConstraints||!validDeliveryOrder(next.map(a=>a.id),orderConstraints)?null:next;
  }
  function reorder(actions:DeliveryRevision["actions"][number][]){
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
      setDraft({ ...structuredClone(result.content), expected_revision: result.revision });
      setReviewed(false);
      setMessage(status === "approved" ? `Revision ${result.revision} approved for delivery.` : `Draft revision ${result.revision} saved. Not approved for delivery.`);
    } catch { setMessage("Could not save. Your edits have been kept; please retry."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section aria-label="Review delivery content" className="space-y-6 rounded-2xl border border-[#dce6d9] bg-[#f5f8f3] p-5 sm:p-8">
    <header><h2 className="text-2xl font-semibold">Review your client delivery</h2>
      <p className="mt-2 leading-7">Approve the report as it is, or adapt the summary, proposed work and materials. Original observations stay unchanged.</p>
      <p className="mt-2 text-sm">Changing a target or scope does not verify the new scope. Record your own business information in the client note; it is not collected evidence.</p></header>
    <fieldset disabled={busy || !ready} className="space-y-5" onChangeCapture={() => setReviewed(false)}>
      <legend className="sr-only">Optional delivery edits</legend>
      <label className="block font-medium">Report title<input className={fieldClass} value={draft.title} maxLength={200} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setMessage(""); }} /></label>
      <label className="block font-medium">Client summary<textarea className={fieldClass} value={draft.summary} maxLength={2000} rows={5} onChange={(e) => { setDraft({ ...draft, summary: e.target.value }); setMessage(""); }} /></label>
      <label className="block font-medium">Your client note · optional<textarea className={fieldClass} value={draft.client_note ?? ""} maxLength={2000} rows={3} onChange={(e) => { setDraft({ ...draft, client_note: e.target.value || null }); setMessage(""); }} /></label>
      {orderConstraints && draft.actions.length>1 ? <aside className="rounded-xl bg-white p-4 text-sm leading-6">
        <p className="font-semibold">Your delivery order</p><p>Move independent work up or down. Access, indexing, measurement and explicit prerequisites stay before dependent work. No new analysis or credit is used.</p>
        <button type="button" className="mt-3 rounded-lg border border-[#ccd9ce] px-4 py-2 disabled:opacity-50"
          disabled={draft.actions.map(a=>a.id).join()===orderConstraints.systemOrder.join()}
          onClick={()=>reorder(orderConstraints.systemOrder.map(id=>draft.actions.find(a=>a.id===id)!))}>Restore system order</button>
        <p className="mt-2 text-xs">Restoring order keeps your wording and materials.</p>
      </aside> : null}
      {draft.actions.length ? draft.actions.map((action, index) => <section key={action.id} className="space-y-4 rounded-xl border border-[#dce6d9] p-4">
        <h3 className="font-semibold">Action {index + 1}</h3>
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
    </fieldset>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1" disabled={busy || conflict || !ready} checked={reviewed} onChange={event=>setReviewed(event.target.checked)} />I have reviewed this content and its unresolved confirmations for client delivery.</label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || conflict || !ready || !reviewed} className="rounded-lg bg-[#234c39] px-5 py-3 text-white disabled:opacity-60" onClick={() => save("approved")}>{busy ? "Saving…" : "Approve for delivery"}</button>
      <button type="button" disabled={busy || conflict || !ready} className="rounded-lg border border-[#ccd9ce] px-5 py-3 disabled:opacity-60" onClick={() => save("draft")}>Save draft</button>
      {conflict ? <button type="button" className="rounded-lg border border-[#ccd9ce] px-5 py-3" onClick={() => copy(JSON.stringify(draft, null, 2), "Unsaved edits")}>Copy unsaved edits</button> : null}
    </div>
    <p role="status" aria-live="polite">{message}</p><p role="status" aria-live="polite">{copyMessage}</p>
  </section>;
}
