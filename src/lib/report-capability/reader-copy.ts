/** Presentation only: saved observations, paths and checksums remain intact. */
import type { CapabilityReport } from "./generated/types";

export function observationWarnings(report: CapabilityReport): string[] {
  const missing = new Set(report.evidence.filter(e => e.value === "site_missing" || e.value === "gbp_missing").map(e => e.id));
  return report.findings.some(f => f.rule_id.startsWith("v22_public.gbp_") && f.evidence_ids.some(id => missing.has(id)))
    ? ["Some saved business-detail findings refer to missing observations. Missing values do not establish a website/profile mismatch. Review those findings before approving client delivery; the original system report is retained below."] : [];
}

export function readerLimit(value: string): string {
  const known: Record<string, string> = {
    GSC_BREAKDOWNS_NOT_ADDITIVE: "Search Console breakdowns are not additive; do not sum separate dimensions.",
    GSC_QUERY_PRIVACY_FILTERING: "Search Console omits some queries for privacy; the visible rows are not the complete query set.",
    GSC_SELECTED_PROPERTY_SCOPE: "Search Console evidence covers the selected property only.",
    GSC_TOP_ROWS_ONLY: "Search Console evidence contains the returned top rows, not every row.",
    GSC_WEB_ONLY: "Search Console evidence covers web search only.",
  };
  if (known[value]) return known[value];
  if (value === "candidate_exhausted") return "The checked pages did not provide a usable business detail. Confirm it directly before proposing a correction.";
  if (value.includes("for this offline evaluation")) return "The website and public business profile were compared for the confirmed business.";
  if (value === "Customer public GBP identity: strong_id_matched.") return "The public business profile matched the confirmed business identity.";
  if (value === "SERP_LOCAL_PACK_SECTION_INVALID") return "The search-result local pack could not be read reliably; it is not evidence that the business is absent.";
  if (/^v22_public\.[\w.]+: [\w_]+$/.test(value)) {
    if (value.includes("gbp_")) return "Some public business details could not be compared reliably. Confirm the current details before proposing a correction.";
    if (value.includes("competitor_")) return "The saved page samples do not establish a service-page gap. Check the existing pages before proposing a new one.";
    return "Some search comparisons remain unverified because the sample or business identity was insufficient. This does not establish a ranking problem.";
  }
  const privateRule = value.match(/^V22\.(?:FIRST_PARTY|CROSS_SOURCE)\.([A-Z0-9_.]+): ([a-z_]+)$/);
  if (privateRule) {
    const check = privateRule[1].replaceAll("GSC", "Search Console").replaceAll("GA4", "Analytics").replaceAll("GBP", "Business Profile").replace(/[_.]/g, " ").toLowerCase();
    return privateRule[2] === "no_issue" ? `No finding was produced for the ${check} check.`
      : `The ${check} check remains unverified: ${privateRule[2].replaceAll("_", " ")}.`;
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(value)) return `Source limitation: ${value.replaceAll("_", " ").toLowerCase()}.`;
  return value;
}

const SAMPLE_TARGET = /^(.+) · (organic|maps|local_pack) · -?\d+(?:\.\d+)?,-?\d+(?:\.\d+)? · [a-z]{2}(?:-[A-Za-z]{2})? · (mobile|desktop)$/;
const SAMPLE_TYPES: Record<string, string> = { organic: "Organic search", maps: "Maps", local_pack: "Search-result local pack" };

/** Client reading: system search-sample targets keep the query and result type; coordinates, language and device stay in SEO views. */
export function readerTarget(value: string): string {
  return [...new Set(value.split("\n").map(line => {
    const sample = line.match(SAMPLE_TARGET);
    return sample ? `${sample[1]} · ${SAMPLE_TYPES[sample[2]]}` : line;
  }))].join("\n");
}

const GROUPED_LIMITS: ReadonlyArray<readonly [string, string]> = [
  ["Domain coverage remains unverified for these saved samples:\n", "Some saved search samples do not support a reliable domain coverage judgment. This does not establish absence or a ranking problem."],
  ["Full competitor-position comparisons remain incomplete for these saved samples:\n", "Some competitor-position comparisons could not be completed. The observed client positions do not establish an absolute ranking."],
];

/** Full text remains the default for consumers without an expandable view. */
export function readerLimits(values: string[], compact = false): string[] {
  return [...new Set(values.map(value => compact
    ? GROUPED_LIMITS.find(([prefix]) => value.startsWith(prefix))?.[1] ?? readerLimit(value)
    : readerLimit(value)))];
}

/** The original query/type sentences, shown in a closed disclosure on the web. */
export function readerLimitDetails(values: string[]): string[] {
  return [...new Set(values.filter(value => GROUPED_LIMITS.some(([prefix]) => value.startsWith(prefix))).map(readerLimit))];
}

const labels: Record<string, string> = {
  position: "Observed search position", rank_source: "Position source", result_type: "Search result type",
  url: "Observed page", status: "Collection status", state: "Observation status",
  business_name: "Business name", address: "Address", phone: "Phone number", service_areas: "Service areas",
  html: "Checked page content", title: "Page title", status_code: "Page response", robots_directives: "Indexing instructions",
};
export function evidenceFieldLabel(path: string): string {
  const paths = path.split("\n");
  if (paths.length > 1) return "Saved source observations";
  const parts = path.split("/").filter(Boolean);
  return labels[parts.at(-1) ?? ""] ?? "Saved source observation";
}

