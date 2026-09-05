import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { signGoogleBrokerBody } from "./broker-signature";
import { createGoogleTokenBrokerHandler } from "./broker";
import type { GoogleConnectionService } from "./service";

const secret = "broker-secret".repeat(4);
const timestamp = 1_788_611_200;
const connectionId = "22222222-2222-4222-8222-222222222222";
const requestId = "request-11111111-1111-4111-8111-111111111111";
const nonce = "0123456789abcdef0123456789abcdef";
const body = JSON.stringify({ connection_id: connectionId, source: "ga4", purpose: "source_sync" });

function signedRequest(overrides: { body?: string; signature?: string; requestId?: string } = {}) {
  const requestBody = overrides.body ?? body;
  const id = overrides.requestId ?? requestId;
  const signature = overrides.signature ?? signGoogleBrokerBody(secret, {
    timestamp,
    requestId: id,
    nonce,
    body: requestBody,
  });
  return new NextRequest(
    `https://trysearchtrust.com/api/internal/v2/google/connections/${connectionId}/access-token`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-searchtrust-signature-version": "v1",
        "x-searchtrust-timestamp": String(timestamp),
        "x-searchtrust-request-id": id,
        "x-searchtrust-nonce": nonce,
        "x-searchtrust-signature": signature,
      },
      body: requestBody,
    },
  );
}

function harness(options: { configured?: boolean; claimed?: boolean } = {}) {
  const claimBrokerRequest = vi.fn(async () => options.claimed ?? true);
  const getAccessToken = vi.fn(async () => ({
    accessToken: "short-lived-access",
    expiresAt: "2026-09-05T13:00:00.000Z",
    grantedScopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/analytics.readonly"],
  }));
  const dependencies = {
    getSecret: () => options.configured === false ? "" : secret,
    nowSeconds: () => timestamp,
    createRepository: () => ({ claimBrokerRequest }),
    createService: () => ({ getAccessToken } as unknown as GoogleConnectionService),
  };
  return { handler: createGoogleTokenBrokerHandler(dependencies), claimBrokerRequest, getAccessToken };
}

describe("Google token broker handler", () => {
  it("fails closed when server configuration is disabled", async () => {
    const h = harness({ configured: false });
    const response = await h.handler(signedRequest(), { params: Promise.resolve({ id: connectionId }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "GOOGLE_OAUTH_NOT_CONFIGURED" } });
    expect(h.claimBrokerRequest).not.toHaveBeenCalled();
  });

  it("authenticates the raw body before parsing or touching persistence", async () => {
    const h = harness();
    const response = await h.handler(signedRequest({ signature: `sha256=${"0".repeat(64)}` }), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "GOOGLE_BROKER_AUTH_FAILED" } });
    expect(h.claimBrokerRequest).not.toHaveBeenCalled();
    expect(h.getAccessToken).not.toHaveBeenCalled();

    const missingId = signedRequest();
    missingId.headers.delete("x-searchtrust-request-id");
    const missingIdResponse = await h.handler(missingId, { params: Promise.resolve({ id: connectionId }) });
    expect(missingIdResponse.status).toBe(401);
  });

  it("rejects path/body mismatch and unknown payload fields", async () => {
    for (const invalidBody of [
      JSON.stringify({ connection_id: "33333333-3333-4333-8333-333333333333", source: "ga4", purpose: "source_sync" }),
      JSON.stringify({ connection_id: connectionId, source: "ga4", purpose: "source_sync", token: "not-allowed" }),
    ]) {
      const h = harness();
      const response = await h.handler(signedRequest({ body: invalidBody }), {
        params: Promise.resolve({ id: connectionId }),
      });
      expect(response.status).toBe(400);
      expect(h.claimBrokerRequest).not.toHaveBeenCalled();
    }
  });

  it("claims request and nonce before returning a no-store short-lived token", async () => {
    const h = harness();
    const response = await h.handler(signedRequest(), { params: Promise.resolve({ id: connectionId }) });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({
      access_token: "short-lived-access",
      expires_at: "2026-09-05T13:00:00.000Z",
      granted_scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/analytics.readonly"],
      token_type: "Bearer",
    });
    expect(h.claimBrokerRequest).toHaveBeenCalledWith(expect.objectContaining({
      requestId,
      connectionId,
      source: "ga4",
    }));
    expect(JSON.stringify(h.claimBrokerRequest.mock.calls)).not.toContain(nonce);
    expect(h.getAccessToken).toHaveBeenCalledWith(connectionId, "ga4", requestId);
  });

  it("rejects replayed request IDs or nonces before decrypting tokens", async () => {
    const h = harness({ claimed: false });
    const response = await h.handler(signedRequest(), { params: Promise.resolve({ id: connectionId }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "GOOGLE_BROKER_REPLAYED" } });
    expect(h.getAccessToken).not.toHaveBeenCalled();
  });
});
