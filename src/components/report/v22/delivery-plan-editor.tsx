"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryPlanAction } from "@/lib/report-delivery/plan";

export interface DeliveryPlanPageState {
  plan: DeliveryPlanAction[];
  originalPlan: DeliveryPlanAction[];
  revision: number;
  status: "original" | "draft" | "approved";
  editingAvailable: boolean;
}

const labels = {
  title: "Action title",
  target: "Target page or work scope",
  steps: "Execution steps",
  completion: "Completion standard",
  owner: "Owner",
  schedule: "Planned timing",
  review: "Review metrics and timing",
} as const;
type Field = keyof typeof labels;

export function DeliveryPlanEditor({ caseId, reportId, initialState }: {
  caseId: string;
  reportId: string;
  initialState: DeliveryPlanPageState;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialState.plan);
  const [saved, setSaved] = useState(initialState.plan);
  const [revision, setRevision] = useState(initialState.revision);
  const [status, setStatus] = useState(initialState.status);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);
  const endpoint = `/api/v2/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}/delivery-plan`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!initialState.editingAvailable) return null;

  function update(actionId: string, field: Field, value: string) {
    setPlan((current) => current.map((action) => action.actionId === actionId ? { ...action, [field]: value } : action));
  }

  function move(index: number, destination: number) {
    setPlan((current) => {
      const next = [...current];
      const [action] = next.splice(index, 1);
      next.splice(destination, 0, action);
      return next;
    });
  }

  async function submit(method: "PUT" | "POST") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(method === "PUT" ? { expectedRevision: revision, plan } : { expectedRevision: revision, reviewConfirmed }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "The plan could not be saved.");
      setRevision(body.revision); setStatus(body.status); setPlan(body.plan); setSaved(body.plan);
      setReviewConfirmed(false);
      setEditing(null);
      setMessage(method === "POST" ? "Plan approved. The client preview, PDF and new share link will use this version." : "Draft saved. Review and approve it before client delivery.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The plan could not be saved."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="delivery-plan-editor-title" className="mb-12 rounded-[26px] border border-[#d6dfcb] bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6c861e]">SEO plan review</p><h2 id="delivery-plan-editor-title" className="mt-2 text-2xl font-black text-[#1d291e]">Make the recommendation your plan.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667164]">Edit the work, not the original observations. Changed scope is not automatically supported by the source evidence.</p></div>
      <span className="rounded-full bg-[#edf3e3] px-3 py-1.5 text-xs font-bold text-[#596f24]">{status === "original" ? "Original recommendation" : `Revision ${revision} · ${status}`}</span>
    </div>
    <ol className="mt-6 space-y-3">{plan.map((action, index) => {
      const original = initialState.originalPlan.find((item) => item.actionId === action.actionId)!;
      const scopeChanged = action.target.trim() !== original.target;
      const open = editing === action.actionId;
      return <li key={action.actionId} className="rounded-2xl bg-[#f5f7f1] p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3"><span className="rounded-lg bg-[#1e2b21] px-2.5 py-1.5 text-xs font-black text-[#b4d93c]">0{index + 1}</span><div className="min-w-0 flex-1"><p className="font-bold text-[#253127]">{action.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#687366]">Scope: {action.target}</p></div></div>
        {scopeChanged && <p className="mt-3 rounded-xl bg-[#fff5e4] p-3 text-xs leading-5 text-[#785821]">Scope changed. Original evidence applies to “{original.target}”, not automatically to this new scope.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy || index === 0} onClick={() => move(index, index - 1)} className="rounded-lg border border-[#c9d4c0] px-3 py-2 text-xs font-bold disabled:opacity-40">Move up</button>
          <button type="button" disabled={busy || index === plan.length - 1} onClick={() => move(index, index + 1)} className="rounded-lg border border-[#c9d4c0] px-3 py-2 text-xs font-bold disabled:opacity-40">Move down</button>
          <button type="button" disabled={busy} aria-expanded={open} onClick={() => setEditing(open ? null : action.actionId)} className="rounded-lg border border-[#c9d4c0] px-3 py-2 text-xs font-bold">{open ? "Close fields" : "Edit fields"}</button>
        </div>
        {open && <div className="mt-5 grid gap-4 border-t border-[#dde4d8] pt-5 sm:grid-cols-2">{(Object.keys(labels) as Field[]).map((field) => <label key={field} className={`text-xs font-bold text-[#475647] ${["steps", "completion", "review"].includes(field) ? "sm:col-span-2" : ""}`}>{labels[field]}{["steps", "completion", "review"].includes(field) ? <textarea className="field-input mt-2 bg-white" rows={3} maxLength={2000} value={action[field]} onChange={(event) => update(action.actionId, field, event.target.value)} /> : <input className="field-input mt-2 bg-white" maxLength={field === "title" ? 200 : 1000} value={action[field]} onChange={(event) => update(action.actionId, field, event.target.value)} />}</label>)}</div>}
      </li>;
    })}</ol>
    <label className="mt-6 flex items-start gap-3 rounded-xl bg-[#edf3e4] p-4 text-sm leading-6 text-[#425240]"><input type="checkbox" checked={reviewConfirmed} disabled={busy || dirty} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span>I have reviewed the client preview, the edited scope, pending conditions and what will be delivered.</span></label>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={busy || !dirty} onClick={() => submit("PUT")} className="rounded-xl bg-[#1d2b21] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Save draft</button>
      <button type="button" disabled={busy || dirty || status === "approved" || !reviewConfirmed} onClick={() => submit("POST")} className="rounded-xl bg-[#a5d020] px-5 py-3 text-sm font-bold text-[#1d2b21] disabled:opacity-40">Approve for client delivery</button>
      <button type="button" disabled={busy} onClick={() => { if (window.confirm("Discard unsaved changes to this plan?")) { setPlan(saved); setEditing(null); } }} className="rounded-xl border border-[#cbd6c4] px-5 py-3 text-sm font-bold disabled:opacity-40">Discard unsaved changes</button>
      <button type="button" disabled={busy} onClick={() => { if (window.confirm("Restore the original system recommendation in the editor? Save it to create a new draft revision.")) { setPlan(initialState.originalPlan); setEditing(null); } }} className="rounded-xl border border-[#cbd6c4] px-5 py-3 text-sm font-bold disabled:opacity-40">Restore original recommendation</button>
    </div>
    <p className="mt-3 text-xs leading-5 text-[#71806d]">Saving creates a draft revision. Approval pins that revision for the next client delivery. Creating a new link revokes the previous active link; exported PDFs remain unchanged.</p>
    {dirty && <p className="mt-2 text-xs font-bold text-[#795c21]">Unsaved changes are visible only in this editor; save before leaving.</p>}
    {message && <p role="status" className="mt-4 text-sm font-bold text-[#526c16]">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm font-bold text-[#9a4b2b]">{error}</p>}
  </section>;
}
