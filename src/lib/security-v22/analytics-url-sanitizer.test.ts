import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsUrl, sanitizePostHogEvent } from "./analytics-url-sanitizer";

describe("PostHog URL privacy sanitizer", () => {
  it("removes payment return identifiers from real pageview and pageleave event shapes", () => {
    for (const eventName of ["$pageview", "$pageleave"] as const) {
      const event: CaptureResult = {
        uuid: "event-1",
        event: eventName,
        properties: {
          $current_url: "https://searchtrust.example/cases/case-1/connections?payment=return&payment_id=pay_secret&order_id=order_secret&utm_source=email",
          $referrer: "https://searchtrust.example/connections?checkout_session_id=cks_secret&safe=1",
          current_url: "/connections?paymentId=pay_camel&tab=source",
          unrelated: "payment_id=must-not-be-treated-as-a-url",
        },
        $set: { initial_referrer: "https://searchtrust.example/connections?payment_id=pay_set" },
        $set_once: { $initial_current_url: "https://searchtrust.example/connections?orderId=order_once" },
      };
      const sanitized = sanitizePostHogEvent(event)!;
      expect(JSON.stringify(sanitized)).not.toContain("pay_secret");
      expect(JSON.stringify(sanitized)).not.toContain("order_secret");
      expect(JSON.stringify(sanitized)).not.toContain("cks_secret");
      expect(sanitized.properties.$current_url).toBe("https://searchtrust.example/cases/case-1/connections?utm_source=email");
      expect(sanitized.properties.$referrer).toBe("https://searchtrust.example/connections?safe=1");
      expect(sanitized.properties.current_url).toBe("/connections?tab=source");
      expect(sanitized.properties.unrelated).toBe("payment_id=must-not-be-treated-as-a-url");
    }
  });

  it("leaves safe and non-URL values unchanged", () => {
    expect(sanitizeAnalyticsUrl("https://searchtrust.example/connections?tab=ga4")).toBe("https://searchtrust.example/connections?tab=ga4");
    expect(sanitizeAnalyticsUrl("ordinary text")).toBe("ordinary text");
    expect(sanitizePostHogEvent(null)).toBeNull();
  });
});
