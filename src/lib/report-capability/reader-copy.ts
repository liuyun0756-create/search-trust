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

export function readerLimits(values: string[]): string[] {
  return [...new Set(values.map(readerLimit))];
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
