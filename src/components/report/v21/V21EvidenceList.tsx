"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EvidenceItem } from "@/lib/report-v21";
import { safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

type EvidenceGroup = {
  key: string;
  title: string;
  items: EvidenceItem[];
};

type EvidenceSourceGroup = {
  key: string;
  label: string;
  items: EvidenceItem[];
};

const SOURCE_ORDER: EvidenceItem["source_type"][] = [
  "page",
  "gbp",
  "schema",
  "contact_page",
  "about_page",
  "site_internal",
  "review",
  "not_available",
];

const GENERIC_SECTIONS = new Set([
  "main page",
  "google business profile",
  "structured page-to-gbp comparison",
  "checked review corpus",
]);

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
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-gray-600">
        No evidence was recorded for this finding.
      </div>
    ) : null;
  }

  const groups = groupEvidenceItems(items);
  const cards = (
    <div className={density === "compact" ? "grid grid-cols-1 gap-3 lg:grid-cols-2" : "space-y-3"}>
      {groups.map((group) => <EvidenceFieldCard key={group.key} group={group} />)}
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

function EvidenceFieldCard({ group }: { group: EvidenceGroup }) {
  const sources = groupEvidenceBySource(group.items);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
      <header className="border-b border-gray-100 px-4 py-3">
        <h4 className="text-[14px] font-black text-[#1A212B]">{group.title}</h4>
      </header>
      <dl className="divide-y divide-gray-100">
        {sources.map((source) => (
          <div key={source.key} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[12px] font-bold text-gray-500">{source.label}</dt>
            <dd className="min-w-0 space-y-2.5">
              {source.items.map((item, index) => (
                <EvidenceValue key={item.id || `${source.key}-${index}`} item={item} />
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function EvidenceValue({ item }: { item: EvidenceItem }) {
  const value = recordedValue(item);
  const section = displaySection(item.page_section);

  return (
    <div className="min-w-0">
      <p className="whitespace-pre-line break-words text-[13px] font-medium leading-relaxed text-gray-700">{value}</p>
      {section && <p className="mt-0.5 text-[11px] font-medium text-gray-400">{section}</p>}
    </div>
  );
}

function groupEvidenceItems(items: EvidenceItem[]): EvidenceGroup[] {
  const groups: EvidenceGroup[] = [];
  const groupedFields = new Map<string, EvidenceGroup>();

  items.forEach((item, index) => {
    const field = evidenceField(item);
    if (!field) {
      groups.push({
        key: `evidence-${item.id || index}`,
        title: item.source_label || "Evidence",
        items: [item],
      });
      return;
    }

    const existing = groupedFields.get(field.key);
    if (existing) {
      existing.items.push(item);
      return;
    }

    const group = { key: `field-${field.key}`, title: field.title, items: [item] };
    groupedFields.set(field.key, group);
    groups.push(group);
  });

  return groups;
}

function groupEvidenceBySource(items: EvidenceItem[]): EvidenceSourceGroup[] {
  const groups = new Map<EvidenceItem["source_type"], EvidenceSourceGroup>();

  [...items]
    .sort((left, right) => SOURCE_ORDER.indexOf(left.source_type) - SOURCE_ORDER.indexOf(right.source_type))
    .forEach((item) => {
      const existing = groups.get(item.source_type);
      if (existing) {
        existing.items.push(item);
        return;
      }

      groups.set(item.source_type, {
        key: item.source_type,
        label: sourceLabel(item.source_type),
        items: [item],
      });
    });

  return [...groups.values()];
}

function evidenceField(item: EvidenceItem): { key: string; title: string } | null {
  const label = normalizeLabel(item.source_label);

  if (item.source_type === "review" || /\b(review|testimonial)s?\b/.test(label)) {
    return { key: "customer-reviews", title: "Customer reviews" };
  }

  const fields: Array<{ key: string; title: string; pattern: RegExp }> = [
    { key: "service-area", title: "Service area", pattern: /\bservice areas?\b/ },
    { key: "business-name", title: "Business name", pattern: /\b(?:business )?name\b/ },
    { key: "address", title: "Address", pattern: /\baddress(?:es)?\b/ },
    { key: "phone", title: "Phone", pattern: /\b(phone|telephone)(?: number)?s?\b/ },
    { key: "website", title: "Website", pattern: /\b(website|site url)\b/ },
    { key: "business-hours", title: "Business hours", pattern: /\b(opening |business )?hours\b/ },
    { key: "business-type", title: "Business type", pattern: /\b(business |schema )?type\b/ },
  ];

  const match = fields.find((field) => field.pattern.test(label));
  return match ? { key: match.key, title: match.title } : null;
}

function normalizeLabel(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordedValue(item: EvidenceItem): string {
  const extracted = String(item.extracted_text || "").trim();
  if (extracted) return extracted;

  const normalized = String(item.normalized_value || "").trim();
  if (normalized) return normalized;

  if (item.comparison_result === "missing") return "Not found in the checked scope";
  if (item.comparison_result === "not_checked") return "No evidence was available in this audit";
  return "No recorded value";
}

function displaySection(value?: string | null): string | null {
  const section = String(value || "").trim();
  if (!section || GENERIC_SECTIONS.has(section.toLowerCase())) return null;
  return section;
}

function sourceLabel(value: EvidenceItem["source_type"]): string {
  const labels: Record<EvidenceItem["source_type"], string> = {
    page: "Target page",
    gbp: "GBP",
    schema: "Schema",
    contact_page: "Contact page",
    about_page: "About page",
    review: "Customer reviews",
    site_internal: "Supporting page",
    not_available: "Unavailable source",
  };
  return labels[value] || "Evidence source";
}
