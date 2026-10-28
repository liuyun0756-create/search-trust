"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import type {ReviewRevision,SaveRequest,SavedReviewRevision} from "@/lib/review-reports/delivery";
const field="mt-2 w-full rounded-lg border border-[#cbd9cb] bg-white p-3 text-sm leading-6 disabled:opacity-60";
const button="rounded-lg border border-[#cbd9cb] px-4 py-3 text-sm font-semibold disabled:opacity-40";
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
export function ReviewEditor({initial}:{initial:ReviewRevision}){
  const router=useRouter(),[draft,setDraft]=useState(()=>structuredClone(initial)),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<SaveRequest|null>(null),[conflict,setConflict]=useState(false),[message,setMessage]=useState("");const lock=useRef(false);
  function change(patch:Partial<ReviewRevision>){setDraft(x=>({...x,...patch}));setConfirmed(false);setMessage("");}
  function action(index:number,patch:Partial<ReviewRevision["actions"][number]>){change({actions:draft.actions.map((a,i)=>i===index?{...a,...patch}:a)});}
  async function save(status:"draft"|"approved"){
    if(lock.current||conflict||(status==="approved"&&!confirmed&&!pending))return;
    const q=pending??{id:crypto.randomUUID(),review_confirmed:status==="approved",content:{...structuredClone(draft),status}};
    lock.current=true;setBusy(true);setPending(q);setMessage("");
    try{
      const response=await fetch(`/api/v2/cases/${initial.case_id}/reports/${initial.report_id}/review/content-revision`,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(q)});
      const body=await response.json().catch(()=>null);
      if(response.status===409){setConflict(true);setPending(null);setMessage("A newer revision exists. Your edits are retained. Copy them before reloading the latest revision.");return;}
      if(response.status===400){setPending(null);setMessage(body?.error??"Check the required fields and limits.");return;}
      const s=body?.saved as SavedReviewRevision|undefined;
      if(!response.ok||!s||s.revision!==q.content.expected_revision+1||JSON.stringify(stable(s.content))!==JSON.stringify(stable(q.content)))throw Error();
      setPending(null);setConfirmed(false);setDraft({...structuredClone(s.content),expected_revision:s.revision});
      setMessage(s.status==="approved"?`Revision ${s.revision} approved for delivery.`:`Draft revision ${s.revision} saved. It is not approved for delivery.`);router.refresh();
    }catch{setMessage("Save result is unknown. Check the same save before making further edits.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <section aria-label="Review delivery editor" className="space-y-5 rounded-2xl border border-[#dce6d9] bg-[#f1f6ed] p-5 sm:p-7">
    <header><p className="text-xs font-bold uppercase tracking-[.15em] text-[#63865c]">Your client deliverable</p><h2 className="mt-2 text-xl font-semibold">Review. Refine. Approve.</h2><p className="mt-3 text-sm leading-6">Approve the wording as it is, or adapt the client explanation and next work. Evidence stays attached to the original report.</p><p className="mt-2 text-xs leading-5 text-[#617469]">Saving and approving delivery use no credits.</p></header>
    <fieldset disabled={busy||!!pending||conflict} className="space-y-4">
      <label className="block text-sm font-semibold">Report title<input className={field} maxLength={200} value={draft.title} onChange={e=>change({title:e.target.value})}/></label>
      <label className="block text-sm font-semibold">Client summary<textarea className={field} rows={4} maxLength={2000} value={draft.summary} onChange={e=>change({summary:e.target.value})}/></label>
      <label className="block text-sm font-semibold">Note for your client · optional<textarea className={field} rows={3} maxLength={2000} value={draft.client_note??""} onChange={e=>change({client_note:e.target.value||null})}/></label>
      {!draft.actions.length?<p className="rounded-lg border border-[#cbd9cb] p-4 text-sm leading-6">No next action is proposed. You can approve the diagnosis and observations without adding work.</p>:null}
      {draft.actions.map((a,i)=><details key={a.id} open={i===0} className="rounded-xl border border-[#cbd9cb] p-4"><summary className="cursor-pointer text-sm font-semibold">{i+1}. {a.title}</summary><div className="mt-4 space-y-3">
        <label className="block text-sm">Action title<input className={field} maxLength={200} value={a.title} onChange={e=>action(i,{title:e.target.value})}/></label>
        <label className="block text-sm">Target<textarea className={field} rows={2} maxLength={2000} value={a.target} onChange={e=>action(i,{target:e.target.value})}/></label>
        <label className="block text-sm">Work steps · one per line<textarea className={field} rows={5} value={a.steps.join("\n")} onChange={e=>action(i,{steps:e.target.value.split("\n") as typeof a.steps})}/></label>
        <label className="block text-sm">Completion checks · one per line<textarea className={field} rows={3} value={a.completion.join("\n")} onChange={e=>action(i,{completion:e.target.value.split("\n") as typeof a.completion})}/></label>
        <label className="block text-sm">Review basis<textarea className={field} rows={3} maxLength={2000} value={a.review} onChange={e=>action(i,{review:e.target.value})}/></label>
      </div></details>)}
      <label className="flex gap-3 text-sm leading-6"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the client explanation, work and limits and approve this version for delivery.</label>
    </fieldset>
    <div className="flex flex-wrap gap-3">{pending?<button className={button} disabled={busy} onClick={()=>void save(pending.content.status)}>Check the same save</button>:<>
      <button className={button} disabled={busy||conflict} onClick={()=>void save("draft")}>Save draft</button><button className={`${button} bg-[#244633] text-white`} disabled={busy||conflict||!confirmed} onClick={()=>void save("approved")}>Approve for delivery</button></>}
      <button className={button} onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(draft,null,2));setMessage("Your delivery wording has been copied.");}catch{setMessage("Copy failed. Select and copy your edits before reloading.");}}}>Copy edits</button>
    </div><p role="status" aria-live="polite" className="text-sm leading-6">{busy?"Checking the saved revision…":message}</p>
  </section>;
}
