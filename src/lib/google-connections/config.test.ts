import { describe, expect, it } from "vitest";

import { loadGoogleConnectionConfig } from "./config";
import { GoogleConnectionError } from "./errors";

const validEnv = {
  GOOGLE_CONNECTIONS_ENABLED: "true",
  NEXT_PUBLIC_BASE_URL: "https://trysearchtrust.com",
  GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_OAUTH_REDIRECT_URI: "https://trysearchtrust.com/api/v2/google/oauth/callback",
  GOOGLE_TOKEN_ENCRYPTION_ACTIVE_VERSION: "v1",
  GOOGLE_TOKEN_ENCRYPTION_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 4).toString("base64") }),
  GOOGLE_OAUTH_COOKIE_SECRET: "c".repeat(32),
  GOOGLE_TOKEN_BROKER_SECRET: "b".repeat(32),
};

describe("Google connection configuration", () => {
  it("stays disabled without requiring secrets", () => {
    expect(loadGoogleConnectionConfig({})).toEqual({ enabled: false });
    expect(loadGoogleConnectionConfig({ GOOGLE_CONNECTIONS_ENABLED: "false" })).toEqual({ enabled: false });
  });

  it("loads a complete enabled server-only configuration", () => {
    const config = loadGoogleConnectionConfig(validEnv);
    expect(config.enabled).toBe(true);
    if (!config.enabled) throw new Error("expected enabled config");
    expect(config.redirectUri).toBe(validEnv.GOOGLE_OAUTH_REDIRECT_URI);
    expect(config.tokenKeys.v1).toBe(validEnv.GOOGLE_TOKEN_ENCRYPTION_KEYS
      ? JSON.parse(validEnv.GOOGLE_TOKEN_ENCRYPTION_KEYS).v1
      : "");
  });

  it("returns one safe configuration error for missing or malformed secrets", () => {
    const invalid = [
      { ...validEnv, GOOGLE_OAUTH_CLIENT_SECRET: "" },
      { ...validEnv, GOOGLE_OAUTH_REDIRECT_URI: "https://attacker.example/callback" },
      { ...validEnv, GOOGLE_TOKEN_ENCRYPTION_KEYS: "not-json" },
      { ...validEnv, GOOGLE_TOKEN_ENCRYPTION_KEYS: JSON.stringify({ v1: "short" }) },
      { ...validEnv, GOOGLE_TOKEN_ENCRYPTION_ACTIVE_VERSION: "v2" },
      { ...validEnv, GOOGLE_OAUTH_COOKIE_SECRET: "short" },
    ];
    for (const env of invalid) {
      expect(() => loadGoogleConnectionConfig(env)).toThrowError(GoogleConnectionError);
      try { loadGoogleConnectionConfig(env); } catch (error) {
        expect((error as GoogleConnectionError).code).toBe("GOOGLE_OAUTH_NOT_CONFIGURED");
        expect((error as Error).message).not.toContain("client-secret");
      }
    }
  });
});
