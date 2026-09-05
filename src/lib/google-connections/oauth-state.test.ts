import { describe, expect, it } from "vitest";

import {
  createOAuthCookieBinding,
  createOAuthState,
  createPkce,
  digestOAuthState,
  verifyOAuthCookieBinding,
} from "./oauth-state";

describe("Google OAuth state and PKCE", () => {
  it("creates high-entropy URL-safe state and stable digests", () => {
    const state = createOAuthState(() => Buffer.alloc(32, 7));
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digestOAuthState(state)).toEqual(digestOAuthState(state));
    expect(digestOAuthState(state)).toHaveLength(32);
  });

  it("creates an S256 PKCE verifier and challenge", () => {
    const pkce = createPkce(() => Buffer.alloc(32, 8));
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });

  it("binds the OAuth session and state digest with a constant-format HMAC cookie", () => {
    const secret = "s".repeat(32);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const digest = digestOAuthState("opaque-state");
    const cookie = createOAuthCookieBinding(secret, sessionId, digest);

    expect(cookie).toMatch(new RegExp(`^${sessionId}\\.[A-Za-z0-9_-]{43}$`));
    expect(verifyOAuthCookieBinding(secret, cookie, sessionId, digest)).toBe(true);
    expect(verifyOAuthCookieBinding(secret, cookie, sessionId, digestOAuthState("other"))).toBe(false);
    expect(verifyOAuthCookieBinding("x".repeat(32), cookie, sessionId, digest)).toBe(false);
    expect(verifyOAuthCookieBinding(secret, `${sessionId}.bad`, sessionId, digest)).toBe(false);
  });
});
