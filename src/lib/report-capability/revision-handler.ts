import { NextResponse } from "next/server";
import { CapabilityPersistenceError, type CapabilityRepository } from "./repository";
import { initialCapabilityRevision } from "./revision";
import { validateDeliveryRevision } from "./validate";

type Context = { params: Promise<{ id: string; reportId: string }> };
type Dependencies = {
  getCurrentUser(): Promise<{ userId: string } | null>;
  isEnabled(): boolean;
  repository(): Pick<CapabilityRepository,"loadCompletedReport"|"loadRevision"|"saveRevision">;
};
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (status: number, code: string) => respond({ ok: false, code }, status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function boundedBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100_000) { await reader.cancel(); throw new Error("body"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
  return value as Record<string,unknown>;
}

export function createCapabilityRevisionHandlers(deps: Dependencies) {
  async function handle(request: Request, context: Context, operation: "read"|"draft"|"approved") {
    try {
      const user = await deps.getCurrentUser();
      if (!user) return failure(401,"UNAUTHORIZED");
      if (!deps.isEnabled()) return failure(404,"NOT_FOUND");
      const {id:caseId,reportId} = await context.params;
      if (![caseId,reportId].every(id => uuid.test(id))) return failure(400,"CAPABILITY_INVALID");
      if (operation !== "read") {
        const origin = request.headers.get("origin");
        if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return failure(403,"FORBIDDEN");
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure(415,"CAPABILITY_INVALID");
      }
      const repository = deps.repository();
      const report = await repository.loadCompletedReport(user.userId,caseId,reportId);
      if (!report) return failure(404,"NOT_FOUND");
      if (operation === "read") {
        const saved = await repository.loadRevision(user.userId,caseId,report);
        return respond({revision:saved?.revision ?? 0,status:saved?.status ?? "original",
          content:saved ? {...saved.content,expected_revision:saved.revision} : initialCapabilityRevision(report)});
      }
      let body: Record<string,unknown>;
      try { body = await boundedBody(request); } catch { return failure(400,"CAPABILITY_INVALID"); }
      if (Object.keys(body).some(key => !["content","reviewConfirmed"].includes(key))
        || (operation === "approved" && body.reviewConfirmed !== true)
        || !validateDeliveryRevision(body.content,report) || body.content.status !== operation
        || body.content.user_id !== user.userId || body.content.case_id !== caseId || body.content.report_id !== reportId) {
        return failure(400,"CAPABILITY_INVALID");
      }
      const saved = await repository.saveRevision(user.userId,caseId,report,body.content);
      return respond({ok:true,revision:saved.revision,content:saved.content});
    } catch (error) {
      if (error instanceof CapabilityPersistenceError) return failure(error.code === "CAPABILITY_CONFLICT" ? 409 : error.code === "CAPABILITY_INVALID" ? 400 : 503,error.code);
      return failure(503,"CAPABILITY_UNAVAILABLE");
    }
  }
  return {GET:(req:Request,ctx:Context)=>handle(req,ctx,"read"),
    PUT:(req:Request,ctx:Context)=>handle(req,ctx,"draft"),POST:(req:Request,ctx:Context)=>handle(req,ctx,"approved")};
}
