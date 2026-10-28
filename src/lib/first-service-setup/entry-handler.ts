import { v22PublicEntryPausedResponse } from "../release-v22/public-entry";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "../verified-analysis-v22/contracts";
import {
  parseEntryCommand,
  type EntryCommand,
  type EntryView,
} from "./entry-contract";

type Dependencies = {
  enabled(): boolean;
  intakeEnabled(): boolean;
  user(): Promise<{ userId: string } | null>;
  repository(): {
    read(user: string, caseId: string): Promise<EntryView>;
    execute(user: string, caseId: string, c: EntryCommand): Promise<EntryView>;
  };
};
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Cookie" },
  });
const error = (status: number, code: string, message: string) =>
  response({ error: { code, message } }, status);
export function createFirstServiceEntryHandlers(deps: Dependencies) {
  const handle = async (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => {
    if (!deps.enabled())
      return error(
        404,
        "NOT_FOUND",
        "First-service analysis is not available.",
      );
    const user = await deps.user();
    if (!user) return error(401, "UNAUTHORIZED", "Sign in to continue.");
    const { id } = await ctx.params;
    if (!isUuid(id)) return error(404, "NOT_FOUND", "Client not found.");
    let command: EntryCommand | null = null;
    if (req.method === "POST") {
      // NextURL normalizes loopback IPs to localhost. Preserve the received Host
      // so distinct browser origins are neither rejected nor treated as aliases.
      const origin = req.headers.has("host")
        ? `${req.nextUrl.protocol}//${req.headers.get("host")}`
        : req.nextUrl.origin;
      if (
        req.headers.get("origin") !== origin ||
        req.headers.get("sec-fetch-site") === "cross-site"
      )
        return error(
          403,
          "ORIGIN_MISMATCH",
          "Reload this page before continuing.",
        );
      if (!req.headers.get("content-type")?.startsWith("application/json"))
        return error(400, "INVALID", "Send a JSON request.");
      const reader = req.body?.getReader();
      if (!reader) return error(400, "INVALID", "A confirmation is required.");
      try {
        let size = 0;
        const parts: Uint8Array[] = [];
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 12000) {
            await reader.cancel();
            return error(413, "TOO_LARGE", "The request is too large.");
          }
          parts.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) {
          bytes.set(part, offset);
          offset += part.length;
        }
        command = parseEntryCommand(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
      } catch {
        return error(400, "INVALID", "Check the confirmation and try again.");
      } finally {
        reader.releaseLock();
      }
      if (!command)
        return error(
          400,
          "INVALID",
          "Check the confirmation and selected sources.",
        );
    }
    try {
      const repo = deps.repository();
      if (command?.action === "start" && !deps.intakeEnabled()) {
        const saved = await repo.read(user.userId, id);
        return saved.workflow?.id === command.workflowId
          ? response(saved)
          : v22PublicEntryPausedResponse();
      }
      return response(
        command
          ? await repo.execute(user.userId, id, command)
          : await repo.read(user.userId, id),
      );
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String(e.code)
          : "UNAVAILABLE";
      if (code === "NOT_FOUND") return error(404, code, "Client not found.");
      if (code === "INSUFFICIENT_CREDITS")
        return error(
          409,
          code,
          "One credit is needed. No new analysis was started.",
        );
      if (code === "BUDGET_EXHAUSTED")
        return error(
          409,
          code,
          "The execution allowance is used up. No extra credit was charged. Keep this Case and contact support before starting again.",
        );
      if (["CONFLICT", "FIRST_SERVICE_CONFLICT"].includes(code))
        return error(
          409,
          "CONFLICT",
          "This workflow changed. Check its current status before continuing.",
        );
      if (code === "NOT_READY")
        return error(
          409,
          code,
          "This step is not ready. Refresh status and check your data connections. Do not start another paid workflow.",
        );
      return error(
        503,
        "UNAVAILABLE",
        "We could not confirm the result. Check the current status before trying again; do not start another analysis.",
      );
    }
  };
  return { GET: handle, POST: handle };
}
