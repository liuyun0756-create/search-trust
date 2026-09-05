import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GoogleConnectionError } from "./errors";
import {
  GOOGLE_OAUTH_COOKIE_NAME,
  createGoogleConnectionCollectionHandlers,
  createGoogleConnectionItemHandlers,
  createGoogleOAuthCallbackHandler,
} from "./handlers";
import type { GoogleConnectionService } from "./service";

const userId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";
const summary = {
  id: connectionId,
  account_email: "owner@example.com",
  account_display_name: "Owner",
  granted_scopes: ["openid", "email", "profile"],
  covered_sources: [],
  status: "active" as const,
  last_error_code: null,
  connected_at: "2026-09-05T12:00:00.000Z",
  updated_at: "2026-09-05T12:00:00.000Z",
};

function service(overrides: Partial<GoogleConnectionService> = {}): GoogleConnectionService {
  return {
    startAuthorization: vi.fn(async () => ({
      authorizationUrl: "https://accounts.google.test/oauth?state=opaque",
      cookieBinding: `${connectionId}.signed-binding`,
      expiresAt: "2026-09-05T12:10:00.000Z",
    })),
    completeAuthorization: vi.fn(async () => ({ connection: summary, returnPath: "/cases/example" })),
    listConnections: vi.fn(async () => [summary]),
    disconnect: vi.fn(async () => ({ ...summary, status: "revoked" as const })),
    getAccessToken: vi.fn(async () => ({ accessToken: "secret", expiresAt: summary.updated_at, grantedScopes: [] })),
    ...overrides,
  } as GoogleConnectionService;
}

function dependencies(currentService = service(), signedIn = true) {
  return {
    getCurrentUser: vi.fn(async () => signedIn ? { userId } : null),
    createService: vi.fn(() => currentService),
    getBaseUrl: () => "https://trysearchtrust.com",
    createRequestId: () => "request-id-1",
  };
}

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Google connection HTTP handlers", () => {
  it("requires authentication before creating a service", async () => {
    const deps = dependencies(service(), false);
    const response = await createGoogleConnectionCollectionHandlers(deps).GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "GOOGLE_CONNECTION_FORBIDDEN" } });
    expect(deps.createService).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a stable disabled error without exposing configuration", async () => {
    const deps = dependencies();
    deps.createService.mockImplementation(() => {
      throw new GoogleConnectionError("GOOGLE_CONNECTIONS_DISABLED", { status: 503 });
    });
    const response = await createGoogleConnectionCollectionHandlers(deps).GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("GOOGLE_OAUTH_CLIENT_SECRET");
  });

  it("starts authorization with a secure server-only cookie", async () => {
    const currentService = service();
    const handlers = createGoogleConnectionCollectionHandlers(dependencies(currentService));
    const response = await handlers.POST(jsonRequest(
      "https://trysearchtrust.com/api/v2/google/connections/authorize",
      { sources: ["ga4"], case_id: null, return_path: "/cases/example" },
    ));
    const payload = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      authorization_url: "https://accounts.google.test/oauth?state=opaque",
      expires_at: "2026-09-05T12:10:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("signed-binding");
    expect(cookie).toContain(`${GOOGLE_OAUTH_COOKIE_NAME}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/api/v2/google");
    expect(currentService.startAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      sources: ["ga4"],
      requestId: "request-id-1",
    }));
  });

  it("validates JSON and does not call the service for malformed input", async () => {
    const currentService = service();
    const request = new NextRequest("https://trysearchtrust.com/api/v2/google/connections/authorize", {
      method: "POST",
      body: "not-json",
    });
    const response = await createGoogleConnectionCollectionHandlers(dependencies(currentService)).POST(request);
    expect(response.status).toBe(400);
    expect(currentService.startAuthorization).not.toHaveBeenCalled();
  });

  it("owner-scopes incremental authorization and disconnect item routes", async () => {
    const currentService = service();
    const handlers = createGoogleConnectionItemHandlers(dependencies(currentService));
    const context = { params: Promise.resolve({ id: connectionId }) };
    const authorize = await handlers.POST(jsonRequest(
      `https://trysearchtrust.com/api/v2/google/connections/${connectionId}/authorize`,
      { sources: ["gsc"], return_path: "/settings/connections" },
    ), context);
    expect(authorize.status).toBe(201);
    expect(currentService.startAuthorization).toHaveBeenCalledWith(expect.objectContaining({ connectionId }));

    const disconnected = await handlers.DELETE(new NextRequest(
      `https://trysearchtrust.com/api/v2/google/connections/${connectionId}`,
      { method: "DELETE" },
    ), context);
    expect(disconnected.status).toBe(200);
    expect(currentService.disconnect).toHaveBeenCalledWith(userId, connectionId, "request-id-1");
  });

  it("lists only the service's safe connection summaries", async () => {
    const handlers = createGoogleConnectionCollectionHandlers(dependencies());
    const response = await handlers.GET();
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain(connectionId);
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("refresh_token");
  });

  it("completes callbacks with a same-origin safe redirect and clears the cookie", async () => {
    const currentService = service();
    const handler = createGoogleOAuthCallbackHandler(dependencies(currentService));
    const response = await handler(new NextRequest(
      "https://trysearchtrust.com/api/v2/google/oauth/callback?state=opaque&code=fake-code",
      { headers: { cookie: `${GOOGLE_OAUTH_COOKIE_NAME}=signed-binding` } },
    ));
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(location.origin).toBe("https://trysearchtrust.com");
    expect(location.pathname).toBe("/cases/example");
    expect(location.searchParams.get("google_connection")).toBe("success");
    expect(location.searchParams.get("connection_id")).toBe(connectionId);
    expect(location.toString()).not.toContain("fake-code");
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(currentService.completeAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      state: "opaque",
      code: "fake-code",
      cookieBinding: "signed-binding",
    }));
  });

  it("redirects callback failures with only a stable safe code", async () => {
    const currentService = service({
      completeAuthorization: vi.fn(async () => {
        throw new GoogleConnectionError("GOOGLE_OAUTH_ACCESS_DENIED", { status: 400 });
      }),
    });
    const response = await createGoogleOAuthCallbackHandler(dependencies(currentService))(new NextRequest(
      "https://trysearchtrust.com/api/v2/google/oauth/callback?state=secret-state&error=access_denied&error_description=private",
      { headers: { cookie: `${GOOGLE_OAUTH_COOKIE_NAME}=signed-binding` } },
    ));
    const location = response.headers.get("location")!;
    expect(location).toContain("code=GOOGLE_OAUTH_ACCESS_DENIED");
    expect(location).not.toContain("secret-state");
    expect(location).not.toContain("private");
  });
});
