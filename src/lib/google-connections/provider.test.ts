import { describe, expect, it, vi } from "vitest";

import { GoogleConnectionError } from "./errors";
import { GoogleOAuthHttpProvider, GoogleProviderFailure } from "./provider";

const config = {
  clientId: "client.apps.googleusercontent.com",
  clientSecret: "client-secret",
  redirectUri: "https://trysearchtrust.com/api/v2/google/oauth/callback",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Google OAuth HTTP provider", () => {
  it("builds an offline incremental authorization URL with PKCE", () => {
    const provider = new GoogleOAuthHttpProvider(config);
    const url = new URL(provider.buildAuthorizationUrl({
      scopes: ["openid", "email", "scope:b", "scope:a"],
      state: "opaque-state",
      codeChallenge: "pkce-challenge",
      loginHint: "owner@example.com",
    }));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("email openid scope:a scope:b");
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.searchParams.get("code_verifier")).toBeNull();
  });

  it("exchanges a code and normalizes only the provider's actual scopes", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("code")).toBe("fake-code");
      expect(body.get("code_verifier")).toBe("fake-verifier");
      return jsonResponse({
        access_token: "fake-access",
        refresh_token: "fake-refresh",
        expires_in: 3600,
        scope: "scope:b scope:a scope:a",
        token_type: "Bearer",
      });
    });
    const provider = new GoogleOAuthHttpProvider(config, fetcher);
    const result = await provider.exchangeCode("fake-code", "fake-verifier");

    expect(result).toEqual({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
      expiresInSeconds: 3600,
      grantedScopes: ["scope:a", "scope:b"],
      tokenType: "Bearer",
    });
  });

  it("loads a verified Google identity without exposing the bearer value in errors", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fake-access");
      return jsonResponse({ sub: "google-subject", email: "owner@example.com", name: "Owner" });
    });
    const provider = new GoogleOAuthHttpProvider(config, fetcher);
    await expect(provider.getIdentity("fake-access")).resolves.toEqual({
      subject: "google-subject",
      email: "owner@example.com",
      displayName: "Owner",
    });
  });

  it("refreshes tokens and permits Google to omit a rotated refresh token", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      access_token: "new-access",
      expires_in: 1800,
      scope: "openid email profile scope:a",
      token_type: "Bearer",
    }));
    const provider = new GoogleOAuthHttpProvider(config, fetcher);
    await expect(provider.refresh("fake-refresh")).resolves.toEqual({
      accessToken: "new-access",
      refreshToken: null,
      expiresInSeconds: 1800,
      grantedScopes: ["email", "openid", "profile", "scope:a"],
      tokenType: "Bearer",
    });
  });

  it("maps invalid_grant separately and never includes raw provider content", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      error: "invalid_grant",
      error_description: "authorization code fake-code access_token=secret",
    }, 400));
    const provider = new GoogleOAuthHttpProvider(config, fetcher);

    await expect(provider.exchangeCode("fake-code", "fake-verifier"))
      .rejects.toMatchObject({ reason: "invalid_grant", code: "GOOGLE_REAUTH_REQUIRED" });
    try { await provider.exchangeCode("fake-code", "fake-verifier"); } catch (error) {
      expect(error).toBeInstanceOf(GoogleProviderFailure);
      expect((error as Error).message).not.toContain("fake-code");
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it("uses a stable safe error for malformed success responses and network failures", async () => {
    for (const fetcher of [
      vi.fn(async () => jsonResponse({ access_token: "fake" })),
      vi.fn(async () => { throw new Error("Bearer leaked-secret"); }),
    ]) {
      const provider = new GoogleOAuthHttpProvider(config, fetcher);
      await expect(provider.exchangeCode("fake-code", "fake-verifier"))
        .rejects.toBeInstanceOf(GoogleConnectionError);
      try { await provider.exchangeCode("fake-code", "fake-verifier"); } catch (error) {
        expect((error as GoogleConnectionError).code).toBe("GOOGLE_PROVIDER_UNAVAILABLE");
        expect((error as Error).message).not.toContain("leaked-secret");
      }
    }
  });

  it("treats an already-invalid token as an idempotent revoke", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: "invalid_token" }, 400));
    const provider = new GoogleOAuthHttpProvider(config, fetcher);
    await expect(provider.revoke("fake-token")).resolves.toBeUndefined();
  });
});
