"use client";

import { useId, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { createDemoPlan, demoFieldLabels, demoRecommendations, reorderDemoPlan, type DemoPlanAction, type DemoPlanFields } from "./plan-demo-data";

const buttonBase = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526c16] disabled:cursor-not-allowed disabled:opacity-40";
const button = `${buttonBase} border-[#cbd3c0] bg-white text-[#263226] hover:bg-[#eef3e5]`;
const primaryButton = `${buttonBase} border-transparent bg-[#172018] text-white hover:bg-[#30402b]`;

export function ActionPlanDemo() {
  const prefix = useId();
  const [plan, setPlan] = useState(createDemoPlan);
  const [savedPlan, setSavedPlan] = useState<DemoPlanAction[] | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(demoRecommendations[0].id);
  const [draft, setDraft] = useState<DemoPlanAction | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const editButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const moveButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const isSaved = savedPlan !== null && JSON.stringify(plan) === JSON.stringify(savedPlan);
  const selectedEvidence = demoRecommendations.find((item) => item.id === selected)!;

  function move(id: string, index: number, focusButton?: string) {
    if (draft) return;
    const next = reorderDemoPlan(plan, id, index);
    if (next === plan) return;
    setPlan(next);
    setStatus(`${next[index].title} moved to position ${index + 1}.`);
    if (focusButton) requestAnimationFrame(() => {
      const preferred = moveButtons.current[`${id}-${focusButton}`];
      const fallback = moveButtons.current[`${id}-${focusButton === "up" ? "down" : "up"}`];
      (preferred?.disabled ? fallback : preferred)?.focus();
    });
  }

  function closeEditor(id: string) {
    setDraft(null);
    setError("");
    requestAnimationFrame(() => editButtons.current[id]?.focus());
  }

  function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.title.trim() || !draft.target.trim()) {
      setError("Enter an action title and a target or work scope.");
      return;
    }
    const updated = { ...draft, title: draft.title.trim(), target: draft.target.trim() };
    setPlan((current) => current.map((item) => item.id === updated.id ? updated : item));
    setStatus("Action updated in the demo. Original evidence is unchanged.");
    closeEditor(updated.id);
  }

  function reset() {
    if (!window.confirm("Discard the current demo changes and restore the initial suggestions?")) return;
    setPlan(createDemoPlan());
    setSavedPlan(null);
    setDraft(null);
    setExpanded([]);
    setSelected(demoRecommendations[0].id);
    setDragging(null);
    setError("");
    setStatus("Initial suggestions restored in this demo.");
  }

  return (
    <section aria-labelledby={`${prefix}-title`} className="mt-8 border border-[#cbd3c0] bg-[#f3f4ed] p-5 sm:p-8">
      <p className="text-xs font-bold uppercase leading-6 tracking-[0.16em] text-[#526c16]">Interactive demo · Changes do not affect real reports</p>
      <h4 id={`${prefix}-title`} className="mt-3 text-2xl font-semibold leading-8">Make this example plan your own.</h4>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#586452]">These illustrative actions are not real client findings. Their starting order is for demonstration, not a fixed priority for every client. Nothing is sent to a report, and no sign-in, analysis or credits are required.</p>
      <p className="mt-3 text-sm font-medium text-[#526c16]">Drag using the handle on desktop, or use Move up / Move down on any device.</p>

      <div className="action-workbench mt-7"><ol aria-label="Demo action plan" className="space-y-4">
        {plan.map((action, index) => {
          const original = demoRecommendations.find((item) => item.id === action.id)!;
          const isEdited = (Object.keys(demoFieldLabels) as (keyof DemoPlanFields)[]).some((field) => action[field] !== original[field]);
          const scopeChanged = action.target.trim() !== original.target;
          const open = expanded.includes(action.id);
          const editing = draft?.id === action.id;
          const evidenceId = `${prefix}-${action.id}-evidence`;
          const editorId = `${prefix}-${action.id}-editor`;
          return (
            <li key={action.id} data-action-id={action.id} className={`min-w-0 border bg-white p-5 sm:p-6 ${dragging === action.id || selected === action.id ? "border-[#637e16]" : "border-[#d8ddcf]"}`}
              onDragOver={(event) => { if (dragging && !draft) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
              onDrop={(event) => { event.preventDefault(); if (dragging && !draft) move(dragging, index); setDragging(null); }}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" draggable={!draft} onDragStart={(event) => { if (draft) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", action.id); event.dataTransfer.effectAllowed = "move"; setDragging(action.id); }} onDragEnd={() => setDragging(null)} className="hidden cursor-grab px-1 py-1 text-[#69765f] lg:block"><GripVertical className="h-5 w-5" /></span>
                <span className="pt-1 font-mono text-sm font-bold text-[#637e16]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <h5 className="break-words text-xl font-semibold leading-7">{action.title}</h5>
                  <p className="mt-2 break-words text-sm leading-7 text-[#586452]"><strong className="text-[#263226]">Target:</strong> {action.target}</p>
                  <p className="mt-2 text-sm leading-7 text-[#586452]"><strong className="text-[#263226]">Original recommendation:</strong> {original.reason}</p>
                  <p className="mt-2 text-xs font-semibold leading-6 text-[#526c16]">{isEdited ? "Your edited plan" : "Original suggested content"} · Initial position {demoRecommendations.findIndex((item) => item.id === action.id) + 1}</p>
                </div>
              </div>
              {scopeChanged && <p className="mt-4 border-l-2 border-[#8a9c6b] pl-4 text-sm leading-7 text-[#586452]">Scope changed. The original evidence refers to “{original.target}”; it has not verified your new scope.</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className={`${button} hidden lg:inline-flex`} aria-pressed={selected === action.id} aria-controls={`${prefix}-selected-reasoning`} onClick={() => setSelected(action.id)}>Inspect reasoning</button>
                <button type="button" className={`${button} lg:hidden`} aria-expanded={open} aria-controls={evidenceId} onClick={() => { setSelected(action.id); setExpanded((ids) => open ? ids.filter((id) => id !== action.id) : [...ids, action.id]); }}>{open ? "Hide evidence" : "View evidence"}</button>
                <button type="button" className={button} ref={(node) => { editButtons.current[action.id] = node; }} aria-expanded={editing} aria-controls={editorId} disabled={draft !== null} onClick={() => { setDraft({ ...action }); setError(""); }}>Edit</button>
                <button type="button" className={button} ref={(node) => { moveButtons.current[`${action.id}-up`] = node; }} disabled={index === 0 || draft !== null} onClick={() => move(action.id, index - 1, "up")}>Move up</button>
                <button type="button" className={button} ref={(node) => { moveButtons.current[`${action.id}-down`] = node; }} disabled={index === plan.length - 1 || draft !== null} onClick={() => move(action.id, index + 1, "down")}>Move down</button>
              </div>
              {open && <div id={evidenceId} className="mobile-evidence mt-5 border-t border-[#d8ddcf] pt-5">
                <h6 className="text-sm font-bold text-[#526c16]">Original supporting evidence · Read-only</h6>
                <p className="mt-2 text-sm leading-7 text-[#586452]">Original target: {original.target}</p>
                <dl className="mt-4 space-y-4">{[["Supporting finding", original.finding], ["Expected impact direction", original.impact], ["Recommendation rationale", original.reason], ["Conditions to confirm", original.conditions]].map(([label, value]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 text-sm leading-7 text-[#586452]">{value}</dd></div>)}</dl>
              </div>}
              {isEdited && !editing && <dl aria-label="Edited plan details" className="mt-5 grid gap-4 border-t border-[#d8ddcf] pt-5 sm:grid-cols-2">{(["steps", "completion", "owner", "schedule", "review"] as const).map((field) => <div key={field}><dt className="text-sm font-semibold">{demoFieldLabels[field]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[#586452]">{action[field] || "Not set in this demo"}</dd></div>)}</dl>}
              {editing && <form id={editorId} aria-label={`Edit ${action.title}`} onSubmit={saveEdit} className="mt-5 border-t border-[#d8ddcf] pt-5">
                <p className="mb-5 text-sm leading-7 text-[#586452]">Edit the work plan, not the collected evidence. A new target or scope needs its own validation.</p>
                <div className="grid gap-5 sm:grid-cols-2">{(Object.keys(demoFieldLabels) as (keyof DemoPlanFields)[]).map((field) => {
                  const multiline = ["steps", "completion", "review"].includes(field);
                  const id = `${prefix}-${action.id}-${field}`;
                  const props = { id, value: draft[field], maxLength: multiline ? 2000 : 300, required: field === "title" || field === "target", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [field]: event.target.value }), className: "field-input mt-2 bg-white" };
                  return <div key={field} className={multiline ? "sm:col-span-2" : ""}><label htmlFor={id} className="text-sm font-semibold">{demoFieldLabels[field]}</label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} autoFocus={field === "title"} />}</div>;
                })}</div>
                {error && <p role="alert" className="mt-4 text-sm text-[#923e23]">{error}</p>}
                <div className="mt-5 flex flex-wrap gap-3"><button type="submit" className={primaryButton}>Save changes</button><button type="button" className={button} onClick={() => closeEditor(action.id)}>Cancel</button></div>
              </form>}
            </li>
          );
        })}
      </ol><aside id={`${prefix}-selected-reasoning`} aria-label="Selected action reasoning"><p className="text-xs font-bold uppercase tracking-widest text-[#526c16]">Original evidence / Read-only</p><h5 className="mt-4 font-semibold">{selectedEvidence.title}</h5><dl className="mt-5 space-y-5">{[["Original target", selectedEvidence.target], ["Supporting finding", selectedEvidence.finding], ["Expected impact", selectedEvidence.impact], ["Why this action", selectedEvidence.reason], ["Still to confirm", selectedEvidence.conditions]].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wider text-[#526c16]">{label}</dt><dd className="mt-2 text-sm leading-7">{value}</dd></div>)}</dl><p className="mt-5 border-t border-[#bac9a3] pt-4 text-xs leading-6">Changes to a plan do not change these observations or validate a new target.</p></aside></div>
      <div className="mt-7 border-t border-[#cbd3c0] pt-6">
        <p className="text-sm leading-7 text-[#586452]">Saved plans exist only in this page’s demo. Refreshing or leaving the page resets them.</p>
        {draft && <p className="mt-2 text-sm text-[#586452]">Save or cancel the open action edit before saving or reordering the plan.</p>}
        <p className="mt-2 text-sm font-semibold text-[#526c16]">{isSaved ? "Current plan matches the saved demo." : savedPlan ? "Changes since the last demo save." : "Demo plan not saved."}</p>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={draft !== null} className={primaryButton} onClick={() => { setSavedPlan(plan.map((action) => ({ ...action }))); setStatus("Demo plan saved. It applies only within this demo."); }}>Save demo plan</button><button type="button" className={button} onClick={reset}>Restore initial suggestions</button></div>
        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm leading-6 text-[#526c16]">{status}</p>
      </div>
    </section>
  );
}
