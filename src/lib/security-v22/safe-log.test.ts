import { describe, expect, it } from "vitest";

import { REDACTED, safeLogError, safeLogValue } from "./safe-log";

describe("shared V2.2 safe logging", () => {
  it("redacts credentials and representative PII in nested values", () => {
    const value = safeLogValue({
      request_id: "req-safe",
      authorization: "Bearer secret-token",
      email: "private@example.com",
      siteUrl: "https://customer.example/private?code=secret",
      response: { apiKey: "provider-secret", phone: "+1 555 0100" },
    });
    expect(value).toEqual({
      request_id: "req-safe",
      authorization: REDACTED,
      email: REDACTED,
      siteUrl: REDACTED,
      response: { apiKey: REDACTED, phone: REDACTED },
    });
  });

  it("sanitizes token-shaped exception strings and bounds their length", () => {
    const safe = safeLogError(new Error(
      `Bearer top-secret access_token=ya29.private owner@example.com https://private.example/path ${"x".repeat(3_000)}`,
    ));
    expect(JSON.stringify(safe)).not.toContain("top-secret");
    expect(JSON.stringify(safe)).not.toContain("ya29.private");
    expect(JSON.stringify(safe)).not.toContain("owner@example.com");
    expect(JSON.stringify(safe)).not.toContain("private.example");
    expect(safe.message.length).toBeLessThanOrEqual(2_050);
  });
});
