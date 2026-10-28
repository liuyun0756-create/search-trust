import { NextRequest, NextResponse } from "next/server";
import { parseVersionedTaskStatus } from "../analysis-v22/versioned-status";
import { validateCapabilityDispatch, type CapabilityDispatch } from "./runtime";

interface Dependencies {
  getCurrentUser(): Promise<{ userId: string } | null>;
  isEnabled(): boolean;
  loadDispatch(userId: string, caseId: string, jobId: string, idempotencyKey: string): Promise<CapabilityDispatch>;
  getConfig(): { baseUrl: string; token: string } | null;
  fetcher: typeof fetch;
  timeoutMs: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

export function createCapabilityDispatchHandler(deps: Dependencies) {
  return async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await deps.getCurrentUser();
    if (!user) return error(401, "UNAUTHORIZED", "Sign in to continue this analysis.");
    if (!deps.isEnabled()) return error(404, "NOT_FOUND", "This analysis workflow is not available.");
    const { id: caseId } = await context.params;
    const jobId = request.headers.get("x-searchtrust-job-id") ?? "";
    const key = request.headers.get("idempotency-key") ?? "";
    if (!uuid.test(caseId) || !uuid.test(jobId) || !/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
      return error(400, "INVALID_REQUEST", "The analysis identifiers are invalid.");
    }
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error();
      const parts: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 1024) { await reader.cancel(); throw new Error(); }
          parts.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) throw new Error();
    } catch {
      return error(400, "INVALID_REQUEST", "Send an empty JSON object to continue the prepared analysis.");
    }
    let dispatch: CapabilityDispatch;
    try {
      dispatch = await deps.loadDispatch(user.userId, caseId, jobId, key);
      if (!validateCapabilityDispatch(dispatch) || dispatch.user_id !== user.userId || dispatch.case_id !== caseId
        || dispatch.job_id !== jobId || dispatch.idempotency_key !== key) throw new Error();
    } catch {
      return error(409, "CAPABILITY_DISPATCH_UNAVAILABLE", "This prepared analysis is not available. Refresh the Case to check its status.");
    }
    // Completed SQL entitlement can be returned even if the queue is offline.
    if (dispatch.completion) return NextResponse.json(dispatch.completion, { status: 202 });
    const config = deps.getConfig();
    let url: URL;
    try {
      if (!config || !/^[\x21-\x7e]+$/.test(config.token)) throw new Error();
      url = new URL(config.baseUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      return error(503, "CAPABILITY_NOT_CONFIGURED", "The analysis service is not available yet.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
    try {
      const response = await deps.fetcher(`${url.toString().replace(/\/$/, "")}/api/v2/capability-analyze`, {
        method: "POST", cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${config!.token}`,
          "X-SearchTrust-User-ID": user.userId, "X-SearchTrust-Job-ID": jobId, "Idempotency-Key": key },
        body: JSON.stringify(dispatch.request),
      });
      if (!response.ok) return error(response.status === 409 ? 409 : 503, "CAPABILITY_DISPATCH_UNAVAILABLE", "The prepared analysis could not be started or checked yet.");
      const payload: unknown = await response.json();
      const parsed = parseVersionedTaskStatus(payload, jobId, caseId);
      if (!parsed.ok || parsed.value.status === "failed" || ("report" in parsed.value && parsed.value.report !== null)) {
        return error(502, "CAPABILITY_CONTRACT_INVALID", "The analysis service returned an invalid response.");
      }
      return NextResponse.json(parsed.value, { status: 202 });
    } catch {
      // An uncertain network result is not evidence of failed analysis. Never refund here.
      return error(503, "CAPABILITY_DISPATCH_UNAVAILABLE", "Connection interrupted. Refresh the Case to check this same analysis.");
    } finally { clearTimeout(timer); }
  };
}
