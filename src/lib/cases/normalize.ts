import { isIP } from "node:net";

import type { BusinessIdentity } from "@/lib/report-v22/generated/types";
import {
  type CaseListQuery,
  type CaseLocation,
  type CaseLocationInput,
  type CaseOperatingModel,
  type CreateCaseRequest,
  type UpdateCaseRequest,
  type ValidationIssue,
  validateCreateCaseRequest,
  validateUpdateCaseRequest,
} from "./contracts";
import { CaseApiError } from "./errors";

export interface NormalizedCreateCaseInput {
  draft_case_id: string | null;
  site_url: string;
  normalized_domain: string;
  business_name: string;
  operating_model: CaseOperatingModel;
  primary_service: string;
  primary_location: CaseLocation;
  target_market: CaseLocation;
  public_gbp_url: string | null;
  business_identity: BusinessIdentity;
  location_key: string;
}

export interface NormalizedUpdateCaseInput {
  business_name?: string;
  operating_model?: CaseOperatingModel;
  primary_service?: string;
  primary_location?: CaseLocation;
  target_market?: CaseLocation;
  public_gbp_url?: string | null;
  status?: "active";
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedRequiredText(value: string, path: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    throw CaseApiError.invalid([{ path, message: "must not be blank" }]);
  }
  return normalized;
}

function normalizedNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  return normalizeWhitespace(value) || null;
}

function normalizeDraftCaseId(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw CaseApiError.invalid([{ path: "/draft_case_id", message: "must be a UUID v4" }]);
  }
  return normalized;
}

function normalizeLocation(input: CaseLocationInput, path: string): CaseLocation {
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  if ((latitude === null) !== (longitude === null)) {
    throw CaseApiError.invalid([{
      path,
      message: "latitude and longitude must both be numbers or both be null",
    }]);
  }

  return {
    display_name: normalizedRequiredText(input.display_name, `${path}/display_name`),
    country_code: input.country_code.trim().toUpperCase(),
    region: normalizedNullableText(input.region),
    city: normalizedNullableText(input.city),
    postal_code: normalizedNullableText(input.postal_code),
    latitude,
    longitude,
  };
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb");
}

function assertPublicHostname(hostname: string, path: string): void {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    throw CaseApiError.invalid([{ path, message: "must use a public hostname" }]);
  }
  const version = isIP(normalized);
  if ((version === 4 && isPrivateIpv4(normalized)) || (version === 6 && isPrivateIpv6(normalized))) {
    throw CaseApiError.invalid([{ path, message: "must not use a private or local IP address" }]);
  }
}

function parseUrl(value: string, path: string): URL {
  try {
    return new URL(value.trim());
  } catch {
    throw CaseApiError.invalid([{ path, message: "must be an absolute URL" }]);
  }
}

export function normalizeSiteUrl(value: string): { siteUrl: string; normalizedDomain: string } {
  const url = parseUrl(value, "/site_url");
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw CaseApiError.invalid([{ path: "/site_url", message: "must use HTTP or HTTPS" }]);
  }
  if (url.username || url.password) {
    throw CaseApiError.invalid([{ path: "/site_url", message: "must not contain credentials" }]);
  }
  assertPublicHostname(url.hostname, "/site_url");
  url.search = "";
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  const normalizedDomain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalizedDomain) ||
    normalizedDomain.includes("..") ||
    normalizedDomain.startsWith("-") ||
    normalizedDomain.endsWith("-")
  ) {
    throw CaseApiError.invalid([{ path: "/site_url", message: "must use a valid public domain" }]);
  }
  return { siteUrl: url.toString(), normalizedDomain };
}

export function normalizePublicGbpUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const url = parseUrl(value, "/public_gbp_url");
  if (url.protocol !== "https:") {
    throw CaseApiError.invalid([{ path: "/public_gbp_url", message: "must use HTTPS" }]);
  }
  if (url.username || url.password) {
    throw CaseApiError.invalid([{ path: "/public_gbp_url", message: "must not contain credentials" }]);
  }
  assertPublicHostname(url.hostname, "/public_gbp_url");
  url.hash = "";
  return url.toString();
}

function locationPart(value: string | null): string {
  return normalizeWhitespace(value ?? "").toLowerCase();
}

export function caseLocationKey(location: CaseLocation): string {
  if (location.latitude !== null && location.longitude !== null) {
    return `geo:${location.latitude.toFixed(6)}:${location.longitude.toFixed(6)}`;
  }
  return `place:${[
    location.country_code,
    location.region,
    location.city,
    location.postal_code,
    location.display_name,
  ].map(locationPart).join("|")}`;
}

