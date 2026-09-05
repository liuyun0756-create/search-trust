import type { ClientCase } from "@/types/database";
import type { GoogleResource } from "./contracts";

export type CaseIdentity = Pick<ClientCase, "site_url" | "business_name" | "business_identity" | "operating_model" | "target_market" | "updated_at">;
export interface IdentityAssessment {
  version: "v22-052.1";
  status: "matched" | "needs_confirmation" | "mismatch";
  confidence: "high" | "medium" | "low";
  reasons: IdentityReason[];
}
export const IDENTITY_REASONS = {
  CASE_WEBSITE_MISSING: "The Case website cannot be compared.",
  DOMAIN_EXACT: "The domain property exactly matches the Case website host.",
  DOMAIN_BROADER: "The domain property also covers other subdomains. Confirm its scope is appropriate.",
  URL_EXACT: "The URL-prefix property matches the Case website scope.",
  URL_SCOPE_REVIEW: "The property covers a broader or narrower section of this website.",
  WEBSITE_CONFLICT: "The selected resource points to a different website or unrelated website section.",
  WEBSITE_VARIANT: "The website uses a different protocol, www host, or related subdomain. Confirm the relationship.",
  STREAMS_EXACT: "All available web streams point to the Case website.",
  STREAMS_MIXED: "Only part of this property's web-stream evidence matches. It may include other websites.",
  WEBSITE_MISSING: "Website evidence is missing or invalid; it cannot establish a match.",
  WEBSITE_EXACT: "The Business Profile website matches the Case website.",
  NAME_EXACT: "The business names match after case and whitespace normalization.",
  NAME_REVIEW: "The business name differs or is missing. Check the business and branch.",
  COUNTRY_CONFLICT: "The Business Profile address and Case are in different countries.",
  ADDRESS_MATCH: "Country, city and postal code match. This alone does not identify a branch.",
  ADDRESS_REVIEW: "Address details are incomplete or differ. Check the correct branch.",
  SERVICE_AREA_MATCH: "A listed service-area name matches the Case location; actual coverage still needs confirmation.",
  SERVICE_AREA_REVIEW: "Service-area coverage is missing or cannot be established from the listed names.",
  BRANCH_EXACT: "The branch-specific website, business name, country, city and postal code all match.",
  BRANCH_REVIEW: "The available evidence cannot automatically distinguish this branch from other locations.",
} as const;
export type IdentityReason = keyof typeof IDENTITY_REASONS;

