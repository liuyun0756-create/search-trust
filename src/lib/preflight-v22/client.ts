import type {
  CompetitorDiscoveryRequest,
  CompetitorDiscoveryRetryResponse,
  CompetitorDiscoveryStatusResponse,
  CompetitorDiscoveryTaskCreateResponse,
  PreflightRequest,
  PreflightResponse,
  ValidationResult,
} from "./contracts";
import { isApiErrorPayload, PreflightApiError } from "./errors";
import {
  parseDiscoveryCreateResponse,
  parseDiscoveryRetryResponse,
  parseDiscoveryStatusResponse,
  parsePreflightResponse,
} from "./validate";

async function request<T>(
  path: string,
  init: RequestInit,
  validate: (value: unknown) => ValidationResult<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store" });
  } catch {
    throw new PreflightApiError("NETWORK_ERROR", "The service could not be reached. Please try again.", 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorPayload(payload)) throw new PreflightApiError(payload.error.code, payload.error.message, response.status);
    throw new PreflightApiError("UNEXPECTED_ERROR", "The request could not be completed.", response.status);
  }
  const parsed = validate(payload);
  if (!parsed.ok) throw new PreflightApiError("INVALID_SERVER_RESPONSE", "The service returned an invalid response.", 502);
  return parsed.value;
}

export function runPreflight(body: PreflightRequest, signal?: AbortSignal): Promise<PreflightResponse> {
  return request("/api/v2/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }, parsePreflightResponse);
}

export function submitCompetitorDiscovery(
  body: CompetitorDiscoveryRequest,
  discoveryJobId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CompetitorDiscoveryTaskCreateResponse> {
  return request("/api/v2/competitors/discover", {
    method: "POST", headers: { "content-type": "application/json", "x-searchtrust-discovery-job-id": discoveryJobId, "idempotency-key": idempotencyKey },
    body: JSON.stringify(body), signal,
  }, parseDiscoveryCreateResponse);
}

export function getCompetitorDiscovery(jobId: string, signal?: AbortSignal): Promise<CompetitorDiscoveryStatusResponse> {
  return request(`/api/v2/competitors/tasks/${encodeURIComponent(jobId)}`, { method: "GET", signal }, parseDiscoveryStatusResponse);
}

export function retryCompetitorDiscovery(jobId: string, signal?: AbortSignal): Promise<CompetitorDiscoveryRetryResponse> {
  return request(`/api/v2/competitors/tasks/${encodeURIComponent(jobId)}/retry`, { method: "POST", signal }, parseDiscoveryRetryResponse);
}
