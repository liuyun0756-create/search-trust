import {canonicalDigest} from "../verified-analysis-v22/digest";
import {uuid} from "../implementation-records/contracts";
import {parseReviewInput, parseReviewView} from "./contracts";
import type {Ga4ReviewInput} from "./types";

type Dependencies = {enabled: () => boolean; user: () => Promise<{userId: string} | null>;
  config: () => {baseUrl: string; token: string} | null; fetch?: typeof fetch};
type Route = {params: Promise<{id: string; reportId: string}>};
const reply = (v: unknown, status = 200) => Response.json(v, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
async function boundedJson(response: Request | Response, limit: number) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let length = 0;
  try {for (;;) {const part = await reader.read(); if (part.done) break;
    length += part.value.byteLength; if (length > limit) {await reader.cancel(); throw new Error("large");} chunks.push(part.value);
  }} finally {reader.releaseLock();}
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}
export function createGa4ReviewHandlers(deps: Dependencies) {
  async function handle(request: Request, route: Route, write: boolean) {
    if (!deps.enabled()) return reply({code: "NOT_FOUND"}, 404);
    const user = await deps.user(); if (!user) return reply({code: "UNAUTHORIZED"}, 401);
    const {id: caseId, reportId} = await route.params, url = new URL(request.url);
    const deliveryRevisionId = url.searchParams.get("deliveryRevisionId"), collectionId = url.searchParams.get("collectionId");
    if (![caseId, reportId, deliveryRevisionId, collectionId].every(uuid)
      || [...url.searchParams.keys()].some(k => !["deliveryRevisionId", "collectionId"].includes(k) || url.searchParams.getAll(k).length !== 1)) return reply({code: "INVALID"}, 400);
    let review: Ga4ReviewInput | null = null;
    if (write) {
      const host = request.headers.get("host"), origin = host ? `${url.protocol}//${host}` : url.origin;
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({code: "FORBIDDEN"}, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({code: "INVALID"}, 415);
      try {review = parseReviewInput(await boundedJson(request, 20000)); if (!review) throw new Error("invalid");}
      catch (error) {return reply({code: "INVALID"}, error instanceof Error && error.message === "large" ? 413 : 400);}
    }
    try {
      const config = deps.config(); if (!config || !/^[\x21-\x7e]+$/.test(config.token)) throw new Error("config");
      const base = new URL(config.baseUrl);
      if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error("config");
      const response = await (deps.fetch ?? fetch)(`${base.href.replace(/\/$/, "")}/api/v2/ga4-evidence-reviews`, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: {Authorization: `Bearer ${config.token}`, "Content-Type": "application/json"},
        body: JSON.stringify({operation: write ? "save" : "read", user_id: user.userId, case_id: caseId, report_id: reportId,
          delivery_revision_id: deliveryRevisionId, collection_id: collectionId, review}),
      });
      if (!response.ok) {await response.body?.cancel(); return reply({code: response.status === 409 ? "CONFLICT" : response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE"}, [404, 409].includes(response.status) ? response.status : 503);}
      const result = parseReviewView(await boundedJson(response, 400000), {caseId, reportId, deliveryRevisionId: deliveryRevisionId!}, collectionId!, review ?? undefined);
      if (!result) throw new Error("invalid");
      for (const record of [...result.reviews, ...(result.saved ? [result.saved] : [])]) {
        const {checksum, ...content} = record;
        if (record.user_id !== user.userId || canonicalDigest(content) !== checksum) throw new Error("invalid record");
      }
      return reply(result);
    } catch {return reply({code: "UNAVAILABLE"}, 503);}
  }
  return {GET: (request: Request, route: Route) => handle(request, route, false), POST: (request: Request, route: Route) => handle(request, route, true)};
}
