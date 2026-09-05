import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { GoogleConnectionError } from "./errors";
import type { GoogleConnectionService } from "./service";

export const GOOGLE_OAUTH_COOKIE_NAME = "st_google_oauth";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16 * 1024;

type CurrentUser = { userId: string } | null;

export interface GoogleConnectionHandlerDependencies {
  getCurrentUser(): Promise<CurrentUser>;
  createService(): GoogleConnectionService;
  getBaseUrl(): string;
  createRequestId?: () => string;
}

function noStoreHeaders(requestId: string) {
  return { "cache-control": "no-store", "x-request-id": requestId };
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  const safe = error instanceof GoogleConnectionError
    ? error
    : new GoogleConnectionError("GOOGLE_PERSISTENCE_FAILED", { status: 500, retryable: true });
  if (safe.status >= 500) {
    console.error("Google connection request failed", {
      request_id: requestId,
      code: safe.code,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return NextResponse.json({
    error: { code: safe.code, message: safe.message, retryable: safe.retryable },
  }, { status: safe.status, headers: noStoreHeaders(requestId) });
}

async function userId(dependencies: GoogleConnectionHandlerDependencies): Promise<string> {
  const user = await dependencies.getCurrentUser();
  if (!user) throw new GoogleConnectionError("GOOGLE_CONNECTION_FORBIDDEN", {
    status: 401,
    message: "Sign in to manage Google connections.",
  });
  return user.userId;
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error();
    const parsed: unknown = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseConnectionId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  }
  return value;
}

function withOAuthCookie(response: NextResponse, value: string, maxAge: number) {
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/v2/google",
    maxAge,
  });
  return response;
}

function safeBaseUrl(dependencies: GoogleConnectionHandlerDependencies): URL {
  try {
    const url = new URL(dependencies.getBaseUrl());
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      throw new Error();
    }
    return url;
  } catch {
    throw new GoogleConnectionError("GOOGLE_OAUTH_NOT_CONFIGURED", { status: 503 });
  }
}

function redirectResult(base: URL, returnPath: string, result: "success" | "error", code: string, id?: string) {
  const url = new URL(returnPath, base);
  if (url.origin !== base.origin) throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  url.searchParams.set("google_connection", result);
  url.searchParams.set("code", code);
  if (id) url.searchParams.set("connection_id", id);
  return url;
}

export function createGoogleConnectionCollectionHandlers(dependencies: GoogleConnectionHandlerDependencies) {
  const requestId = () => dependencies.createRequestId?.() ?? randomUUID();
  return {
    async GET() {
      const id = requestId();
      try {
        const currentUserId = await userId(dependencies);
        const connections = await dependencies.createService().listConnections(currentUserId);
        return NextResponse.json({ connections }, { headers: noStoreHeaders(id) });
      } catch (error) {
        return errorResponse(error, id);
      }
    },

    async POST(request: NextRequest) {
      const id = requestId();
      try {
        const currentUserId = await userId(dependencies);
        const input = await body(request);
        const result = await dependencies.createService().startAuthorization({
          userId: currentUserId,
          caseId: textOrNull(input.case_id),
          sources: input.sources,
          returnPath: textOrNull(input.return_path),
          requestId: id,
        });
        return withOAuthCookie(NextResponse.json({
          authorization_url: result.authorizationUrl,
          expires_at: result.expiresAt,
        }, { status: 201, headers: noStoreHeaders(id) }), result.cookieBinding, 600);
      } catch (error) {
        return errorResponse(error, id);
      }
    },
  };
}

export function createGoogleConnectionItemHandlers(dependencies: GoogleConnectionHandlerDependencies) {
  type Context = { params: Promise<{ id: string }> };
  const requestId = () => dependencies.createRequestId?.() ?? randomUUID();
  return {
    async POST(request: NextRequest, context: Context) {
      const id = requestId();
      try {
        const currentUserId = await userId(dependencies);
        const connectionId = parseConnectionId((await context.params).id);
        const input = await body(request);
        const result = await dependencies.createService().startAuthorization({
          userId: currentUserId,
          connectionId,
          caseId: textOrNull(input.case_id),
          sources: input.sources,
          returnPath: textOrNull(input.return_path),
          requestId: id,
        });
        return withOAuthCookie(NextResponse.json({
          authorization_url: result.authorizationUrl,
          expires_at: result.expiresAt,
        }, { status: 201, headers: noStoreHeaders(id) }), result.cookieBinding, 600);
      } catch (error) {
        return errorResponse(error, id);
      }
    },

    async DELETE(_request: NextRequest, context: Context) {
      const id = requestId();
      try {
        const currentUserId = await userId(dependencies);
        const connectionId = parseConnectionId((await context.params).id);
        const connection = await dependencies.createService().disconnect(currentUserId, connectionId, id);
        return NextResponse.json({ connection }, { headers: noStoreHeaders(id) });
      } catch (error) {
        return errorResponse(error, id);
      }
    },
  };
}

export function createGoogleOAuthCallbackHandler(dependencies: GoogleConnectionHandlerDependencies) {
  return async function GET(request: NextRequest) {
    const requestId = dependencies.createRequestId?.() ?? randomUUID();
    try {
      const currentUserId = await userId(dependencies);
      const result = await dependencies.createService().completeAuthorization({
        userId: currentUserId,
        state: request.nextUrl.searchParams.get("state") ?? "",
        cookieBinding: request.cookies.get(GOOGLE_OAUTH_COOKIE_NAME)?.value ?? "",
        code: request.nextUrl.searchParams.get("code"),
        providerError: request.nextUrl.searchParams.get("error"),
        requestId,
      });
      const response = NextResponse.redirect(redirectResult(
        safeBaseUrl(dependencies),
        result.returnPath,
        "success",
        "AUTHORIZED",
        result.connection.id,
      ), { headers: noStoreHeaders(requestId) });
      return withOAuthCookie(response, "", 0);
    } catch (error) {
      const safe = error instanceof GoogleConnectionError
        ? error
        : new GoogleConnectionError("GOOGLE_PERSISTENCE_FAILED", { status: 500, retryable: true });
      let response: NextResponse;
      try {
        response = NextResponse.redirect(redirectResult(
          safeBaseUrl(dependencies),
          "/cases",
          "error",
          safe.code,
        ), { headers: noStoreHeaders(requestId) });
      } catch {
        response = errorResponse(safe, requestId);
      }
      return withOAuthCookie(response, "", 0);
    }
  };
}
