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
  showEmpty = false,
}: {
  evidenceItems?: EvidenceItem[] | null;
  viewMode?: V21ViewMode;
  density?: "standard" | "compact";
  showEmpty?: boolean;
}) {
  const [expanded, setExpanded] = useState(density === "compact");
  const items = safeList(evidenceItems);

  if (!isAnalystView(viewMode)) return null;
  if (!items.length) {
    return showEmpty ? (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-amber-800">
        No directly traceable evidence was included for this finding. A material conclusion should not be made from this record alone.
      </div>
    ) : null;
  }

  const cards = (
    <div className={density === "compact" ? "grid grid-cols-1 gap-3 lg:grid-cols-2" : "space-y-3"}>
      {items.map((item, index) => <EvidenceCard key={item.id || index} item={item} />)}
    </div>
  );

  if (density === "compact") {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-gray-500">Evidence and observations ({items.length})</p>
        {cards}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">Evidence and observations ({items.length})</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="border-t border-gray-100 px-4 py-4">{cards}</div>}
    </div>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const source = sourceLabel(item.source_type);
  const finding = findingLabel(item.comparison_result);
  return (
    <article className="min-w-0 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-gray-500">
        <span>{source}</span>
        <span>{finding}</span>
        <span>Confidence: {labelize(item.confidence)}</span>
      </div>
      <h4 className="mt-3 text-[14px] font-black text-[#1A212B]">{item.source_label || "Evidence source"}</h4>
      {item.page_section && <p className="mt-1 text-[12px] font-medium text-gray-500">Location: {item.page_section}</p>}
      {item.extracted_text && <blockquote className="mt-3 rounded-lg border-l-2 border-[#A5D020] bg-[#F8FAF5] px-3 py-2 text-[13px] font-medium leading-relaxed text-gray-700">{item.extracted_text}</blockquote>}
      {!item.extracted_text && item.normalized_value && <p className="mt-3 rounded-lg bg-[#F8FAF5] px-3 py-2 text-[13px] font-medium leading-relaxed text-gray-700"><span className="font-bold text-[#1A212B]">Recorded value: </span>{item.normalized_value}</p>}
      <p className="mt-3 text-[13px] font-medium leading-relaxed text-gray-600"><span className="font-bold text-[#1A212B]">Why it matters: </span>{item.explanation}</p>
    </article>
  );
}

function sourceLabel(value: EvidenceItem["source_type"]): string {
  const labels: Record<EvidenceItem["source_type"], string> = {
    page: "Observed on page", gbp: "GBP record", schema: "Page schema", contact_page: "Contact page",
    about_page: "About page", review: "Customer reviews", site_internal: "Site content", not_available: "Not verified in this audit",
  };
  return labels[value] || "Evidence source";
}

function findingLabel(value: EvidenceItem["comparison_result"]): string {
  const labels: Record<EvidenceItem["comparison_result"], string> = {
    match: "Aligned", mismatch: "Does not align", partial: "Partially supported", missing: "Missing", not_checked: "Needs verification",
  };
  return labels[value] || "Observation";
}

function labelize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Unknown";
}
