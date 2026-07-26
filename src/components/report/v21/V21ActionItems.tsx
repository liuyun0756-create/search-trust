"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ActionItem } from "@/lib/report-v21";
import { formatLayerKey, getPriorityTone, safeList } from "./statusHelpers";
import { isAnalystView, isClientView, isInternalImplementationNote, type V21ViewMode } from "./viewMode";

export function V21ActionItems({ actions, title = "Recommended actions", viewMode = "analyst", maxItems }: {
  actions?: ActionItem[] | null; title?: string; viewMode?: V21ViewMode; maxItems?: number;
}) {
  const items = safeList(actions).slice(0, maxItems ?? safeList(actions).length);
  const [expanded, setExpanded] = useState(isClientView(viewMode));
  const visible = expanded || isClientView(viewMode);
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">{title} ({items.length})</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${visible ? "rotate-180" : ""}`} />
      </button>
      {visible && <div className="space-y-4 border-t border-gray-100 p-4">{items.map((item, index) => <ActionCard key={item.id || index} item={item} viewMode={viewMode} />)}</div>}
    </div>
  );
}

function ActionCard({ item, viewMode }: { item: ActionItem; viewMode: V21ViewMode }) {
  const analyst = isAnalystView(viewMode);
  const notes = safeList(item.implementation_notes).filter((note) => !isInternalImplementationNote(note));
  return (
    <article className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${getPriorityTone(item.priority)}`}>{item.priority}</span>
        <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500">{formatLayerKey(item.affected_layer)}</span>
        <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500">{item.effort_level} effort</span>
      </div>
      <h4 className="text-[16px] font-black text-[#1A212B]">{item.task_title}</h4>
      {analyst && (safeList(item.addressed_findings).length > 0 || safeList(item.required_changes).length > 0) && (
        <div className="mt-4 grid gap-4 rounded-xl border border-[#E4EDD2] bg-[#FBFDF5] p-4 md:grid-cols-2">
          <FieldList label={`Addresses ${safeList(item.addressed_findings).length} findings`} values={item.addressed_findings} />
          <FieldList label="Required changes" values={item.required_changes} />
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2"><FieldList label="Where to add" values={item.where_to_add} /><FieldList label="What to add" values={item.what_to_add} /></div>
      {safeList(item.example_copy).filter(Boolean).length > 0 && <FieldList className="mt-4 rounded-xl border border-[#E4EDD2] bg-[#FBFDF5] p-3" label="Example copy" values={item.example_copy} />}
      {item.expected_effect && <p className="mt-4 text-[13px] font-medium leading-relaxed text-gray-600"><span className="font-bold text-[#1A212B]">Expected effect: </span>{item.expected_effect}</p>}
      {analyst && (notes.length > 0 || safeList(item.completion_signals).length > 0) && (
        <details className="mt-4 border-t border-gray-200 pt-3">
          <summary className="cursor-pointer text-[12px] font-black uppercase tracking-[0.12em] text-gray-500">Implementation detail</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><FieldList label="Implementation notes" values={notes} /><FieldList label="Completion signals" values={item.completion_signals} /></div>
        </details>
      )}
    </article>
  );
}

function FieldList({ label, values, className = "" }: { label: string; values?: string[] | null; className?: string }) {
  const items = safeList(values).filter(Boolean);
  if (!items.length) return null;
  return <div className={className}><p className="mb-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p><ul className="space-y-1.5">{items.map((value, index) => <li key={`${value}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" /><span>{value}</span></li>)}</ul></div>;
}
