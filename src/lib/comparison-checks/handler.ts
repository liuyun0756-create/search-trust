import {canonicalDigest} from "../verified-analysis-v22/digest";
import {exact, uuid} from "../implementation-records/contracts";
import {parseContext, parseSelection, parseView} from "./contracts";
import type {ComparisonSelection} from "./types";
import {parseCollectionContext, parseCollectionSelection, parseCollectionView} from "../comparison-collections/contracts";
import type {CollectionSelection} from "../comparison-collections/types";
import {parseGa4Context, parseGa4Selection, parseGa4View} from "../ga4-comparison-collections/contracts";
import type {Ga4CollectionSelection} from "../ga4-comparison-collections/types";

type Dependencies = {enabled: () => boolean; user: () => Promise<{userId: string} | null>;
  config: () => {baseUrl: string; token: string} | null; fetch?: typeof fetch; kind?: "collection" | "ga4-collection"};
type Route = {params: Promise<{id: string; reportId: string}>};
const reply = (value: unknown, status = 200) => Response.json(value, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
async function boundedJson(response: Response | Request, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {const next = await reader.read(); if (next.done) break; length += next.value.byteLength;
      if (length > limit) {await reader.cancel(); throw new Error("large");} chunks.push(next.value);}
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}
export function createComparisonHandlers(deps: Dependencies) {
  const ga4 = deps.kind === "ga4-collection", collection = ga4 || deps.kind === "collection", idKey = collection ? "collectionId" : "comparisonId";
  async function handle(request: Request, route: Route, write: boolean) {
    if (!deps.enabled()) return reply({code: "NOT_FOUND"}, 404);
    const user = await deps.user();
    if (!user) return reply({code: "UNAUTHORIZED"}, 401);
    const {id: caseId, reportId} = await route.params, url = new URL(request.url);
    const deliveryRevisionId = url.searchParams.get("deliveryRevisionId");
    if (![caseId, reportId, deliveryRevisionId].every(uuid)
      || [...url.searchParams.keys()].some(k => !["deliveryRevisionId", idKey].includes(k))
      || [...new Set(url.searchParams.keys())].some(k => url.searchParams.getAll(k).length !== 1)) return reply({code: "INVALID"}, 400);
    let comparisonId = url.searchParams.get(idKey), selection: ComparisonSelection | CollectionSelection | Ga4CollectionSelection | null = null;
    if (write) {
      const host = request.headers.get("host"), origin = host ? `${url.protocol}//${host}` : url.origin;
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({code: "FORBIDDEN"}, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({code: "INVALID"}, 415);
      if (comparisonId !== null) return reply({code: "INVALID"}, 400);
      try {
        const body = await boundedJson(request, 20000);
        if (!body || typeof body !== "object" || Array.isArray(body) || !exact(body, [idKey, "selection"]) || !uuid(body[idKey])) throw new Error("invalid");
        comparisonId = body[idKey]; selection = ga4 ? parseGa4Selection(body.selection) : collection ? parseCollectionSelection(body.selection) : parseSelection(body.selection);
        if (!selection) throw new Error("invalid");
      } catch (error) {return reply({code: "INVALID"}, error instanceof Error && error.message === "large" ? 413 : 400);}
    } else if (comparisonId !== null && !uuid(comparisonId)) return reply({code: "INVALID"}, 400);
    const target = {caseId, reportId, deliveryRevisionId: deliveryRevisionId!};
    try {
      const config = deps.config();
      if (!config || !/^[\x21-\x7E]+$/.test(config.token)) throw new Error("config");
      const base = new URL(config.baseUrl);
      if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error("config");
      const response = await (deps.fetch ?? fetch)(`${base.href.replace(/\/$/, "")}/api/v2/${ga4 ? "ga4-comparison-collections" : collection ? "comparison-collections" : "comparisons"}`, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: {"Authorization": `Bearer ${config.token}`, "Content-Type": "application/json"},
        body: JSON.stringify({operation: write ? (collection ? "request" : "freeze") : comparisonId ? "read" : "context", user_id: user.userId,
          case_id: caseId, report_id: reportId, delivery_revision_id: deliveryRevisionId, [collection ? "collection_id" : "comparison_id"]: comparisonId, selection}),
      });
      if (!response.ok) {await response.body?.cancel(); return reply({code: response.status === 409 ? "CONFLICT" : response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE"}, [404,409].includes(response.status) ? response.status : 503);}
      const raw = await boundedJson(response, 150000);
      const parsed = ga4 ? (comparisonId ? parseGa4View(raw, target, comparisonId, selection as Ga4CollectionSelection | undefined) : parseGa4Context(raw, target)) : collection
        ? (comparisonId ? parseCollectionView(raw, target, comparisonId, selection as CollectionSelection | undefined) : parseCollectionContext(raw, target))
        : (comparisonId ? parseView(raw, target, comparisonId, selection as ComparisonSelection | undefined) : parseContext(raw, target));
      if (!parsed) throw new Error("invalid");
      if ("result" in parsed) {const {checksum, ...content} = parsed.result; if (canonicalDigest(content) !== checksum) throw new Error("digest");}
      return reply(parsed);
    } catch {return reply({code: "UNAVAILABLE"}, 503);}
  }
  return {GET: (request: Request, route: Route) => handle(request, route, false), POST: (request: Request, route: Route) => handle(request, route, true)};
}
