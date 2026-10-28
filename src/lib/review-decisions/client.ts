import { parseCommand, parseResponse, verifyHashes } from "./contracts";
import { boundedJson } from "./json";
import type {
  Identity,
  PublicCommand,
  Context,
  History,
  Revision,
} from "./types";
export class DecisionError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
type Return<C> = C extends { operation: "context" }
  ? Context
  : C extends { operation: "history" }
    ? History
    : Revision;
export async function requestDecision<C extends PublicCommand>(
  identity: Identity,
  body: C,
  signal?: AbortSignal,
): Promise<Return<C>> {
  const command = parseCommand({
    ...body,
    user_id: identity.ownerId,
    case_id: identity.caseId,
    report_id: identity.reportId,
  });
  if (!command) throw new DecisionError(400, "INVALID");
  const path = `/api/v2/cases/${identity.caseId}/reports/${identity.reportId}/review-decisions`,
    write = body.operation === "save";
  const q = new URLSearchParams();
  if (!write)
    for (const [k, v] of Object.entries(body))
      if (v !== undefined && v !== null) q.set(k, String(v));
  const r = await fetch(write ? path : `${path}?${q}`, {
    method: write ? "POST" : "GET",
    body: write ? JSON.stringify(body) : undefined,
    headers: write ? { "Content-Type": "application/json" } : undefined,
    cache: "no-store",
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  const raw = await boundedJson(
    r,
    !r.ok
      ? 2048
      : body.operation === "context"
        ? 524288
        : body.operation === "history"
          ? 32768
          : 131072,
  );
  if (!r.ok) {
    const code = (raw as { code?: string })?.code;
    throw new DecisionError(
      r.status,
      typeof code === "string" ? code : "UNAVAILABLE",
    );
  }
  const v = parseResponse(raw, command);
  if (!v || ("request_checksum" in v && !(await verifyHashes(v))))
    throw new DecisionError(503, "UNAVAILABLE");
  return v as Return<C>;
}
export const accessLost = (e: unknown) =>
  e instanceof DecisionError && [401, 403, 404].includes(e.status);
export function errorMessage(e: unknown) {
  if (e instanceof DecisionError) {
    if (e.code === "STALE")
      return "A newer decision version exists. Your draft is kept. Read the latest version before starting again.";
    if (e.code === "CONFLICT")
      return "This request is already linked to different content. Check the saved version before continuing.";
    if (accessLost(e))
      return "Access to this evidence is no longer available. Reopen the report or sign in again.";
    if (e.status === 400 || e.status === 413)
      return "Check the decision fields, source references and size limits before saving.";
  }
  return "The request could not be verified. Your draft has not been replaced. Retry to check the saved state.";
}
