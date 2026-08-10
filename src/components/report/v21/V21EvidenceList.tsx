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
  const items = safeList(evidenceItems).filter(hasReadableEvidence);

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
            <dd className="min-w-0">
              {source.items.map((item, index) => (
                <div
                  key={item.id || `${source.key}-${index}`}
                  className={index > 0 ? "mt-2.5 border-t border-gray-100 pt-2.5" : ""}
                >
                  <EvidenceValue item={item} />
                </div>
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
  const groupedEvidence = new Map<string, EvidenceGroup>();

  items.forEach((item, index) => {
    const field = evidenceField(item);
    const ruleId = evidenceRuleId(item.id);
    const normalizedTitle = normalizeLabel(item.source_label);
    const semanticKey = field?.key || (
      normalizedTitle ? `label-${normalizedTitle}` : `evidence-${item.id || index}`
    );
    // One triggered rule must remain one evidence card. Values from the same
    // rule (for example page and GBP values) still belong in the same card.
    const groupKey = ruleId ? `rule-${ruleId}-${semanticKey}` : semanticKey;
    const groupTitle = field?.title || item.source_label || "Evidence";

    const existing = groupedEvidence.get(groupKey);
    if (existing) {
      existing.items.push(item);
      return;
    }

    const group = { key: `field-${groupKey}`, title: groupTitle, items: [item] };
    groupedEvidence.set(groupKey, group);
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
  const ruleField = ruleEvidenceField(item.id);
  if (ruleField) return ruleField;

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

function ruleEvidenceField(id: string): { key: string; title: string } | null {
  const ruleId = evidenceRuleId(id);
  const fields: Record<number, { key: string; title: string }> = {
    1: { key: "local-specificity", title: "Local specificity" },
    2: { key: "service-specificity", title: "Service specificity" },
    3: { key: "real-world-anchor", title: "Real-world geographic anchor" },
    4: { key: "activity-trace", title: "Time and activity trace" },
    6: { key: "page-imagery", title: "Page imagery" },
    7: { key: "first-person-work", title: "First-person work detail" },
    8: { key: "calls-to-action", title: "Calls to action" },
    9: { key: "operational-responsibility", title: "Operational responsibility" },
    10: { key: "limits-complex-cases", title: "Limits and complex cases" },
    11: { key: "trust-signals", title: "Verifiable trust signals" },
    12: { key: "outcome-follow-up", title: "Outcome and follow-up" },
    13: { key: "similar-page-pattern", title: "Similar-page pattern" },
    14: { key: "standalone-value", title: "Standalone page value" },
    15: { key: "current-trust-signals", title: "Current trust signals" },
    16: { key: "search-demand-purpose", title: "Search-demand purpose" },
    17: { key: "business-identity-scope", title: "Business identity scope" },
    18: { key: "entity-category-fit", title: "Entity category fit" },
    19: { key: "sitewide-consistency", title: "Sitewide entity consistency" },
    20: { key: "entity-qualification", title: "Entity qualification" },
    21: { key: "business-identity", title: "Business identity" },
    22: { key: "address", title: "Address" },
    23: { key: "phone", title: "Phone" },
    24: { key: "service-area", title: "Service area" },
    25: { key: "business-hours", title: "Business hours" },
    26: { key: "business-name", title: "Business name" },
    27: { key: "address", title: "Address" },
    28: { key: "phone", title: "Phone" },
    29: { key: "service-area", title: "Service area" },
    30: { key: "community-context", title: "Community-level context" },
    31: { key: "landmark-reference", title: "Landmark reference" },
    32: { key: "local-context", title: "Local context" },
    33: { key: "service-boundary", title: "Service boundary" },
    34: { key: "specific-service-case", title: "Specific service case" },
    35: { key: "customer-context", title: "Customer context" },
    36: { key: "time-context", title: "Time and activity context" },
    37: { key: "review-service-detail", title: "Review service detail" },
    38: { key: "review-geography", title: "Review geographic context" },
    39: { key: "review-topic-fit", title: "Review topic alignment" },
  };
  return ruleId ? fields[ruleId] || null : null;
}

function evidenceRuleId(id: string): number | null {
  const match = String(id || "").match(/(?:^|-)rule-(\d+)(?:-|$)/);
  const value = Number(match?.[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
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
  if (extracted && !isTechnicalNoise(extracted)) return cleanMissingPrefix(extracted);

  const normalized = String(item.normalized_value || "").trim();
  if (normalized && !isTechnicalNoise(normalized)) return cleanMissingPrefix(normalized);

  if (item.comparison_result === "missing") return "Not found in the checked scope";
  if (item.comparison_result === "not_checked") return "No evidence was available in this audit";
  return "No recorded value";
}

function hasReadableEvidence(item: EvidenceItem): boolean {
  const extracted = String(item.extracted_text || "").trim();
  const normalized = String(item.normalized_value || "").trim();
  if (extracted && !isTechnicalNoise(extracted)) return true;
  if (normalized && !isTechnicalNoise(normalized)) return true;
  return !extracted && !normalized;
}

function cleanMissingPrefix(value: string): string {
  return value.replace(/^not found in (?:the )?checked (?:page )?scope:\s*/i, "").trim();
}

function isTechnicalNoise(value: string): boolean {
  const normalized = value.toLowerCase();
  if (["data:image", "base64,", "<svg", "viewbox=", "xmlns="].some((marker) => normalized.includes(marker))) {
    return true;
  }
  if (normalized.includes("wp-content/uploads") && (value.includes("![") || value.length > 180)) {
    return true;
  }
  return value.length > 220 && ((value.match(/%/g)?.length || 0) >= 5 || (value.match(/\//g)?.length || 0) >= 8);
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
