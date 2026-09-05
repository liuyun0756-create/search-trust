export const REDACTED = "[REDACTED]";
const CIRCULAR = "[CIRCULAR]";
const MAX_STRING_LENGTH = 2_000;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "proxy_authorization",
  "cookie",
  "set_cookie",
  "code",
  "state",
  "pkce_verifier",
  "code_verifier",
  "access_token",
  "refresh_token",
  "id_token",
  "google_token",
  "client_secret",
  "secret",
]);

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function sanitizeString(input: string): string {
  return input
    .slice(0, MAX_STRING_LENGTH)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\bya29\.[A-Za-z0-9._-]+\b/g, REDACTED)
    .replace(/\b1\/\/[A-Za-z0-9._-]+\b/g, REDACTED)
    .replace(
      /([?&]|\b)(code|state|access_token|refresh_token|id_token|code_verifier|client_secret)=([^&\s]*)/gi,
      (_match, prefix: string, key: string) => `${prefix}${key}=${REDACTED}`,
    );
}

function sanitize(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean" || value === undefined) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (depth >= 8) return "[MAX_DEPTH]";

  if (value instanceof Error) {
    return { name: sanitizeString(value.name), message: sanitizeString(value.message) };
  }
  if (value instanceof URL) return sanitizeString(value.toString());
  if (typeof value !== "object") return sanitizeString(String(value));
  if (seen.has(value)) return CIRCULAR;
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTED : sanitize(item, seen, depth + 1);
  }
  return output;
}

export function safeLogValue(value: unknown): unknown {
  return sanitize(value, new WeakSet(), 0);
}

export function safeLogError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: sanitizeString(error.name),
      message: sanitizeString(error.message),
    };
  }
  return { name: "UnknownError", message: sanitizeString(String(error)) };
}