function result(status: IdentityAssessment["status"], confidence: IdentityAssessment["confidence"], ...reasons: IdentityReason[]): IdentityAssessment {
  return { version: "v22-052.1", status, confidence, reasons };
}
function url(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    parsed.hostname = parsed.hostname.replace(/\.$/, "");
    return parsed;
  } catch { return null; }
}
function normalized(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function equalText(a: unknown, b: unknown): boolean { return !!normalized(a) && normalized(a) === normalized(b); }
function path(value: URL): string { return value.pathname.replace(/\/+$/, "") || "/"; }
function containsPath(a: string, b: string): boolean { return a === "/" || a === b || b.startsWith(`${a}/`); }
function relatedHost(a: string, b: string): boolean { return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`); }
function websiteMatch(target: URL, candidate: URL): "exact" | "review" | "conflict" {
  if (!relatedHost(target.hostname, candidate.hostname)) return "conflict";
  if (!containsPath(path(target), path(candidate)) && !containsPath(path(candidate), path(target))) return "conflict";
  return target.origin === candidate.origin && path(target) === path(candidate) ? "exact" : "review";
}

export function caseIdentityClues(identity: CaseIdentity) {
  const location = object(identity.business_identity.primary_location);
  return {
    business_name: identity.business_name, site_url: identity.site_url,
    operating_model: identity.operating_model,
    location: [location.display_name, location.city, location.region, location.postal_code, location.country_code]
      .filter((v): v is string => typeof v === "string" && !!v.trim()).join(", ") || null,
  };
}

export function assessIdentity(identity: CaseIdentity, resource: GoogleResource): IdentityAssessment {
  const target = url(identity.site_url);
  if (!target) return result("needs_confirmation", "low", "CASE_WEBSITE_MISSING");
  if (resource.source === "gsc") {
    if (resource.id.startsWith("sc-domain:")) {
      const raw = resource.id.slice(10);
      const domain = url(`https://${raw}`);
      if (!domain || !/^[\p{L}\p{N}.-]+$/u.test(raw) || !domain.hostname.includes(".") || domain.hostname.includes("..")) {
        return result("needs_confirmation", "low", "WEBSITE_MISSING");
      }
      if (domain.hostname === target.hostname) return path(target) === "/"
        ? result("matched", "high", "DOMAIN_EXACT") : result("needs_confirmation", "medium", "DOMAIN_BROADER");
      if (target.hostname.endsWith(`.${domain.hostname}`)) return result("needs_confirmation", "medium", "DOMAIN_BROADER");
      return result("mismatch", "low", "WEBSITE_CONFLICT");
    }
    const property = url(resource.id);
    if (!property) return result("needs_confirmation", "low", "WEBSITE_MISSING");
    const comparison = websiteMatch(target, property);
    if (comparison === "exact") return result("matched", "high", "URL_EXACT");
    if (comparison === "conflict") return result("mismatch", "low", "WEBSITE_CONFLICT");
    return result("needs_confirmation", "medium", target.origin === property.origin ? "URL_SCOPE_REVIEW" : "WEBSITE_VARIANT");
  }
  const urls = resource.website_urls.map(url);
  const comparisons = urls.filter((v): v is URL => !!v).map(value => websiteMatch(target, value));
  if (resource.source === "ga4") {
    // A blank stream must not disappear and make the remaining stream look complete.
    const incomplete = resource.website_evidence_incomplete === true || urls.some(v => !v);
    if (comparisons.length === 0) return result("needs_confirmation", "low", "WEBSITE_MISSING");
    if (!incomplete && comparisons.every(v => v === "exact")) return result("matched", "high", "STREAMS_EXACT");
    if (!incomplete && comparisons.every(v => v === "conflict")) return result("mismatch", "low", "WEBSITE_CONFLICT");
    return result("needs_confirmation", comparisons.includes("exact") ? "medium" : "low",
      comparisons.includes("conflict") ? "STREAMS_MIXED" : "WEBSITE_VARIANT", ...(incomplete ? ["WEBSITE_MISSING" as const] : []));
  }
  const reasons: IdentityReason[] = [];
  if (comparisons.length && comparisons.every(v => v === "conflict")) return result("mismatch", "low", "WEBSITE_CONFLICT");
  const exactWebsite = comparisons.length > 0 && comparisons.length === urls.length && comparisons.every(v => v === "exact")
    && resource.website_evidence_incomplete !== true;
  reasons.push(!comparisons.length ? "WEBSITE_MISSING" : exactWebsite ? "WEBSITE_EXACT" : "WEBSITE_VARIANT");
  const exactName = equalText(identity.business_name, resource.name);
  reasons.push(exactName ? "NAME_EXACT" : "NAME_REVIEW");
  const location = object(identity.business_identity.primary_location);
  const address = resource.location_address;
  if (normalized(location.country_code) && normalized(address?.country_code) && !equalText(location.country_code, address?.country_code)) {
    return result("mismatch", "low", ...reasons, "COUNTRY_CONFLICT");
  }
  const exactAddress = equalText(location.country_code, address?.country_code) && equalText(location.city, address?.city)
    && equalText(location.postal_code, address?.postal_code);
  reasons.push(exactAddress ? "ADDRESS_MATCH" : "ADDRESS_REVIEW");
  if (identity.operating_model !== "storefront") {
    const areaMatch = resource.service_areas.some(area => equalText(area, location.city) || equalText(area, location.display_name));
    reasons.push(areaMatch ? "SERVICE_AREA_MATCH" : "SERVICE_AREA_REVIEW");
  }
  if (identity.operating_model === "storefront" && exactWebsite && exactName && exactAddress && path(target) !== "/") {
    return result("matched", "high", ...reasons, "BRANCH_EXACT");
  }
  return result("needs_confirmation", exactWebsite && exactName ? "medium" : "low", ...reasons, "BRANCH_REVIEW");
}
