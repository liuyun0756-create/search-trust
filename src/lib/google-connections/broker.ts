import { NextRequest, NextResponse } from "next/server";

import {
  digestGoogleBrokerNonce,
  verifyGoogleBrokerSignature,
} from "./broker-signature";
import { GoogleConnectionError } from "./errors";
import type { GoogleConnectionRepository } from "./repository";
import { GOOGLE_SOURCES, type GoogleSource } from "./scopes";
import type { GoogleConnectionService } from "./service";

const MAX_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSES = ["source_sync", "resource_discovery"] as const;

interface GoogleBrokerDependencies {
  getSecret(): string;
  nowSeconds(): number;
  createRepository(): Pick<GoogleConnectionRepository, "claimBrokerRequest">;
  createService(): GoogleConnectionService;
}

function headers(requestId: string) {
  return { "cache-control": "no-store", "x-request-id": requestId };
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  const safe = error instanceof GoogleConnectionError
    ? error
    : new GoogleConnectionError("GOOGLE_PERSISTENCE_FAILED", { status: 500, retryable: true });
  if (safe.status >= 500) {
    console.error("Google token broker request failed", {
      request_id: requestId,
      code: safe.code,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return NextResponse.json({
    error: { code: safe.code, message: safe.message, retryable: safe.retryable },
  }, { status: safe.status, headers: headers(requestId) });
}

function parseBody(body: string, pathConnectionId: string): {
  connectionId: string;
  source: GoogleSource;
  purpose: (typeof PURPOSES)[number];
} {
  try {
    const value: unknown = JSON.parse(body);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.join(",") !== "connection_id,purpose,source") throw new Error();
    if (record.connection_id !== pathConnectionId || !UUID_PATTERN.test(pathConnectionId)) throw new Error();
    if (typeof record.source !== "string" || !GOOGLE_SOURCES.includes(record.source as GoogleSource)) throw new Error();
    if (typeof record.purpose !== "string" || !PURPOSES.includes(record.purpose as (typeof PURPOSES)[number])) {
      throw new Error();
    }
    return {
      connectionId: pathConnectionId,
      source: record.source as GoogleSource,
      purpose: record.purpose as (typeof PURPOSES)[number],
    };
  } catch {
    throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  }
}

export function createGoogleTokenBrokerHandler(dependencies: GoogleBrokerDependencies) {
  return async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const suppliedRequestId = request.headers.get("x-searchtrust-request-id") ?? "";
    const responseRequestId = /^[A-Za-z0-9._:-]{1,200}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : "unavailable";
    try {
      const secret = dependencies.getSecret();
      if (!secret) throw new GoogleConnectionError("GOOGLE_OAUTH_NOT_CONFIGURED", { status: 503 });
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
        throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
      }
      const timestamp = request.headers.get("x-searchtrust-timestamp") ?? "";
      const nonce = request.headers.get("x-searchtrust-nonce") ?? "";
      const version = request.headers.get("x-searchtrust-signature-version") ?? "";
      const signature = request.headers.get("x-searchtrust-signature") ?? "";
      if (!verifyGoogleBrokerSignature({
        secret,
        timestamp,
        requestId: suppliedRequestId,
        nonce,
        body,
        version,
        signature,
        nowSeconds: dependencies.nowSeconds(),
        allowedClockSkewSeconds: 60,
      })) {
        throw new GoogleConnectionError("GOOGLE_BROKER_AUTH_FAILED", { status: 401 });
      }

      const parsed = parseBody(body, (await context.params).id);
      const requestedAt = new Date(Number(timestamp) * 1_000);
      const claimed = await dependencies.createRepository().claimBrokerRequest({
        requestId: suppliedRequestId,
        nonceDigest: digestGoogleBrokerNonce(nonce),
        connectionId: parsed.connectionId,
        source: parsed.source,
        requestedAt: requestedAt.toISOString(),
        expiresAt: new Date(requestedAt.getTime() + 5 * 60 * 1_000).toISOString(),
      });
      if (!claimed) throw new GoogleConnectionError("GOOGLE_BROKER_REPLAYED", { status: 409 });

      const token = await dependencies.createService().getAccessToken(
        parsed.connectionId,
        parsed.source,
        suppliedRequestId,
      );
      return NextResponse.json({
        access_token: token.accessToken,
        expires_at: token.expiresAt,
        granted_scopes: token.grantedScopes,
        token_type: "Bearer",
      }, { headers: headers(responseRequestId) });
    } catch (error) {
      return errorResponse(error, responseRequestId);
    }
  };
}
