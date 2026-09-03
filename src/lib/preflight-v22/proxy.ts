import { NextRequest, NextResponse } from "next/server";

import type { ValidationResult } from "./contracts";
import {
  parseDiscoveryCreateResponse,
  parseDiscoveryRequest,
  parseDiscoveryRetryResponse,
  parseDiscoveryStatusResponse,
  parsePreflightRequest,
  parsePreflightResponse,
} from "./validate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const MAX_BODY_BYTES = 64 * 1024;

interface UpstreamConfig { baseUrl: string; token: string }
interface ProxyDependencies {
  getConfig(): UpstreamConfig | null;
  fetcher: typeof fetch;
  timeoutMs: number;
}

const defaults: ProxyDependencies = {
  getConfig: () => {
    const baseUrl = process.env.V22_API_BASE_URL?.trim();
    const token = process.env.V22_INTERNAL_API_TOKEN?.trim();
    if (!baseUrl || !token) return null;
    try {
      const parsed = new URL(baseUrl);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
      return { baseUrl: parsed.toString().replace(/\/$/, ""), token };
    } catch {
      return null;
    }
  },
  fetcher: fetch,
  timeoutMs: 15_000,
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function jsonBody(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  return JSON.parse(text);
}

function safeUpstreamError(status: number, value: unknown) {
  const detail = value && typeof value === "object" && !Array.isArray(value)
    ? (value as { detail?: unknown }).detail
    : null;
  const code = detail && typeof detail === "object" && !Array.isArray(detail)
    && typeof (detail as { code?: unknown }).code === "string"
    && /^[A-Z0-9_]{1,120}$/.test((detail as { code: string }).code)
    ? (detail as { code: string }).code
    : null;
  const message = detail && typeof detail === "object" && !Array.isArray(detail)
    && typeof (detail as { message?: unknown }).message === "string"
    && (detail as { message: string }).message.length <= 500
    ? (detail as { message: string }).message
    : null;

  if (status === 404) return jsonError(code ?? "DISCOVERY_JOB_NOT_FOUND", message ?? "The competitor discovery task was not found.", 404);
  if (status === 409) return jsonError(code ?? "DISCOVERY_CONFLICT", message ?? "The competitor discovery request conflicts with an existing task.", 409);
  if (status === 422 || status === 400) return jsonError(code ?? "UPSTREAM_VALIDATION_ERROR", message ?? "The request was not accepted by the analysis service.", 422);
  if (status === 401 || status === 403) return jsonError("V22_SERVICE_UNAVAILABLE", "The analysis service is temporarily unavailable.", 503);
  if (status === 503) return jsonError(code ?? "V22_SERVICE_UNAVAILABLE", message ?? "The analysis service is temporarily unavailable.", 503);
  return jsonError("V22_UPSTREAM_ERROR", "The analysis service could not complete the request.", 502);
}

async function forward<T>(
  deps: ProxyDependencies,
  path: string,
  init: RequestInit,
  validate: (value: unknown) => ValidationResult<T>,
) {
  const config = deps.getConfig();
  if (!config) return jsonError("V22_PREFLIGHT_NOT_CONFIGURED", "The v2.2 preflight service is not configured.", 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const response = await deps.fetcher(`${config.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
        ...(init.headers ?? {}),
      },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) return safeUpstreamError(response.status, payload);
    const parsed = validate(payload);
    if (!parsed.ok) return jsonError("V22_UPSTREAM_CONTRACT_INVALID", "The analysis service returned an invalid response.", 502);
    return NextResponse.json(parsed.value, { status: response.status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonError(
      timedOut ? "V22_SERVICE_TIMEOUT" : "V22_SERVICE_UNAVAILABLE",
      timedOut ? "The analysis service took too long to respond." : "The analysis service is temporarily unavailable.",
      timedOut ? 504 : 503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function createPreflightProxy(overrides: Partial<ProxyDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async function POST(request: NextRequest) {
    let body: unknown;
    try { body = await jsonBody(request); } catch {
      return jsonError("INVALID_REQUEST", "The preflight request is invalid.", 400);
    }
    const parsed = parsePreflightRequest(body);
    if (!parsed.ok) return jsonError("INVALID_REQUEST", "The preflight request is invalid.", 400);
    return forward(deps, "/api/v2/preflight", { method: "POST", body: JSON.stringify(parsed.value) }, parsePreflightResponse);
  };
}

export function createDiscoverySubmitProxy(overrides: Partial<ProxyDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async function POST(request: NextRequest) {
    const jobId = request.headers.get("x-searchtrust-discovery-job-id") ?? "";
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (!UUID_PATTERN.test(jobId) || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return jsonError("INVALID_REQUEST", "The competitor discovery identifiers are invalid.", 400);
    }
    let body: unknown;
    try { body = await jsonBody(request); } catch {
      return jsonError("INVALID_REQUEST", "The competitor discovery request is invalid.", 400);
    }
    const parsed = parseDiscoveryRequest(body);
    if (!parsed.ok) return jsonError("INVALID_REQUEST", "The competitor discovery request is invalid.", 400);
    return forward(deps, "/api/v2/competitors/discover", {
      method: "POST",
      body: JSON.stringify(parsed.value),
      headers: { "X-SearchTrust-Discovery-Job-ID": jobId, "Idempotency-Key": idempotencyKey },
    }, parseDiscoveryCreateResponse);
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export function createDiscoveryStatusProxy(overrides: Partial<ProxyDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async function GET(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return jsonError("INVALID_REQUEST", "The competitor discovery task ID is invalid.", 400);
    return forward(deps, `/api/v2/competitors/tasks/${id}`, { method: "GET" }, parseDiscoveryStatusResponse);
  };
}

export function createDiscoveryRetryProxy(overrides: Partial<ProxyDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async function POST(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return jsonError("INVALID_REQUEST", "The competitor discovery task ID is invalid.", 400);
    return forward(deps, `/api/v2/competitors/tasks/${id}/retry`, { method: "POST" }, parseDiscoveryRetryResponse);
  };
}
