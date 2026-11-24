import {createHmac, timingSafeEqual} from "node:crypto";
import {boundedJson} from "../review-decisions/json";
import {isUuid} from "../prospect-workflow-v22/contracts";
import {validPreflightBranchReceipt} from "./contracts";

interface Dependencies {
  user(): Promise<{userId: string} | null>;
  key(): string | undefined;
  save(input: Record<string, unknown>): PromiseLike<{data: unknown; error: {message: string} | null}>;
  now?(): number;
}

export function readBranchEvidence(token: string, key: string) {
  const parsed = /^([A-Za-z0-9_-]{1,24935})\.([a-f0-9]{64})$/.exec(token);
  if (!parsed) return null;
  const expected = createHmac("sha256", key).update("v22-preflight-branch:" + parsed[1]).digest();
  if (!timingSafeEqual(expected, Buffer.from(parsed[2], "hex"))) return null;
  try {
    const evidence: unknown = JSON.parse(Buffer.from(parsed[1], "base64url").toString("utf-8"));
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;
    return evidence as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createPreflightBranchHandler(deps: Dependencies) {
  return async (request: Request, context: {params: Promise<{id: string}>}) => {
    const reply = (value: object, status = 200) => Response.json(value, {
      status, headers: {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"},
    });
    const error = (code: string, status: number) => reply({error: {code}}, status);
    const url = new URL(request.url);
    const host = request.headers.get("host");
    if (host && /[\s/\\?#@]/.test(host)) return error("FORBIDDEN", 403);
    if (request.headers.get("origin") !== (host ? new URL(url.protocol + "//" + host).origin : url.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site") return error("FORBIDDEN", 403);
    if (url.search || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      return error("GBP_BRANCH_INVALID", 400);
    const user = await deps.user();
    if (!user) return error("UNAUTHORIZED", 401);
    const {id} = await context.params;
    if (!isUuid(id)) return error("GBP_BRANCH_INVALID", 400);

    let body: Record<string, unknown>;
    try {
      const raw = await boundedJson(request, 32000);
      if (typeof raw !== "object" || raw === null || Object.keys(raw).sort().join(",") !==
          "customers_can_visit,evidence_token,operating_mode,reason,request_id") throw Error();
      body = raw as Record<string, unknown>;
    } catch { return error("GBP_BRANCH_INVALID", 400); }

    const {evidence_token, request_id, operating_mode, customers_can_visit, reason} = body;
    if (typeof evidence_token !== "string" || typeof request_id !== "string" || !isUuid(request_id) ||
        typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000 ||
        (operating_mode !== null && (typeof operating_mode !== "string" || !["storefront", "hybrid", "service_area", "meeting_point"].includes(operating_mode))) ||
        typeof customers_can_visit !== "boolean" || (customers_can_visit && operating_mode !== "storefront" && operating_mode !== "hybrid"))
      return error("GBP_BRANCH_INVALID", 400);

    const key = deps.key();
    if (!key) return error("GBP_BRANCH_UNAVAILABLE", 503);
    const evidence = readBranchEvidence(evidence_token, key);
    if (!evidence) return error("GBP_BRANCH_INVALID", 400);
    const issued = Date.parse(String(evidence.observed_at));
    const expires = Date.parse(String(evidence.expires_at));
    const now = deps.now?.() ?? Date.now();
    if (!(issued <= now && now < expires)) return error("GBP_BRANCH_EVIDENCE_EXPIRED", 409);

    try {
      const result = await deps.save({p_user_id: user.userId, p_case_id: id, p_request_id: request_id,
        p_evidence: evidence, p_reason: reason.trim(), p_operating_mode: operating_mode,
        p_customers_can_visit: customers_can_visit});
      if (!result.error && validPreflightBranchReceipt(result.data) && result.data.case_id === id) return reply(result.data);
      const code = result.error?.message;
      if (code === "GBP_BRANCH_UNAVAILABLE") return error(code, 404);
      if (code === "GBP_BRANCH_INVALID") return error(code, 400);
      if (code === "GBP_BRANCH_EVIDENCE_EXPIRED" || code === "GBP_BRANCH_CONFLICT") return error(code, 409);
    } catch {
      return error("GBP_BRANCH_UNAVAILABLE", 503);
    }
    return error("GBP_BRANCH_UNAVAILABLE", 503);
  };
}
