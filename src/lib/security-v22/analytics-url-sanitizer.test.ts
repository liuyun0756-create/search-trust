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

  it("recursively sanitizes nested arrays, sets and direct sensitive keys without mutating the event", () => {
    const nested = {
      safe: "kept",
      payment_id: "pay_direct",
      items: [{ target: "https://searchtrust.example/return?payment_id=pay_nested&tab=ga4" }],
    };
    const event = {
      uuid: "event-nested",
      event: "$pageview",
      properties: { nested },
      $set: { profile: { referrer_url: "/return?order_id=order_nested&safe=1" } },
    } as unknown as CaptureResult;

    const sanitized = sanitizePostHogEvent(event)! as unknown as {
      properties: { nested: { safe: string; payment_id?: string; items: Array<{ target: string }> } };
      $set: { profile: { referrer_url: string } };
    };
    expect(sanitized.properties.nested.payment_id).toBeUndefined();
    expect(sanitized.properties.nested.items[0].target).toBe("https://searchtrust.example/return?tab=ga4");
    expect(sanitized.$set.profile.referrer_url).toBe("/return?safe=1");
    expect(nested.payment_id).toBe("pay_direct");
    expect(nested.items[0].target).toContain("pay_nested");
  });

  it("handles circular and excessively deep values within a bounded privacy scan", () => {
    const circular: Record<string, unknown> = { current_url: "/return?payment_id=pay_cycle" };
    circular.self = circular;
    let deep: Record<string, unknown> = { payment_id: "pay_too_deep" };
    for (let index = 0; index < 80; index += 1) deep = { child: deep };
    const event = { uuid: "event-bounded", event: "$pageview", properties: { circular, deep, count: 3, enabled: true } } as unknown as CaptureResult;

    const sanitized = sanitizePostHogEvent(event)! as unknown as { properties: { circular: Record<string, unknown>; deep: unknown; count: number; enabled: boolean } };
    expect(sanitized.properties.circular.current_url).toBe("/return");
    expect(sanitized.properties.circular.self).toMatch(/Redacted/);
    expect(() => JSON.stringify(sanitized)).not.toThrow();
    expect(JSON.stringify(sanitized.properties.deep)).not.toContain("pay_too_deep");
    expect(sanitized.properties.count).toBe(3);
    expect(sanitized.properties.enabled).toBe(true);
  });
});
