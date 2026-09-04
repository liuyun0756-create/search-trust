import { NextRequest, NextResponse } from "next/server";

import type { AnalysisRepository } from "./repository";
import { parseAnalyzeRequest, parseTaskCreateResponse, parseTaskStatusResponse } from "./validate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const MAX_BODY_BYTES = 128 * 1024;

type CurrentUser = { userId: string } | null;
interface UpstreamConfig { baseUrl: string; token: string }
interface Dependencies {
  getCurrentUser(): Promise<CurrentUser>;
  createRepository(): AnalysisRepository;
  getConfig(): UpstreamConfig | null;
  fetcher: typeof fetch;
  timeoutMs: number;
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function upstream(deps: Dependencies, path: string, init: RequestInit) {
  const config = deps.getConfig();
  if (!config) return { response: null, error: jsonError("V22_ANALYSIS_NOT_CONFIGURED", "The v2.2 analysis service is not configured.", 503) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const response = await deps.fetcher(`${config.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${config.token}`, ...(init.headers ?? {}) },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const status = response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : response.status === 503 ? 503 : 502;
      return { response: null, error: jsonError("V22_ANALYSIS_UNAVAILABLE", "The analysis task could not be started or checked yet.", status) };
    }
    return { response: { status: response.status, payload }, error: null };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { response: null, error: jsonError(timedOut ? "V22_ANALYSIS_TIMEOUT" : "V22_ANALYSIS_UNAVAILABLE", timedOut ? "The analysis service took too long to respond." : "The analysis service is temporarily unavailable.", timedOut ? 504 : 503) };
  } finally {
    clearTimeout(timer);
  }
}

export function createAnalysisSubmitHandler(deps: Dependencies) {
  return async function POST(request: NextRequest) {
    const user = await deps.getCurrentUser();
    if (!user) return jsonError("UNAUTHORIZED", "Sign in to start this analysis.", 401);
    const jobId = request.headers.get("x-searchtrust-job-id") ?? "";
    const discoveryId = request.headers.get("x-searchtrust-discovery-id") ?? "";
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (!UUID_PATTERN.test(jobId) || !UUID_PATTERN.test(discoveryId) || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return jsonError("INVALID_REQUEST", "The analysis identifiers are invalid.", 400);
    }
    let body: unknown;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error();
      body = JSON.parse(text);
    } catch {
      return jsonError("INVALID_REQUEST", "The analysis request is invalid.", 400);
    }
    const parsed = parseAnalyzeRequest(body);
    if (!parsed.ok) return jsonError("INVALID_REQUEST", "The analysis request is invalid.", 400);
    try {
      await deps.createRepository().start(user.userId, parsed.value.case_id, jobId, idempotencyKey);
    } catch {
      return jsonError("ANALYSIS_ENTITLEMENT_UNAVAILABLE", "This Case does not have an available prospect report entitlement.", 409);
    }
    const result = await upstream(deps, "/api/v2/analyze", {
      method: "POST",
      body: JSON.stringify(parsed.value),
      headers: { "X-SearchTrust-Job-ID": jobId, "X-SearchTrust-Discovery-ID": discoveryId, "Idempotency-Key": idempotencyKey },
    });
    if (result.error) return result.error;
    const validated = parseTaskCreateResponse(result.response!.payload);
    if (!validated.ok || validated.value.job_id !== jobId) return jsonError("V22_UPSTREAM_CONTRACT_INVALID", "The analysis service returned an invalid response.", 502);
    return NextResponse.json(validated.value, { status: 202 });
  };
}

export function createAnalysisStatusHandler(deps: Dependencies) {
  return async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await deps.getCurrentUser();
    if (!user) return jsonError("UNAUTHORIZED", "Sign in to view this analysis.", 401);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return jsonError("INVALID_REQUEST", "The analysis task ID is invalid.", 400);
    let job;
    try { job = await deps.createRepository().getOwned(user.userId, id); } catch {
      return jsonError("ANALYSIS_LOOKUP_FAILED", "The analysis task could not be checked yet.", 500);
    }
    if (!job) return jsonError("ANALYSIS_NOT_FOUND", "The analysis task was not found.", 404);
    const result = await upstream(deps, `/api/v2/tasks/${id}`, { method: "GET" });
    if (result.error) return result.error;
    const validated = parseTaskStatusResponse(result.response!.payload);
    if (!validated.ok || validated.value.job_id !== id) return jsonError("V22_UPSTREAM_CONTRACT_INVALID", "The analysis service returned an invalid response.", 502);
    return NextResponse.json({ ...validated.value, database_report_id: job.reportId });
  };
}
