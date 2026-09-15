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

export function sanitizeAnalyticsUrl(value: string): string {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//iu.test(value);
  const relative = value.startsWith("/");
  if (!absolute && !relative) return value;
  try {
    const parsed = new URL(value, "https://analytics.invalid");
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitivePaymentKey(key)) parsed.searchParams.delete(key);
    }
    return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function sanitizeValue(
  value: unknown,
  seen: WeakMap<object, unknown>,
  budget: { nodes: number },
  depth: number,
): unknown {
  if (value !== null && typeof value === "object") {
    const known = seen.get(value);
    if (known !== undefined) return TRUNCATED;
  }
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) return TRUNCATED;
  if (typeof value === "string") return sanitizeAnalyticsUrl(value);
  if (value === null || typeof value !== "object") return value;
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
