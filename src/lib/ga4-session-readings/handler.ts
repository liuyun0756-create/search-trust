import {uuid} from "../implementation-records/contracts";
import {parseSessionReading} from "./contracts";

type Dependencies = {enabled: () => boolean; user: () => Promise<{userId: string} | null>;
  config: () => {baseUrl: string; token: string} | null; fetch?: typeof fetch};
type Route = {params: Promise<{id: string; reportId: string}>};
const reply = (value: unknown, status = 200) => Response.json(value, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
async function boundedJson(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let size = 0;
  try {for (;;) {const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength; if (size > 32000) {await reader.cancel(); throw new Error("large");} chunks.push(part.value);
  }} finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}
export function createGa4SessionHandler(deps: Dependencies) {
  return async function GET(request: Request, route: Route) {
    if (!deps.enabled()) return reply({code: "NOT_FOUND"}, 404);
    const user = await deps.user(); if (!user) return reply({code: "UNAUTHORIZED"}, 401);
    if (request.method !== "GET") return reply({code: "METHOD_NOT_ALLOWED"}, 405);
    if (request.headers.get("sec-fetch-site") === "cross-site") return reply({code: "FORBIDDEN"}, 403);
    const {id: caseId, reportId} = await route.params, url = new URL(request.url);
    const deliveryRevisionId = url.searchParams.get("deliveryRevisionId"), collectionId = url.searchParams.get("collectionId");
    if (![caseId, reportId, deliveryRevisionId, collectionId].every(uuid)
      || [...url.searchParams.keys()].some(k => !["deliveryRevisionId", "collectionId"].includes(k) || url.searchParams.getAll(k).length !== 1)) return reply({code: "INVALID"}, 400);
    try {
      const config = deps.config(); if (!config || !/^[\x21-\x7e]+$/.test(config.token)) throw new Error("config");
      const base = new URL(config.baseUrl);
      if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error("config");
      const response = await (deps.fetch ?? fetch)(`${base.href.replace(/\/$/, "")}/api/v2/ga4-session-readings`, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: {Authorization: `Bearer ${config.token}`, "Content-Type": "application/json"},
        body: JSON.stringify({user_id: user.userId, case_id: caseId, report_id: reportId, delivery_revision_id: deliveryRevisionId, collection_id: collectionId}),
      });
      if (!response.ok) {await response.body?.cancel(); return reply({code: response.status === 404 ? "NOT_FOUND" : response.status === 409 ? "CONFLICT" : "UNAVAILABLE"}, [404,409].includes(response.status) ? response.status : 503);}
      const result = parseSessionReading(await boundedJson(response), {caseId, reportId, deliveryRevisionId: deliveryRevisionId!}, collectionId!);
      if (!result || result.user_id !== user.userId) throw new Error("invalid");
      return reply(result);
    } catch {return reply({code: "UNAVAILABLE"}, 503);}
  };
}
