import {NextResponse} from "next/server";
import {exact, uuid} from "./contracts";
import {ImplementationError, type ImplementationRepository} from "./repository";
type Context = {params: Promise<{id: string; reportId: string}>};
type Dependencies = {enabled(): boolean; user(): Promise<{userId: string} | null>; repository(): Pick<ImplementationRepository, "read" | "save">};
const response = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
const failure = (code: string, status: number) => response({error: {code}}, status);
export function createImplementationHandlers(deps: Dependencies) {
  async function handle(request: Request, context: Context) {
    if (!deps.enabled()) return failure("NOT_FOUND", 404);
    const user = await deps.user();
    if (!user) return failure("UNAUTHORIZED", 401);
    const {id, reportId} = await context.params;
    const url = new URL(request.url), revisionId = url.searchParams.get("deliveryRevisionId");
    if (![id, reportId, revisionId].every(uuid)) return failure("NOT_FOUND", 404);
    try {
      const repo = deps.repository();
      if (request.method === "GET") return response(await repo.read(user.userId, id, reportId, revisionId!));
      const host = request.headers.get("host"), origin = host ? `${url.protocol}//${host}` : url.origin;
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return failure("FORBIDDEN", 403);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure("INVALID", 415);
      const reader = request.body?.getReader();
      if (!reader) return failure("INVALID", 400);
      let body: unknown;
      try {
        const chunks: Uint8Array[] = []; let size = 0;
        for (;;) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.length;
          if (size > 40000) {await reader.cancel(); return failure("TOO_LARGE", 413);}
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {return failure("INVALID", 400);} finally {reader.releaseLock();}
      if (!body || typeof body !== "object" || Array.isArray(body) || !exact(body as Record<string, unknown>, ["expectedRevision", "entries"])) return failure("INVALID", 400);
      const b = body as {expectedRevision: number; entries: unknown};
      return response(await repo.save(user.userId, id, reportId, revisionId!, b.expectedRevision, b.entries));
    } catch (error) {
      return error instanceof ImplementationError ? failure(error.code, {NOT_FOUND: 404, INVALID: 400, CONFLICT: 409, UNAVAILABLE: 503}[error.code]) : failure("UNAVAILABLE", 503);
    }
  }
  return {GET: handle, PUT: handle};
}