export function buildBusinessIdentity(input: {
  businessName: string;
  siteUrl: string;
  normalizedDomain: string;
  operatingModel: CaseOperatingModel;
  primaryLocation: CaseLocation;
  publicGbpUrl: string | null;
}): BusinessIdentity {
  return {
    business_name: input.businessName,
    site_url: input.siteUrl,
    normalized_domain: input.normalizedDomain,
    operating_model: input.operatingModel,
    primary_location: input.primaryLocation,
    public_gbp_url: input.publicGbpUrl,
  };
}

export function parseCreateCaseInput(value: unknown): NormalizedCreateCaseInput {
  const validation = validateCreateCaseRequest(value);
  if (!validation.ok) throw CaseApiError.invalid(validation.issues);
  const request: CreateCaseRequest = validation.value;
  const { siteUrl, normalizedDomain } = normalizeSiteUrl(request.site_url);
  const businessName = normalizedRequiredText(request.business_name, "/business_name");
  const primaryService = normalizedRequiredText(request.primary_service, "/primary_service");
  const primaryLocation = normalizeLocation(request.primary_location, "/primary_location");
  const targetMarket = normalizeLocation(request.target_market, "/target_market");
  const publicGbpUrl = normalizePublicGbpUrl(request.public_gbp_url);
  const businessIdentity = buildBusinessIdentity({
    businessName,
    siteUrl,
    normalizedDomain,
    operatingModel: request.operating_model,
    primaryLocation,
    publicGbpUrl,
  });

  return {
    draft_case_id: normalizeDraftCaseId(request.draft_case_id),
    site_url: siteUrl,
    normalized_domain: normalizedDomain,
    business_name: businessName,
    operating_model: request.operating_model,
    primary_service: primaryService,
    primary_location: primaryLocation,
    target_market: targetMarket,
    public_gbp_url: publicGbpUrl,
    business_identity: businessIdentity,
    location_key: caseLocationKey(primaryLocation),
  };
}

export function parseUpdateCaseInput(value: unknown): NormalizedUpdateCaseInput {
  const validation = validateUpdateCaseRequest(value);
  if (!validation.ok) throw CaseApiError.invalid(validation.issues);
  const request: UpdateCaseRequest = validation.value;
  if (request.status && Object.keys(request).length !== 1) {
    throw CaseApiError.invalid([{
      path: "/status",
      message: "restoration cannot be combined with confirmation updates",
    }]);
  }

  return {
    ...(request.business_name !== undefined
      ? { business_name: normalizedRequiredText(request.business_name, "/business_name") }
      : {}),
    ...(request.operating_model !== undefined ? { operating_model: request.operating_model } : {}),
    ...(request.primary_service !== undefined
      ? { primary_service: normalizedRequiredText(request.primary_service, "/primary_service") }
      : {}),
    ...(request.primary_location !== undefined
      ? { primary_location: normalizeLocation(request.primary_location, "/primary_location") }
      : {}),
    ...(request.target_market !== undefined
      ? { target_market: normalizeLocation(request.target_market, "/target_market") }
      : {}),
    ...(request.public_gbp_url !== undefined
      ? { public_gbp_url: normalizePublicGbpUrl(request.public_gbp_url) }
      : {}),
    ...(request.status ? { status: request.status } : {}),
  };
}

export function parseCaseListQuery(searchParams: URLSearchParams): CaseListQuery {
  const allowed = new Set(["status", "limit", "offset"]);
  const issues: ValidationIssue[] = [];
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) issues.push({ path: `/query/${key}`, message: "is not allowed" });
    if (searchParams.getAll(key).length > 1) issues.push({ path: `/query/${key}`, message: "must appear once" });
  }

  const status = searchParams.get("status") ?? "active";
  if (!(["active", "archived", "all"] as const).includes(status as CaseListQuery["status"])) {
    issues.push({ path: "/query/status", message: "must be active, archived, or all" });
  }

  const parseInteger = (name: "limit" | "offset", fallback: number, min: number, max: number) => {
    const raw = searchParams.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) {
      issues.push({ path: `/query/${name}`, message: "must be an integer" });
      return fallback;
    }
    const value = Number(raw);
    if (value < min || value > max) {
      issues.push({ path: `/query/${name}`, message: `must be between ${min} and ${max}` });
      return fallback;
    }
    return value;
  };

  const limit = parseInteger("limit", 20, 1, 100);
  const offset = parseInteger("offset", 0, 0, 10_000);
  if (issues.length) throw CaseApiError.invalid(issues);
  return { status: status as CaseListQuery["status"], limit, offset };
}

export function parseCaseId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw CaseApiError.invalid([{ path: "/id", message: "must be a UUID" }]);
  }
  return value;
}
