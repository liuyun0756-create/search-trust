"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EvidenceItem } from "@/lib/report-v21";
import { safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21EvidenceList({
  evidenceItems,
  viewMode = "analyst",
  density = "standard",
}: {
  evidenceItems?: EvidenceItem[] | null;
  viewMode?: V21ViewMode;
  density?: "standard" | "compact";
}) {
  const [expanded, setExpanded] = useState(false);
  const items = safeList(evidenceItems);
  const showTechnical = isAnalystView(viewMode);

  if (items.length === 0) {
    return <p className="text-[13px] font-medium text-gray-400">No structured evidence available.</p>;
  }

  if (!showTechnical) {
    const preview = items[0];
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
        <p className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">
          Evidence summary ({items.length})
        </p>
        <p className="mt-2 text-[13px] font-bold text-[#1A212B]">{preview.source_label || "Evidence source"}</p>
        {preview.extracted_text && (
          <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-relaxed text-gray-600">{preview.extracted_text}</p>
        )}
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">{preview.explanation}</p>
      </div>
    );
  }

  if (density === "compact") {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-gray-500">
          Evidence captured ({items.length})
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item, index) => (
            <CompactEvidenceCard key={item.id || index} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">
          Evidence ({items.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-4">
          {items.map((item, index) => (
            <article key={item.id || index} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-bold uppercase text-gray-500">
                  {item.source_type}
                </span>
                <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-bold uppercase text-gray-500">
                  {item.comparison_result}
                </span>
                <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-bold uppercase text-gray-500">
                  {item.confidence} confidence
                </span>
              </div>
              <p className="text-[13px] font-bold text-[#1A212B]">{item.source_label || "Evidence source"}</p>
              {item.page_section && <p className="mt-1 text-[13px] text-gray-500">Section: {item.page_section}</p>}
              {item.extracted_text && (
                <p className="mt-3 rounded-xl bg-gray-50 p-3 text-[13px] font-medium leading-relaxed text-gray-600">
                  {item.extracted_text}
                </p>
              )}
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-gray-600">{item.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactEvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <article className="min-w-0 rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
          {item.comparison_result.replace(/_/g, " ")}
        </span>
        <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
          {item.confidence} confidence
        </span>
      </div>
      <h4 className="text-[14px] font-black text-[#1A212B]">{item.source_label || "Evidence source"}</h4>
      {item.page_section && <p className="mt-1 text-[12px] font-medium text-gray-500">{item.page_section}</p>}
      {item.extracted_text && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[13px] font-medium leading-relaxed text-gray-700">
          {item.extracted_text}
        </p>
      )}
      <p className="mt-3 text-[13px] font-medium leading-relaxed text-gray-600">{item.explanation}</p>
    </article>
  );
}
