import { v22PublicEntryPausedResponse } from "../release-v22/public-entry";
import { boundedJson } from "../review-decisions/json";
import { uuid } from "../implementation-records/contracts";
import { command, reviewJob, type Command } from "./contracts";
type Deps = {
  enabled(): boolean;
  intakeEnabled(): boolean;
  user(): Promise<{ userId: string } | null>;
  config(): { baseUrl: string; token: string } | null;
  fetch?: typeof fetch;
};
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
};
export function createReviewIntakeHandlers(deps: Deps) {
  const reply = (v: unknown, status = 200) =>
    Response.json(v, { status, headers });
  async function run(
    r: Request,
    ctx: { params: Promise<{ id: string; reportId: string }> },
    write: boolean,
  ) {
    if (!deps.enabled()) return reply({ code: "NOT_FOUND" }, 404);
    const user = await deps.user();
    if (!user) return reply({ code: "UNAUTHORIZED" }, 401);
    const { id, reportId } = await ctx.params;
    if (!uuid(id) || !uuid(reportId)) return reply({ code: "INVALID" }, 400);
    const u = new URL(r.url);
    let c: Command;
    try {
      let raw: unknown;
      if (write) {
        const host = r.headers.get("host");
        if (host && /[\s/\\?#@]/.test(host))
          return reply({ code: "FORBIDDEN" }, 403);
        const origin = host
          ? new URL(`${u.protocol}//${host}`).origin
          : u.origin;
        if (
          r.headers.get("origin") !== origin ||
          r.headers.get("sec-fetch-site") === "cross-site"
        )
          return reply({ code: "FORBIDDEN" }, 403);
        if (
          u.search ||
          r.headers.get("content-type")?.split(";")[0].trim() !==
            "application/json"
        )
          return reply({ code: "INVALID" }, 400);
        raw = await boundedJson(r, 4096);
      } else {
        if (
          u.search.length > 2048 ||
          [...u.searchParams.keys()].some(
            (k) => u.searchParams.getAll(k).length !== 1,
          )
        )
          throw Error();
        raw = Object.fromEntries(u.searchParams);
      }
      if (
        !command(raw) ||
        (write ? raw.operation !== "start" : raw.operation === "start")
      )
        throw Error();
      c = raw;
    } catch {
      return reply({ code: "INVALID" }, 400);
    }
    // A pause blocks only new logical analyses. A previously committed request
    // is recovered by an owner-scoped READ and must never be submitted as start.
    const recoverOnly = c.operation === "start" && !deps.intakeEnabled();
    const upstream: Command =
      recoverOnly && c.operation === "start"
        ? { operation: "status", job_id: c.selection.job_id }
        : c;
    try {
      const conf = deps.config();
      if (
        !conf ||
        !/[\x21-\x7e]+/.test(conf.token) ||
        /[^\x21-\x7e]/.test(conf.token)
      )
        throw Error();
      const base = new URL(conf.baseUrl);
      if (
        base.username ||
        base.password ||
        base.hash ||
        base.search ||
        (base.protocol !== "https:" &&
          !(
            base.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
          ))
      )
        throw Error();
      const res = await (deps.fetch ?? fetch)(
        `${base.href.replace(/\/$/, "")}/api/v2/review-generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${conf.token}`,
          },
          body: JSON.stringify({
            ...upstream,
            user_id: user.userId,
            case_id: id,
            report_id: reportId,
          }),
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(60000),
        },
      );
      const value = await boundedJson(res, res.ok ? 16384 : 2048);
      if (!res.ok) {
        const v = value as { code?: string };
        const codes: Record<number, string[]> = {
          400: ["INVALID"],
          402: ["INSUFFICIENT_CREDITS"],
          404: ["NOT_FOUND", "UNAVAILABLE"],
          409: ["CONFLICT", "STALE", "BUSY"],
          413: ["TOO_LARGE"],
        };
        if (
          v &&
          Object.keys(v).length === 1 &&
          codes[res.status]?.includes(v.code ?? "")
        )
          return reply(v, res.status);
        throw Error();
      }
      if (value === null && recoverOnly) return v22PublicEntryPausedResponse();
      if (value === null && c.operation !== "start") return reply(null);
      if (!reviewJob(value, { ownerId: user.userId, caseId: id, reportId }, c))
        throw Error();
      return reply(value);
    } catch {
      return reply({ code: "UNAVAILABLE" }, 503);
    }
  }
  return {
    GET: (
      r: Request,
      c: { params: Promise<{ id: string; reportId: string }> },
    ) => run(r, c, false),
    POST: (
      r: Request,
      c: { params: Promise<{ id: string; reportId: string }> },
    ) => run(r, c, true),
  };
}
