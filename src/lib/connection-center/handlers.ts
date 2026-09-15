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
        const queryEntries = [...request.nextUrl.searchParams];
        if (queryEntries.some(([key]) => key !== "tracked_job_id")
          || request.nextUrl.searchParams.getAll("tracked_job_id").length > 1) {
          throw new ConnectionCenterError("CONNECTION_CENTER_INVALID_REQUEST", 400);
        }
        let trackedJobId: string | undefined;
        const trackedValue = request.nextUrl.searchParams.get("tracked_job_id");
        if (trackedValue !== null) {
          try { trackedJobId = parseUuid(trackedValue); }
          catch { throw new ConnectionCenterError("CONNECTION_CENTER_INVALID_REQUEST", 400); }
        }
        let caseId: string;
        try { caseId = parseUuid((await context.params).id); }
        catch { throw new ConnectionCenterError("CONNECTION_CENTER_INVALID_REQUEST", 400); }
        const service = deps.createService();
        const response = trackedJobId
          ? await service.get(user.userId, caseId, trackedJobId)
          : await service.get(user.userId, caseId);
        return NextResponse.json(response, { headers });
      } catch (error) {
        const safe = error instanceof ConnectionCenterError
          ? error
          : new ConnectionCenterError("CONNECTION_CENTER_STORAGE_UNAVAILABLE", 503);
        return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
      }
    },
  };
}
