import { describe, expect, it } from "vitest";

import { REDACTED, safeLogError, safeLogValue } from "./safe-log";

describe("Google connection safe logging", () => {
  it("redacts nested credential fields while retaining approved identifiers", () => {
    const value = safeLogValue({
      request_id: "req-1",
      connection_id: "connection-1",
      error_code: "GOOGLE_PROVIDER_UNAVAILABLE",
      authorization: "Bearer secret-access",
      headers: {
        cookie: "oauth_state=secret-state",
        "content-type": "application/json",
      },
      response: {
        access_token: "ya29.secret",
        refreshToken: "1//secret-refresh",
        code_verifier: "secret-verifier",
      },
    });

    expect(value).toEqual({
      request_id: "req-1",
      connection_id: "connection-1",
      error_code: "GOOGLE_PROVIDER_UNAVAILABLE",
      authorization: REDACTED,
      headers: { cookie: REDACTED, "content-type": "application/json" },
      response: {
        access_token: REDACTED,
        refreshToken: REDACTED,
        code_verifier: REDACTED,
      },
    });
  });

  it("redacts bearer tokens, JWTs, Google token shapes, and OAuth query values in strings", () => {
    const value = safeLogValue(
      "Bearer top-secret eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature " +
      "ya29.access 1//refresh https://example.test/callback?code=secret-code&state=secret-state&safe=yes",
    );
    expect(value).not.toContain("top-secret");
    expect(value).not.toContain("eyJhbGci");
    expect(value).not.toContain("ya29.access");
    expect(value).not.toContain("1//refresh");
    expect(value).not.toContain("secret-code");
    expect(value).not.toContain("secret-state");
    expect(value).toContain("safe=yes");
  });

  it("turns exceptions into bounded safe objects", () => {
    const error = new Error("exchange failed: access_token=ya29.secret");
    error.name = "ProviderError";
    expect(safeLogError(error)).toEqual({
      name: "ProviderError",
      message: "exchange failed: access_token=[REDACTED]",
    });
  });

  it("handles circular input without throwing", () => {
    const value: Record<string, unknown> = { request_id: "req-1" };
    value.self = value;
    expect(safeLogValue(value)).toEqual({ request_id: "req-1", self: "[CIRCULAR]" });
  });
});
