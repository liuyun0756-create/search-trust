import { NextRequest, NextResponse } from "next/server";

import { parseUuid } from "../google-resources/contracts";
import { ConnectionCenterError, type ConnectionCenterService } from "./service";

export function createConnectionCenterHandlers(deps: {
  enabled(): boolean;
  getCurrentUser(): Promise<{ userId: string } | null>;
  createService(): ConnectionCenterService;
}) {
  type Context = { params: Promise<{ id: string }> };
  return {
    GET: async (request: NextRequest, context: Context) => {
      const headers = { "cache-control": "no-store" };
      try {
        if (!deps.enabled()) throw new ConnectionCenterError("CONNECTION_CENTER_DISABLED", 404);
        const user = await deps.getCurrentUser();
        if (!user) throw new ConnectionCenterError("CONNECTION_CENTER_FORBIDDEN", 401);
        if ([...request.nextUrl.searchParams].length > 0) {
          throw new ConnectionCenterError("CONNECTION_CENTER_INVALID_REQUEST", 400);
        }
        let caseId: string;
        try { caseId = parseUuid((await context.params).id); }
        catch { throw new ConnectionCenterError("CONNECTION_CENTER_INVALID_REQUEST", 400); }
        return NextResponse.json(await deps.createService().get(user.userId, caseId), { headers });
      } catch (error) {
        const safe = error instanceof ConnectionCenterError
          ? error
          : new ConnectionCenterError("CONNECTION_CENTER_STORAGE_UNAVAILABLE", 503);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
      }
    },
  };
}
