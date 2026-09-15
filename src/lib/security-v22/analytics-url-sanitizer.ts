import type { CaptureResult } from "posthog-js";

const SENSITIVE_PAYMENT_KEYS = new Set([
  "payment",
  "paymentid",
  "orderid",
  "checkoutsessionid",
]);

const MAX_DEPTH = 24;
const MAX_NODES = 2_000;
const TRUNCATED = "[Redacted: value exceeded privacy scan limit]";

function isSensitivePaymentKey(key: string): boolean {
  return SENSITIVE_PAYMENT_KEYS.has(key.toLowerCase().replace(/[^a-z\d]/gu, ""));
}

function decodedKey(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

function redactSensitiveAssignments(value: string): string {
  return value.replace(/(^|[?&#;])([^=?&#;\s]+)=([^&#;\s]*)/gu, (match, prefix: string, key: string) => (
    isSensitivePaymentKey(decodedKey(key)) ? `${prefix}${key}=[redacted]` : match
  ));
}

function sanitizeFragment(value: string): string {
  if (!value) return value;
  const content = value.startsWith("#") ? value.slice(1) : value;
  const queryIndex = content.indexOf("?");
  if (queryIndex < 0) return `#${redactSensitiveAssignments(content)}`;
  const route = content.slice(0, queryIndex);
  const params = new URLSearchParams(content.slice(queryIndex + 1));
  for (const key of [...params.keys()]) {
    if (isSensitivePaymentKey(key)) params.delete(key);
  }
  const query = params.toString();
  return `#${route}${query ? `?${query}` : ""}`;
}

export function sanitizeAnalyticsUrl(value: string): string {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//iu.test(value);
  const pathRelative = value.startsWith("/");
  const queryRelative = value.startsWith("?");
  const fragmentRelative = value.startsWith("#");
  if (!absolute && !pathRelative && !queryRelative && !fragmentRelative) return redactSensitiveAssignments(value);
  try {
    const parsed = new URL(value, "https://analytics.invalid");
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitivePaymentKey(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = sanitizeFragment(parsed.hash);
    if (absolute) return parsed.toString();
    if (queryRelative) return `${parsed.search}${parsed.hash}`;
    if (fragmentRelative) return parsed.hash;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return redactSensitiveAssignments(value);
  }
}

function sanitizeValue(
  value: unknown,
  seen: WeakMap<object, unknown>,
  budget: { nodes: number },
  depth: number,
): unknown {
  if (value instanceof Date) {
    budget.nodes += 1;
    return budget.nodes > MAX_NODES ? TRUNCATED : new Date(value.getTime());
  }
  if (value !== null && typeof value === "object") {
    const known = seen.get(value);
    if (known !== undefined) return TRUNCATED;
  }
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) return TRUNCATED;
  if (typeof value === "string") return sanitizeAnalyticsUrl(value);
  if (value === null || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) return value;
  if (depth >= MAX_DEPTH) return TRUNCATED;
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) {
      if (budget.nodes >= MAX_NODES) { output.push(TRUNCATED); break; }
      budget.nodes += 1;
      output.push(sanitizeValue(item, seen, budget, depth + 1));
    }
    return output;
  }
  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) {
    if (budget.nodes >= MAX_NODES) { output.$privacy_scan_truncated = TRUNCATED; break; }
    budget.nodes += 1;
    if (isSensitivePaymentKey(key)) continue;
    output[key] = sanitizeValue(item, seen, budget, depth + 1);
  }
  return output;
}

export function sanitizePostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  return sanitizeValue(event, new WeakMap(), { nodes: 0 }, 0) as CaptureResult;
}
