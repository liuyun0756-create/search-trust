import { NextRequest, NextResponse } from "next/server";
import { parseUuid } from "../google-resources/contracts";
import { SyncRequestError, type SyncService } from "./service";

export function createSyncHandlers(deps: { enabled(): boolean; user(): Promise<{ userId: string } | null>; service(): SyncService }) {
  type Context = { params: Promise<{ id: string }> };
  const headers = { "cache-control": "no-store" };
  function uuid(value: unknown) {
    try { return parseUuid(value); } catch { throw new SyncRequestError("SYNC_INVALID_REQUEST", 400); }
  }
  async function run(request: NextRequest, context: Context) {
    try {
      if (!deps.enabled()) throw new SyncRequestError("SYNC_DISABLED", 503);
      const user = await deps.user();
      if (!user) throw new SyncRequestError("SYNC_FORBIDDEN", 401);
      const caseId = uuid((await context.params).id);
      if (request.method === "GET") {
        return NextResponse.json(await deps.service().status(user.userId, caseId, uuid(request.nextUrl.searchParams.get("binding_id"))), { headers });
      }
      const origin = request.headers.get("origin");
      if (origin && origin !== request.nextUrl.origin) throw new SyncRequestError("SYNC_FORBIDDEN", 403);
      let input;
      try {
        const text = await request.text();
        if (Buffer.byteLength(text) > 1024) throw new Error();
        input = JSON.parse(text);
        if (!input || typeof input !== "object" || Array.isArray(input) || input.confirm_sync !== true) throw new Error();
      } catch { throw new SyncRequestError("SYNC_INVALID_REQUEST", 400); }
      return NextResponse.json(await deps.service().request(user.userId, caseId, uuid(input.binding_id), uuid(input.request_key)), { status: 202, headers });
    } catch (error) {
      const safe = error instanceof SyncRequestError ? error : new SyncRequestError("SYNC_STORAGE_UNAVAILABLE", 503);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
    }
  }
  return { GET: run, POST: run };
}
