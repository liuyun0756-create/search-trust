import { uuid } from "../implementation-records/contracts";
import { parseCommand, parseResponse } from "./contracts";

type Dependencies = {
  enabled: () => boolean;
  user: () => Promise<{ userId: string } | null>;
  config: () => { baseUrl: string; token: string } | null;
  fetch?: typeof fetch;
};
type Route = { params: Promise<{ id: string; reportId: string }> };
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function boundedJson(
  message: Request | Response,
  limit: number,
): Promise<unknown> {
  const reader = message.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export function createReviewWorkspaceHandlers(deps: Dependencies) {
  async function handle(request: Request, route: Route, write: boolean) {
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
        if (url.search) return reply({ code: "INVALID" }, 400);
        const raw = await boundedJson(request, 48 * 1024);
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new Error("invalid");
        body = raw as Record<string, unknown>;
        if (!["preview", "save"].includes(String(body.operation)))
          throw new Error("invalid");
      } else {
        if (
          url.search.length > 4096 ||
          [...new Set(url.searchParams.keys())].some(
            (k) => url.searchParams.getAll(k).length !== 1,
          )
        )
          throw new Error("invalid");
        body = Object.fromEntries(url.searchParams);
        if (
          ![
            "context",
            "candidates",
            "source",
            "versions",
            "history",
            "read",
          ].includes(String(body.operation))
        )
          throw new Error("invalid");
        for (const key of ["target", "cursor"])
          if (key in body) body[key] = JSON.parse(String(body[key]));
      }
      if (["user_id", "case_id", "report_id"].some((k) => k in body))
        throw new Error("invalid");
    } catch (error) {
      return reply(
        {
          code:
            error instanceof Error && error.message === "large"
              ? "TOO_LARGE"
              : "INVALID",
        },
        error instanceof Error && error.message === "large" ? 413 : 400,
      );
    }
    const command = parseCommand({
      ...body,
      user_id: user.userId,
      case_id: id,
      report_id: reportId,
    });
    if (!command) return reply({ code: "INVALID" }, 400);
    try {
      const config = deps.config();
      if (!config || !/^[\x21-\x7E]+$/.test(config.token))
        throw new Error("config");
      const base = new URL(config.baseUrl);
      if (
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        (base.protocol !== "https:" &&
          !(
            base.protocol === "http:" &&
            ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
          ))
      )
        throw new Error("config");
      const response = await (deps.fetch ?? fetch)(
        `${base.href.replace(/\/$/, "")}/api/v2/review-evidence`,
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(command),
        },
      );
      if (!response.ok) {
        const raw = (await boundedJson(response, 2048)) as { code?: string };
        const expected: Record<number, string[]> = {
          400: ["INVALID"],
          404: ["UNAVAILABLE", "NOT_FOUND"],
          409: ["CONFLICT", "STALE"],
          413: ["TOO_LARGE"],
        };
        if (
          raw &&
          Object.keys(raw).length === 1 &&
          expected[response.status]?.includes(raw.code ?? "")
        )
          return reply({ code: raw.code }, response.status);
        return reply({ code: "UNAVAILABLE" }, 503);
      }
      const raw = await boundedJson(response, 512 * 1024),
        parsed = parseResponse(raw, command);
      return parsed ? reply(parsed) : reply({ code: "UNAVAILABLE" }, 503);
    } catch {
      return reply({ code: "UNAVAILABLE" }, 503);
    }
  }
  return {
    GET: (request: Request, route: Route) => handle(request, route, false),
    POST: (request: Request, route: Route) => handle(request, route, true),
  };
}
