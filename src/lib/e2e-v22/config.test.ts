import { describe, expect, it } from "vitest";

import { E2E_IDENTITY, resolveLocalE2ETestMode } from "./config";

describe("local E2E test mode", () => {
  it("stays disabled by default", () => {
    expect(resolveLocalE2ETestMode({})).toBe(false);
  });

  it.each(["http://127.0.0.1:3100", "http://localhost:3100"])(
    "accepts the explicit loopback origin %s",
    (baseURL) => {
      expect(
        resolveLocalE2ETestMode({
          NEXT_PUBLIC_E2E_TEST_MODE: "true",
          NEXT_PUBLIC_E2E_BASE_URL: baseURL,
        }),
      ).toBe(true);
    },
  );

  it("fails closed for Vercel and non-loopback origins", () => {
    expect(() =>
      resolveLocalE2ETestMode({
        NEXT_PUBLIC_E2E_TEST_MODE: "true",
        NEXT_PUBLIC_E2E_BASE_URL: "http://127.0.0.1:3100",
        VERCEL_ENV: "production",
      }),
    ).toThrow("forbidden");
    expect(() =>
      resolveLocalE2ETestMode({
        NEXT_PUBLIC_E2E_TEST_MODE: "true",
        NEXT_PUBLIC_E2E_BASE_URL: "https://trysearchtrust.com",
      }),
    ).toThrow("loopback");
  });

  it("uses only visibly synthetic local identity values", () => {
    expect(E2E_IDENTITY.internalUserId).toMatch(/^e2000000-/);
    expect(E2E_IDENTITY.emailAddress.endsWith(".invalid")).toBe(true);
    expect(E2E_IDENTITY.bearerToken).toContain("e2e-local");
  });
});
