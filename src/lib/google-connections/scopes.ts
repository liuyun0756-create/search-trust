export const GOOGLE_SOURCES = ["gsc", "ga4", "gbp"] as const;
export type GoogleSource = (typeof GOOGLE_SOURCES)[number];

export const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile"] as const;

const SOURCE_SCOPES: Readonly<Record<GoogleSource, readonly string[]>> = {
  gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  gbp: ["https://www.googleapis.com/auth/business.manage"],
};

export class GoogleSourceInputError extends Error {
  constructor() {
    super("Google sources must contain one to three approved values.");
    this.name = "GoogleSourceInputError";
  }
}

function isGoogleSource(value: unknown): value is GoogleSource {
  return typeof value === "string" && GOOGLE_SOURCES.includes(value as GoogleSource);
}

export function parseGoogleSources(value: unknown): GoogleSource[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3 || !value.every(isGoogleSource)) {
    throw new GoogleSourceInputError();
  }
  const requested = new Set(value);
  return GOOGLE_SOURCES.filter((source) => requested.has(source));
}

export function requiredGoogleScopes(sources: readonly GoogleSource[]): string[] {
  const requested = new Set(sources);
  return [
    ...GOOGLE_IDENTITY_SCOPES,
    ...GOOGLE_SOURCES.flatMap((source) => requested.has(source) ? SOURCE_SCOPES[source] : []),
  ];
}

export function sourceHasRequiredScopes(source: GoogleSource, scopes: readonly string[]): boolean {
  const granted = new Set(scopes);
  return GOOGLE_IDENTITY_SCOPES.every((scope) => granted.has(scope)) &&
    SOURCE_SCOPES[source].every((scope) => granted.has(scope));
}

export function coveredGoogleSources(scopes: readonly string[]): GoogleSource[] {
  return GOOGLE_SOURCES.filter((source) => sourceHasRequiredScopes(source, scopes));
}

export function normalizeGrantedScopes(value: string | readonly string[]): string[] {
  const items = typeof value === "string" ? value.split(/\s+/) : value;
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].sort();
}
