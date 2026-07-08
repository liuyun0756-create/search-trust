"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ActionItem } from "@/lib/report-v21";
import { formatLayerKey, getPriorityTone, safeList } from "./statusHelpers";
import { isAnalystView, isClientView, isInternalImplementationNote, type V21ViewMode } from "./viewMode";

export function V21ActionItems({
  actions,
  title = "Recommended actions",
  viewMode = "analyst",
  maxItems,
}: {
  actions?: ActionItem[] | null;
  title?: string;
  viewMode?: V21ViewMode;
  maxItems?: number;
}) {
  const [expanded, setExpanded] = useState(isClientView(viewMode));
  const showTechnical = isAnalystView(viewMode);
  const showContent = expanded || isClientView(viewMode);
  const items = safeList(actions).slice(0, maxItems ?? safeList(actions).length);

  if (items.length === 0) {
    return <p className="text-[13px] font-medium text-gray-400">No structured action items available.</p>;
  }

  const content = (
    <div className="space-y-4 border-t border-gray-100 px-4 py-4">
      {items.map((item, index) => (
        <article key={item.id || index} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${getPriorityTone(item.priority)}`}>
              {item.priority}
            </span>
            <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500">
              {formatLayerKey(item.affected_layer)}
            </span>
            <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500">
              {item.effort_level} effort
            </span>
            {showTechnical && item.related_rule_ids?.length > 0 && (
              <span className="rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500">
                Rules: {item.related_rule_ids.join(", ")}
              </span>
            )}
          </div>
          <h4 className="text-[15px] font-black text-[#1A212B]">{item.task_title}</h4>
          <FieldList label="Where to add" values={item.where_to_add} />
          <FieldList label="What to add" values={item.what_to_add} />
          {item.example_copy && (
            <div className="mt-3 rounded-xl border border-[#E4EDD2] bg-[#FBFDF5] p-3">
              <p className="mb-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#8BAA2B]">Example copy</p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-700">{item.example_copy}</p>
            </div>
          )}
          {showTechnical && <FieldList label="Implementation notes" values={item.implementation_notes} />}
          {!showTechnical && (
            <FieldList
              label="Implementation notes"
              values={safeList(item.implementation_notes).filter((note) => !isInternalImplementationNote(note))}
            />
          )}
          <FieldList label="Completion signals" values={item.completion_signals} />
          {item.expected_effect && (
            <p className="mt-3 text-[13px] font-medium leading-relaxed text-gray-600">
              <span className="font-bold text-[#1A212B]">Expected effect: </span>
              {item.expected_effect}
            </p>
          )}
        </article>
      ))}
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">
          {title} ({items.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showContent ? "rotate-180" : ""}`} />
      </button>

      {showContent && content}
    </div>
  );
}

function FieldList({ label, values }: { label: string; values?: string[] | null }) {
  const items = safeList(values).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <ul className="space-y-1.5">
        {items.map((value, index) => (
          <li key={`${value}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
