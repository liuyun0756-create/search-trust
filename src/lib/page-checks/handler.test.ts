import {describe, it, expect, vi} from "vitest";
import {createPageCheckHandlers} from "./handler";
import {owner, target, checkId, pageContext, pageSelection, pageView} from "./test-fixture";
import {parsePageContext, parsePageRate, parsePageSelection, parsePageView} from "./contracts";
import {parsePendingPageCheck, pendingPageKey} from "./pending";
import {isPageChecksEnabled} from "./config";

const url = `https://app.test/api/v2/cases/${target.caseId}/reports/${target.reportId}/page-checks?deliveryRevisionId=${target.deliveryRevisionId}`;
const route = {params: Promise.resolve({id: target.caseId, reportId: target.reportId})};
const options = {enabled: () => true, user: async () => ({userId: owner}), config: () => ({baseUrl: "https://backend.test", token: "test"})};
const request = () => new Request(url, {method: "POST", headers: {origin: "https://app.test", "Content-Type": "application/json"}, body: JSON.stringify({checkId, selection: pageSelection})});
describe("page check owner boundary", () => {
  it("separates read from request and injects authenticated owner", async () => {
    const calls: Record<string, unknown>[] = [];
    const h = createPageCheckHandlers({...options, fetch: async (endpoint, init) => {
      expect(endpoint).toBe("https://backend.test/api/v2/page-checks"); expect(init?.redirect).toBe("error");
      const c = JSON.parse(init!.body as string); calls.push(c); return Response.json(c.operation === "context" ? pageContext : pageView());
    }});
    expect((await h.GET(new Request(url), route)).status).toBe(200);
    const response = await h.POST(request(), route); expect(response.status).toBe(200);
    expect((await h.GET(new Request(`${url}&checkId=${checkId}`), route)).status).toBe(200);
    expect(calls.map(c => c.operation)).toEqual(["context", "request", "read"]);
    expect(calls[1]).toMatchObject({user_id: owner, check_id: checkId, selection: pageSelection});
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["disabled", "signed_out", "cross_origin", "cross_site", "spoofed_owner", "duplicate_query", "unknown_query", "wrong_type", "large"])("rejects %s before backend", async kind => {
    const backend = vi.fn(); let req = request();
    if (kind === "cross_origin") req.headers.set("origin", "https://evil.test");
    if (kind === "cross_site") req.headers.set("sec-fetch-site", "cross-site");
    if (kind === "wrong_type") req.headers.set("content-type", "text/plain");
    if (kind === "spoofed_owner" || kind === "large") req = new Request(url, {method: "POST", headers: req.headers, body: kind === "large" ? "x".repeat(24577) : JSON.stringify({checkId, selection: pageSelection, user_id: owner})});
    if (kind === "duplicate_query" || kind === "unknown_query") req = new Request(`${url}&${kind === "duplicate_query" ? "deliveryRevisionId" : "extra"}=${checkId}`, {method: "POST", headers: req.headers, body: await req.text()});
    const h = createPageCheckHandlers({...options, enabled: () => kind !== "disabled", user: async () => kind === "signed_out" ? null : {userId: owner}, fetch: backend});
    expect((await h.POST(req, route)).status).toBeGreaterThanOrEqual(400); expect(backend).not.toHaveBeenCalled();
  });
  it.each(["active", "cooldown", "quota"] as const)("preserves bounded %s rate response", async reason => {
    const rate = {code: "PAGE_CHECK_RATE_LIMIT", limits: {...pageContext.limits, used: reason === "quota" ? 10 : 1, active: reason === "active", next_request_at: "2026-10-27T01:00:00Z", reason}};
    expect(parsePageRate(rate)).toBeTruthy();
    const h = createPageCheckHandlers({...options, fetch: async () => Response.json(rate, {status: 429})});
    const r = await h.POST(request(), route); expect(r.status).toBe(429); expect(await r.json()).toEqual(rate);
  });
  it.each(["rate_extra", "rate_invalid", "rate_large", "view_extra", "foreign_report", "invalid_state", "wrong_result", "bad_time", "wrong_selection", "large"])("rejects unsafe %s output", async kind => {
    let body: unknown = pageView(checkId, "completed"), status = 200;
    if (kind.startsWith("rate")) {body = {code: "PAGE_CHECK_RATE_LIMIT", limits: {...pageContext.limits, reason: "cooldown"}}; status = 429;}
    if (kind === "rate_extra") Object.assign(body as object, {private: "secret"});
    if (kind === "rate_large" || kind === "large") body = {secret: "x".repeat(150000)};
    if (kind === "view_extra") Object.assign(body as object, {lease_id: checkId});
    if (kind === "foreign_report") Object.assign(body as object, {report_id: checkId});
    if (kind === "invalid_state") Object.assign(body as object, {status: "queued"});
    if (kind === "wrong_result") (body as ReturnType<typeof pageView>).observation!.results[0].condition_id = "unknown";
    if (kind === "bad_time") (body as ReturnType<typeof pageView>).observation!.observed_at = "2026-10-28T01:00:00Z";
    if (kind === "wrong_selection") (body as ReturnType<typeof pageView>).selection.action_id = "other";
    const h = createPageCheckHandlers({...options, fetch: async () => Response.json(body, {status})});
    const r = await h.POST(request(), route); expect(r.status).toBe(503); expect(await r.text()).not.toContain("secret");
  });
  it.each(["http://service.example.com/a", "https://service.example.com/a?q=x", "https://user:pass@service.example.com/a", "https://service.example.com/a/../b", "https://service.example.com/%2e%2e/b", "https://service.example.com/%0a", "https://127.0.0.1/a", "https://other.example.com/a"])("rejects unsupported target %s", target_url => {
    expect(parsePageSelection({...pageSelection, target_url}, pageContext.site_url)).toBeNull();
  });
  it("checks conditions, histories and stale context without hiding authorized history", () => {
    expect(parsePageSelection({...pageSelection, conditions: [...pageSelection.conditions, ...pageSelection.conditions]})).toBeNull();
    expect(parsePageSelection({...pageSelection, conditions: [{id: "a", kind: "link_present", value: "https://other.example.com/a"}]})).toBeNull();
    expect(parsePageContext({...pageContext, eligibility: "source_changed"}, target)).toBeTruthy();
    const view = pageView(); const {schema_version, selection, observation, site_url, delivery_revision, ...history} = view;
    expect(parsePageContext({...pageContext, history: [history, history]}, target)).toBeNull();
    expect(parsePageView(pageView(checkId, "completed"), target, checkId)).toBeTruthy();
  });
  it("isolates minimal recovery IDs by account, Case, report and delivery", () => {
    const pending = {version: 1, checkId, selection: pageSelection};
    expect(parsePendingPageCheck(JSON.stringify(pending))).toEqual(pending);
    expect(parsePendingPageCheck(JSON.stringify({...pending, token: "secret"}))).toBeNull();
    const key = pendingPageKey(owner, target);
    expect(pendingPageKey(checkId, target)).not.toBe(key);
    for (const field of ["caseId", "reportId", "deliveryRevisionId"] as const) expect(pendingPageKey(owner, {...target, [field]: checkId})).not.toBe(key);
  });
  it("is default-off and independent of Google comparisons", () => {
    vi.stubEnv("V22_PAGE_CHECKS_ENABLED", ""); expect(isPageChecksEnabled()).toBe(false);
    vi.stubEnv("V22_PAGE_CHECKS_ENABLED", "true"); vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "true"); vi.stubEnv("V22_IMPLEMENTATION_RECORDS_ENABLED", "true");
    vi.stubEnv("V22_COMPARISONS_ENABLED", "false"); expect(isPageChecksEnabled()).toBe(true);
    vi.stubEnv("V22_IMPLEMENTATION_RECORDS_ENABLED", "false"); expect(isPageChecksEnabled()).toBe(false); vi.unstubAllEnvs();
  });
});