export function evidenceValue(value: unknown): string {
  if (value === null) return "Not observed";
  if (value === "site_missing") return "Not observed in the checked website sample";
  if (value === "gbp_missing") return "Not observed in the saved public business profile";
  if (value === "provider_position") return "Position supplied by the search provider";
  if (value === "maps") return "Maps";
  if (value === "local_pack") return "Search-result local pack";
  if (value === "organic") return "Organic search";
  if (value === "succeeded") return "Collected successfully";
  return String(value);
}

/** Client evidence labels only; never rewrite the stored source or scope. */
const SOURCE_LABELS: Record<string, string> = {
  site: "Website sample", serp: "Search sample", competitor: "Competitor sample",
  public_gbp: "Public business profile", official_gbp: "Connected business profile", gbp: "Business profile",
  gsc: "Search Console", ga4: "Analytics", rendered: "Rendered page", citation: "Business listings",
};
export function evidenceSourceLabel(source?: string): string {
  return SOURCE_LABELS[source ?? ""] ?? "Saved source";
}

export function readerDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
}

export function readerScope(value: string): string {
  return readerTarget(value).split("\n").map(line => {
    const saved = line.match(/^Saved (site|serp|competitor|public_gbp|rendered) sample(.*)$/);
    if (saved) return `${evidenceSourceLabel(saved[1])}${saved[2]}`;
    const prefix = line.match(/^(site|serp|competitor|public_gbp|official_gbp|gbp|gsc|ga4|rendered|citation) · (.*)$/);
    return prefix ? `${evidenceSourceLabel(prefix[1])} · ${prefix[2]}` : line;
  }).join("\n");
}

export function evidenceScopes(items: { comparison_scope?: string }[]): string[] {
  return [...new Set(items.flatMap(item => item.comparison_scope ? readerScope(item.comparison_scope).split("\n") : []))];
}

type FindingDisplay = Pick<CapabilityReport["findings"][number], "kind" | "status" | "observed_fact" | "judgment" | "impact_path">
  & {coverage?: ReadonlyArray<{source:string;checked:boolean}> | null};
const FINDING_STATUSES = { confirmed: "Confirmed", not_detected: "Not detected", not_checked: "Not checked", not_assessed: "Not assessed" };
export function findingLabels(finding: FindingDisplay) {
  return {
    kind: finding.kind ? {fact:"Fact", inference:"Inference", recommendation:"Recommendation"}[finding.kind] : "Unlabelled",
    status: finding.status ? FINDING_STATUSES[finding.status] : "Unlabelled",
    coverage: finding.coverage?.map(c=>`${c.checked ? "✓" : "✕"} ${evidenceSourceLabel(c.source)}`) ?? [],
  };
}

/** Neutral client copy is a view, never a mutation of the saved finding. */
export function readerFinding(finding: FindingDisplay) {
  const observed_fact = finding.observed_fact.replace(/\s*\(rank_source=[a-z_]+\)/g, "");
  const copy = observed_fact === finding.observed_fact ? finding : {...finding, observed_fact};
  if (!finding.status || finding.status === "confirmed") return copy;
  const judgment = {
    not_detected: "Not detected in the checked sample. This does not show that it is absent.",
    not_checked: "This could not be checked with the available evidence.",
    not_assessed: finding.kind === "inference" ? "This is an interpretation to assess, not a confirmed fact."
      : finding.kind === "recommendation" ? "This is a recommendation to review, not a confirmed fact."
      : "The available observations do not establish an overall assessment.",
  }[finding.status];
  return {...copy, judgment, impact_path:"No cause or business impact is established by this item."};
}

const CONTACT_FIELDS = {phone:"Phone", address:"Address", business_name:"Name", service_area:"Service area", opening_hours:"Opening hours"};
const CONTACT_COMPONENTS: Record<string,string> = {
  phone:"phone number", number:"phone number", extension:"extension", house:"house number",
  street:"street", city:"city", region:"region", postal:"postcode", country:"country", unit:"unit",
  remaining_address_components:"other address parts",
};
export function contactCheckLabel(check: NonNullable<CapabilityReport["contact_checks"]>[number]): string {
  if (check.field === "opening_hours") {
    const result = {match:"Published hours match for all seven days", partial_match:"Published hours match for the compared days",
      mismatch:"The published hours on the two channels differ. Please check both channels", none:"Published hours could not be compared"}[check.result];
    const basis = check.result === "none" ? "" : check.basis === "structured" ? "Website structured data" : "Website text";
    const days = (values: string[]) => values.filter(v => ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(v)).join(", ");
    return [`Opening hours · ${result}`, basis, check.compared_components.length ? `Compared: ${days(check.compared_components)}` : "",
      check.omitted_components.length ? `Not compared: ${days(check.omitted_components)}` : ""].filter(Boolean).join(" · ");
  }
  const result = {match:"Matches business profile", partial_match:"Partly matches business profile",
    mismatch:"Differs from business profile", none:check.status === "not_detected"
      ? "Not detected on the site" : FINDING_STATUSES[check.status]}[check.result];
  const label = `${CONTACT_FIELDS[check.field]} · ${result}`;
  const basis = check.basis === "text_pattern" ? "based on text recognition"
    : check.basis === "rendered" ? "based on a rendered page" : "";
  const parts = (values:string[]) => values.map(p=>CONTACT_COMPONENTS[p] ?? "other details").join(", ");
  const scope = check.compared_components.length && (check.basis !== "structured" || check.omitted_components.length)
    ? `${parts(check.compared_components)} only` : "";
  const omitted = check.omitted_components.length ? `${parts(check.omitted_components)} not compared` : "";
  return [label,basis,scope,omitted].filter(Boolean).join(" · ");
}
