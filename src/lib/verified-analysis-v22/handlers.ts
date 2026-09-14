import { NextRequest, NextResponse } from "next/server";
import { parseTaskCreateResponse } from "../analysis-v22/validate";
import { isRecord, isUuid } from "./contracts";
import { VerifiedAnalysisContractError, type VerifiedAnalysisRepository } from "./repository";

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const MAX_BODY_BYTES = 128 * 1024;

interface Dependencies {
  getCurrentUser(): Promise<{ userId: string } | null>;
  isEnabled(): boolean;
  createRepository(): VerifiedAnalysisRepository;
  getConfig(): { baseUrl: string; token: string } | null;
  fetcher: typeof fetch;
  timeoutMs: number;
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function upstreamConfig(deps: Dependencies) {
  const config = deps.getConfig();
  if (!config) return null;
  const token = config.token.trim();
  if (!/^[\x21-\x7e]+$/u.test(token)) return null;
  try {
    const url = new URL(config.baseUrl.trim());
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return { baseUrl: url.toString().replace(/\/$/, ""), token };
  } catch { return null; }
}

export function createVerifiedAnalysisSubmitHandler(deps: Dependencies) {
  return async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await deps.getCurrentUser();
    if (!user) return jsonError("UNAUTHORIZED", "Sign in to start this analysis.", 401);
    if (!deps.isEnabled()) return jsonError("NOT_FOUND", "Verified analysis is not available.", 404);
    const { id: caseId } = await context.params;
    const jobId = request.headers.get("x-searchtrust-job-id") ?? "";
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    const previousJobId = request.headers.get("x-searchtrust-previous-job-id");
    if (!isUuid(caseId) || !isUuid(jobId) || !IDEMPOTENCY_PATTERN.test(idempotencyKey)
      || (previousJobId !== null && !isUuid(previousJobId))) return jsonError("INVALID_REQUEST", "The analysis identifiers are invalid.", 400);
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error();
      const body: unknown = JSON.parse(text);
      if (!isRecord(body) || Object.keys(body).length !== 0) throw new Error();
    } catch {
      return jsonError("INVALID_REQUEST", "The Verified analysis request must be an empty JSON object.", 400);
    }
    const config = upstreamConfig(deps);
    if (!config) return jsonError("V22_ANALYSIS_NOT_CONFIGURED", "The v2.2 analysis service is not configured.", 503);
    const readinessController = new AbortController();
    const readinessTimer = setTimeout(() => readinessController.abort(), deps.timeoutMs);
    try {
      const readiness = await deps.fetcher(`${config.baseUrl}/api/v2/verified-analyze`, {
        method: "HEAD", cache: "no-store", signal: readinessController.signal,
        headers: { authorization: `Bearer ${config.token}` },
      });
      if (readiness.status !== 204) return jsonError("V22_ANALYSIS_UNAVAILABLE", "The analysis task could not be started yet.", readiness.status === 404 ? 404 : 503);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return jsonError(timedOut ? "V22_ANALYSIS_TIMEOUT" : "V22_ANALYSIS_UNAVAILABLE", timedOut ? "The analysis service took too long to respond." : "The analysis service is temporarily unavailable.", timedOut ? 504 : 503);
    } finally {
      clearTimeout(readinessTimer);
    }
    let started;
    try {
      started = await deps.createRepository().start(user.userId, caseId, jobId, idempotencyKey, previousJobId);
    } catch (error) {
      if (error instanceof VerifiedAnalysisContractError) return jsonError("V22_UPSTREAM_CONTRACT_INVALID", "The analysis service returned an invalid response.", 502);
      return jsonError("VERIFIED_ANALYSIS_UNAVAILABLE", "This Case is not eligible for Verified analysis or has no available credit.", 409);
    }
    // The RPC owns the debit. Any dispatch failure is compensated once by stale-job
    // reconciliation; this handler must never adjust credits or refund the attempt.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
    try {
      const response = await deps.fetcher(`${config.baseUrl}/api/v2/verified-analyze`, {
        method: "POST", body: JSON.stringify(started.request), cache: "no-store", signal: controller.signal,
        headers: {
          "content-type": "application/json", authorization: `Bearer ${config.token}`,
          "X-SearchTrust-Job-ID": started.binding.job_id, "Idempotency-Key": idempotencyKey,
        },
      });
      // Abort/network failures while consuming the body must retain their status.
      // Only JSON syntax errors are invalid contracts, not transport failures.
      const payload: unknown = await response.json().catch((error: unknown) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      });
      if (!response.ok) {
        const status = response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : response.status === 503 ? 503 : 502;
        return jsonError("V22_ANALYSIS_UNAVAILABLE", "The analysis task could not be started yet.", status);
      }
      const validated = parseTaskCreateResponse(payload);
      if (!validated.ok || validated.value.job_id !== started.binding.job_id) return jsonError("V22_UPSTREAM_CONTRACT_INVALID", "The analysis service returned an invalid response.", 502);
      return NextResponse.json(validated.value, { status: 202 });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return jsonError(timedOut ? "V22_ANALYSIS_TIMEOUT" : "V22_ANALYSIS_UNAVAILABLE", timedOut ? "The analysis service took too long to respond." : "The analysis service is temporarily unavailable.", timedOut ? 504 : 503);
    } finally {
      clearTimeout(timer);
    }
  };
}
