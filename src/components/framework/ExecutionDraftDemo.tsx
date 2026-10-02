"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createExecutionDraft, draftSections, hasDraftPlaceholders, serializeExecutionDraft, type DemoDraft } from "./execution-demo-data";

const button = "min-h-11 rounded-lg border border-[#cbd3c0] bg-white px-3 py-2 text-sm font-semibold text-[#263226] hover:bg-[#eef3e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526c16] disabled:cursor-not-allowed disabled:opacity-40";

export function ExecutionDraftDemo({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void } = {}) {
  const prefix = useId();
  const [saved, setSaved] = useState(createExecutionDraft);
  const [editing, setEditing] = useState<DemoDraft | null>(null);
  const [notes, setNotes] = useState(false);
  const [status, setStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [manualCopy, setManualCopy] = useState("");
  const editRef = useRef<HTMLButtonElement>(null);
  const current = editing ?? saved;
  const pending = hasDraftPlaceholders(current);
  const dirty = editing !== null && JSON.stringify(editing) !== JSON.stringify(saved);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const route = (event: Event) => { if (!window.confirm("Leave this demo and discard the unsaved draft edits?")) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) return;
      if (!window.confirm("Leave this demo and discard the unsaved draft edits?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    window.addEventListener("searchtrust:before-navigation", route);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); window.removeEventListener("searchtrust:before-navigation", route); };
  }, [dirty]);

  function finishEdit(save: boolean) {
    if (save && editing) setSaved({ ...editing });
    setEditing(null);
    setManualCopy("");
    setStatus(save ? "Demo changes saved on this page only. Refreshing resets the example." : "Edits cancelled. The last saved demo draft is unchanged.");
    requestAnimationFrame(() => editRef.current?.focus());
  }

  async function copyDraft() {
    const text = serializeExecutionDraft(current);
    const warning = pending ? "Draft contains information still to fill in. " : "";
    setCopying(true);
    setManualCopy("");
    setStatus(`${warning}Copying the visible draft…`);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus(`${warning}Draft copied. Review business accuracy before publishing.`);
    } catch {
      setManualCopy(text);
      setStatus(`${warning}Clipboard access is unavailable. Select and copy the draft below.`);
    } finally { setCopying(false); }
  }

  function restore() {
    if (!window.confirm("Discard the current demo changes and restore the example draft?")) return;
    setSaved(createExecutionDraft()); setEditing(null); setManualCopy(""); setStatus("Example draft restored. Client confirmation is still required.");
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
      <aside aria-label="Draft basis and client confirmation" className="min-w-0 bg-[#e9eddf] p-5 sm:p-7">
        <h4 className="text-xl font-semibold">What the draft is based on</h4>
        <h5 className="mt-6 text-sm font-bold">Known in this fictional example</h5>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]"><li>The page offers air conditioning repair.</li><li>The work improves the existing service page.</li><li>Service scope, process and contact guidance need clarification.</li></ul>
        <h5 className="mt-6 text-sm font-bold">Awaiting client confirmation</h5>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#586452]"><li>[Service area]</li><li>[Repair services the business can undertake]</li><li>[Actual service process]</li><li>[Phone number or enquiry channel]</li><li>[Business name]</li></ul>
        <h5 className="mt-6 text-sm font-bold">Purpose of the additions</h5>
        <p className="mt-3 text-sm leading-7 text-[#586452]">Help visitors understand whether the business can handle their needs and how to get in touch.</p>
      </aside>
      <section aria-labelledby={`${prefix}-heading`} className="min-w-0 border border-[#d8ddcf] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase leading-6 tracking-[0.15em] text-[#526c16]">Editable demo · Fictional business</p>
        <h4 id={`${prefix}-heading`} className="mt-3 text-xl font-semibold">Air conditioning service-page draft</h4>
        <p className="mt-3 text-sm leading-7 text-[#586452]">Bracketed text marks information to confirm. These changes stay in this demo and do not edit a real report or publish a page.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button ref={editRef} type="button" className={button} disabled={editing !== null || copying} aria-expanded={editing !== null} onClick={() => { setEditing({ ...saved }); setManualCopy(""); setStatus(""); }}>Edit draft</button>
          <button type="button" className={button} disabled={copying} onClick={copyDraft}>{copying ? "Copying…" : "Copy content"}</button>
          <button type="button" className={button} aria-expanded={notes} onClick={() => setNotes(!notes)}>{notes ? "Hide change notes" : "View change notes"}</button>
        </div>
        {pending && <p className="mt-4 border-l-2 border-[#8a9c6b] pl-4 text-sm font-semibold leading-7 text-[#526c16]">Draft contains information still to fill in. It is not a final, publish-ready version.</p>}
        <div className="mt-6 space-y-6">{draftSections.map((section) => <div key={section.key}>
          {editing ? <><label htmlFor={`${prefix}-${section.key}`} className="text-sm font-bold">{section.label}</label><textarea id={`${prefix}-${section.key}`} autoFocus={section.key === "title"} value={editing[section.key]} maxLength={5000} rows={section.key === "title" ? 2 : section.key === "scope" || section.key === "process" ? 8 : 5} onChange={(event) => { setEditing({ ...editing, [section.key]: event.target.value }); setManualCopy(""); setStatus(""); }} className="field-input mt-2 min-w-0 bg-white" /></> : <><h5 className="text-sm font-bold">{section.label}</h5><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-[#586452]">{current[section.key] || "No draft text provided."}</p></>}
          {notes && <p className="mt-3 border-l-2 border-[#cbd8b5] pl-3 text-sm leading-6 text-[#526c16]"><strong>Change note:</strong> {section.note}</p>}
        </div>)}</div>
        <div className="mt-7 flex flex-wrap gap-2 border-t border-[#d8ddcf] pt-5"><button type="button" className={button} disabled={!editing || copying} onClick={() => finishEdit(true)}>Save demo changes</button><button type="button" className={button} disabled={!editing || copying} onClick={() => finishEdit(false)}>Cancel</button><button type="button" className={button} disabled={copying} onClick={restore}>Restore example</button></div>
        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm leading-7 text-[#526c16]">{status}</p>
        {manualCopy && <div className="mt-4"><label htmlFor={`${prefix}-manual-copy`} className="text-sm font-semibold">Copy draft manually</label><textarea id={`${prefix}-manual-copy`} readOnly value={manualCopy} rows={8} onFocus={(event) => event.target.select()} className="field-input mt-2 bg-white" /><p className="mt-2 text-sm text-[#586452]">Select this field, then use your device’s Copy command.</p></div>}
      </section>
    </div>
  );
}
