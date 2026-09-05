import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleConnectionError } from "../google-connections/errors";
import { ResourceError, parseSource, parseUuid } from "./contracts";
import type { ResourceService } from "./service";

export function createResourceHandlers(deps: {
  getCurrentUser(): Promise<{ userId: string } | null>;
  createService(): ResourceService;
}) {
  type Context = { params: Promise<{ id: string }> };
  async function run(request: NextRequest, context: Context, action: (service: ResourceService, userId: string, caseId: string, requestId: string) => Promise<unknown>) {
    const requestId = randomUUID();
    const headers = { "cache-control": "no-store", "x-request-id": requestId };
    try {
      if (request.method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) throw new ResourceError("FORBIDDEN", 403);
      const user = await deps.getCurrentUser();
      if (!user) throw new ResourceError("FORBIDDEN", 401);
      const caseId = parseUuid((await context.params).id);
      return NextResponse.json(await action(deps.createService(), user.userId, caseId, requestId), { headers });
    } catch (error) {
      const safe = error instanceof ResourceError || error instanceof GoogleConnectionError ? error : new ResourceError("PERSISTENCE_FAILED", 503);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
    }
  }
  async function body(request: NextRequest): Promise<Record<string, unknown>> {
    try {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8192) throw new Error();
      const result = JSON.parse(raw);
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
      return result;
    } catch { throw new ResourceError("INVALID_REQUEST"); }
  }
  function resourceId(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.length > 2048) throw new ResourceError("INVALID_REQUEST");
    return value;
  }
  return {
    GET: (request: NextRequest, context: Context) => run(request, context, async (service, userId, caseId, requestId) => {
      const q = request.nextUrl.searchParams;
      if (!q.has("source")) return { bindings: await service.bindings(userId, caseId) };
      return service.discover(userId, caseId, parseUuid(q.get("connection_id")), {
        source: parseSource(q.get("source")), parent: q.get("parent"), pageToken: q.get("page_token"),
      }, requestId, q.has("resource_id") ? resourceId(q.get("resource_id")) : undefined);
    }),
    POST: (request: NextRequest, context: Context) => run(request, context, async (service, userId, caseId, requestId) => {
      const input = await body(request);
      if (input.confirm_selection !== true || !("expected_binding_id" in input)) throw new ResourceError("INVALID_REQUEST");
      if (input.parent !== null && typeof input.parent !== "string") throw new ResourceError("INVALID_REQUEST");
      if (input.identity_confirmed !== undefined && typeof input.identity_confirmed !== "boolean") throw new ResourceError("INVALID_REQUEST");
      if (typeof input.identity_review_token !== "string" || !/^[a-f0-9]{64}$/.test(input.identity_review_token)) throw new ResourceError("INVALID_REQUEST");
      return service.bind(userId, caseId, {
        connection_id: parseUuid(input.connection_id), source: parseSource(input.source), resource_id: resourceId(input.resource_id),
        parent: input.parent as string | null,
        expected_binding_id: input.expected_binding_id === null ? null : parseUuid(input.expected_binding_id),
        identity_confirmed: input.identity_confirmed === true,
        identity_review_token: input.identity_review_token,
      }, requestId);
    }),
    DELETE: (request: NextRequest, context: Context) => run(request, context, async (service, userId, caseId) => {
      await service.disconnect(userId, caseId, parseUuid((await body(request)).binding_id));
      return { disconnected: true };
    }),
  };
}
