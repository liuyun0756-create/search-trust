import {exact, uuid} from "../implementation-records/contracts";
import {parsePageContext, parsePageRate, parsePageSelection, parsePageView} from "./contracts";
import type {PageCheckSelection} from "./types";

type Dependencies = {enabled: () => boolean; user: () => Promise<{userId: string} | null>;
  config: () => {baseUrl: string; token: string} | null; fetch?: typeof fetch};
type Route = {params: Promise<{id: string; reportId: string}>};
const reply = (value: unknown, status = 200) => Response.json(value, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
async function boundedJson(response: Response | Request, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {await reader.cancel(); throw new Error("large");}
      chunks.push(next.value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}
export function createPageCheckHandlers(deps: Dependencies) {
  async function handle(request: Request, route: Route, write: boolean) {
    if (!deps.enabled()) return reply({code: "NOT_FOUND"}, 404);
    const user = await deps.user();
    if (!user) return reply({code: "UNAUTHORIZED"}, 401);
    const {id: caseId, reportId} = await route.params, url = new URL(request.url);
    const deliveryRevisionId = url.searchParams.get("deliveryRevisionId");
    if (![caseId, reportId, deliveryRevisionId].every(uuid)
      || [...url.searchParams.keys()].some(k => !["deliveryRevisionId", "checkId"].includes(k))
      || [...new Set(url.searchParams.keys())].some(k => url.searchParams.getAll(k).length !== 1)) return reply({code: "INVALID"}, 400);
    let checkId = url.searchParams.get("checkId"), selection: PageCheckSelection | null = null;
    if (write) {
      const host = request.headers.get("host"), origin = host ? `${url.protocol}//${host}` : url.origin;
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({code: "FORBIDDEN"}, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({code: "INVALID"}, 415);
      if (checkId !== null) return reply({code: "INVALID"}, 400);
      try {
        const body = await boundedJson(request, 24576);
        if (!body || typeof body !== "object" || Array.isArray(body) || !exact(body, ["checkId", "selection"]) || !uuid(body.checkId)) throw new Error("invalid");
        checkId = body.checkId; selection = parsePageSelection(body.selection);
        if (!selection) throw new Error("invalid");
      } catch (error) {return reply({code: "INVALID"}, error instanceof Error && error.message === "large" ? 413 : 400);}
    } else if (checkId !== null && !uuid(checkId)) return reply({code: "INVALID"}, 400);
    const target = {caseId, reportId, deliveryRevisionId: deliveryRevisionId!};
    try {
      const config = deps.config();
      if (!config || !/^[\x21-\x7E]+$/.test(config.token)) throw new Error("config");
      const base = new URL(config.baseUrl);
      if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error("config");
      const response = await (deps.fetch ?? fetch)(`${base.href.replace(/\/$/, "")}/api/v2/page-checks`, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: {Authorization: `Bearer ${config.token}`, "Content-Type": "application/json"},
        body: JSON.stringify({operation: write ? "request" : checkId ? "read" : "context", user_id: user.userId,
          case_id: caseId, report_id: reportId, delivery_revision_id: deliveryRevisionId, check_id: checkId, selection}),
      });
      if (response.status === 429) {
        const rate = parsePageRate(await boundedJson(response, 2048));
        return rate ? reply(rate, 429) : reply({code: "UNAVAILABLE"}, 503);
      }
      if (!response.ok) {
        await response.body?.cancel();
        return reply({code: response.status === 409 ? "CONFLICT" : response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE"}, [404,409].includes(response.status) ? response.status : 503);
      }
      const raw = await boundedJson(response, 131072);
      const parsed = checkId ? parsePageView(raw, target, checkId, selection ?? undefined) : parsePageContext(raw, target);
      return parsed ? reply(parsed) : reply({code: "UNAVAILABLE"}, 503);
    } catch {return reply({code: "UNAVAILABLE"}, 503);}
  }
  return {GET: (request: Request, route: Route) => handle(request, route, false), POST: (request: Request, route: Route) => handle(request, route, true)};
}
