import { parseCommand, parseResponse } from "./contracts";
import type { Command, Directory, WorkspaceView } from "./types";

export type Identity = { ownerId: string; caseId: string; reportId: string };
export type PublicCommand = Command extends infer C
  ? C extends Command
    ? Omit<C, "user_id" | "case_id" | "report_id">
    : never
  : never;
export class WorkspaceError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function requestWorkspace(
  identity: Identity,
  body: PublicCommand,
  signal?: AbortSignal,
): Promise<WorkspaceView | Directory> {
  const command = parseCommand({
    ...body,
    user_id: identity.ownerId,
    case_id: identity.caseId,
    report_id: identity.reportId,
  });
  if (!command) throw new WorkspaceError(400, "INVALID");
  const url = `/api/v2/cases/${encodeURIComponent(identity.caseId)}/reports/${encodeURIComponent(identity.reportId)}/review-evidence`;
  const write = body.operation === "preview" || body.operation === "save";
  const query = new URLSearchParams();
  if (!write)
    for (const [key, value] of Object.entries(body))
      if (value !== undefined && value !== null)
        query.set(
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value),
        );
  const response = await fetch(write ? url : `${url}?${query}`, {
    method: write ? "POST" : "GET",
    cache: "no-store",
    redirect: "error",
    signal: signal ?? AbortSignal.timeout(35000),
    ...(write
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  // The BFF also bounds upstream data; keep this boundary bounded independently.
  const reader = response.body?.getReader();
  if (!reader) throw new WorkspaceError(503, "UNAVAILABLE");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512 * 1024) {
        await reader.cancel();
        throw new WorkspaceError(503, "UNAVAILABLE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!response.ok)
    throw new WorkspaceError(
      response.status,
      typeof raw?.code === "string" ? raw.code : "UNAVAILABLE",
    );
  const result = parseResponse(raw, command);
  if (!result) throw new WorkspaceError(503, "UNAVAILABLE");
  return result;
}
export function errorMessage(error: unknown) {
  if (error instanceof WorkspaceError) {
    if (error.code === "STALE")
      return "The review basis changed. Check the refreshed selection before saving.";
    if (error.code === "CONFLICT")
      return "This request belongs to a different selection. Open the saved record before proceeding.";
    if (error.status === 401 || error.status === 403)
      return "Your access has changed. Sign in again and reopen this report.";
    if (error.status === 404)
      return "This report or a selected source is no longer available. Reopen the report and check your selection.";
    if (error.status === 413)
      return "This selection is too large to display safely. No partial evidence will be confirmed.";
  }
  return "Evidence could not be loaded. Retry without changing your selection.";
}
