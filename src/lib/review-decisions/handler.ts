import { uuid } from "../implementation-records/contracts";
import { parseCommand, parseResponse, verifyHashes } from "./contracts";
import { boundedJson } from "./json";
type Deps = {
  enabled: () => boolean;
  user: () => Promise<{ userId: string } | null>;
  config: () => { baseUrl: string; token: string } | null;
  fetch?: typeof fetch;
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export function createDecisionHandlers(deps: Deps) {
  async function handle(
    request: Request,
    route: { params: Promise<{ id: string; reportId: string }> },
    write: boolean,
  ) {
    if (!deps.enabled()) return reply({ code: "NOT_FOUND" }, 404);
    const user = await deps.user();
    if (!user) return reply({ code: "UNAUTHORIZED" }, 401);
    const { id, reportId } = await route.params;
    if (!uuid(id) || !uuid(reportId)) return reply({ code: "INVALID" }, 400);
    const url = new URL(request.url);
    let body: Record<string, unknown>;
    try {
      if (write) {
        const origin = request.headers.get("host")
          ? `${url.protocol}//${request.headers.get("host")}`
          : url.origin;
        if (
          request.headers.get("origin") !== origin ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          return reply({ code: "FORBIDDEN" }, 403);
        if (
          request.headers.get("content-type")?.split(";")[0].trim() !==
          "application/json"
        )
          return reply({ code: "INVALID" }, 415);
        if (url.search) throw Error("INVALID");
        const raw = await boundedJson(request, 73728);
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw Error("INVALID");
        body = raw as Record<string, unknown>;
        if (body.operation !== "save") throw Error("INVALID");
      } else {
        if (
          url.search.length > 4096 ||
          [...url.searchParams.keys()].some(
            (k) => url.searchParams.getAll(k).length !== 1,
          )
        )
          throw Error("INVALID");
        body = Object.fromEntries(url.searchParams);
        if (!["context", "read", "history"].includes(String(body.operation)))
          throw Error("INVALID");
        if ("cursor" in body) {
          if (!/^[1-9]\d*$/.test(String(body.cursor))) throw Error("INVALID");
          body.cursor = Number(body.cursor);
        }
      }
      if (["user_id", "case_id", "report_id"].some((k) => k in body))
        throw Error("INVALID");
    } catch (e) {
      return reply(
        {
          code:
            e instanceof Error && e.message === "TOO_LARGE"
              ? "TOO_LARGE"
              : "INVALID",
        },
        e instanceof Error && e.message === "TOO_LARGE" ? 413 : 400,
      );
    }
    const c = parseCommand({
      ...body,
      user_id: user.userId,
      case_id: id,
      report_id: reportId,
    });
    if (!c) return reply({ code: "INVALID" }, 400);
    try {
      const config = deps.config();
      if (!config || !/^[\x21-\x7E]+$/.test(config.token)) throw Error();
      const base = new URL(config.baseUrl);
      if (
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        (base.protocol !== "https:" &&
          !(
            base.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
          ))
      )
        throw Error();
      const r = await (deps.fetch ?? fetch)(
        `${base.href.replace(/\/$/, "")}/api/v2/review-decisions`,
        {
          method: "POST",
          body: JSON.stringify(c),
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!r.ok) {
        const raw = (await boundedJson(r, 2048)) as { code?: string };
        const known: Record<number, string[]> = {
          400: ["INVALID"],
          404: ["UNAVAILABLE", "NOT_FOUND"],
          409: ["CONFLICT", "STALE"],
          413: ["TOO_LARGE"],
        };
        if (
          raw &&
          Object.keys(raw).length === 1 &&
          known[r.status]?.includes(raw.code ?? "")
        )
          return reply(raw, r.status);
        return reply({ code: "UNAVAILABLE" }, 503);
      }
      const v = parseResponse(
        await boundedJson(
          r,
          c.operation === "context"
            ? 524288
            : c.operation === "history"
              ? 32768
              : 131072,
        ),
        c,
      );
      if (!v || ("request_checksum" in v && !(await verifyHashes(v))))
        throw Error();
      return reply(v);
    } catch {
      return reply({ code: "UNAVAILABLE" }, 503);
    }
  }
  return {
    GET: (
      r: Request,
      p: { params: Promise<{ id: string; reportId: string }> },
    ) => handle(r, p, false),
    POST: (
      r: Request,
      p: { params: Promise<{ id: string; reportId: string }> },
    ) => handle(r, p, true),
  };
}
