import type { CaptureResult, Properties } from "posthog-js";

const SENSITIVE_PAYMENT_PARAMS = new Set([
  "payment",
  "payment_id",
  "paymentid",
  "order_id",
  "orderid",
  "checkout_session_id",
  "checkoutsessionid",
]);

function isUrlProperty(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("url") || normalized.includes("referrer");
}

export function sanitizeAnalyticsUrl(value: string): string {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//iu.test(value);
  const relative = value.startsWith("/");
  if (!absolute && !relative) return value;
  try {
    const parsed = new URL(value, "https://analytics.invalid");
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_PAYMENT_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function sanitizeProperties(properties: Properties | undefined): Properties | undefined {
  if (!properties) return properties;
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [
    key,
    typeof value === "string" && isUrlProperty(key) ? sanitizeAnalyticsUrl(value) : value,
  ])) as Properties;
}

export function sanitizePostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  return {
    ...event,
    properties: sanitizeProperties(event.properties) ?? {},
    $set: sanitizeProperties(event.$set),
    $set_once: sanitizeProperties(event.$set_once),
  };
}
