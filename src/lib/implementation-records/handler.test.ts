import {describe, expect, it, vi} from "vitest";
import fixture from "./contracts/fixture.json";
import {createImplementationHandlers} from "./handler";
import {ImplementationError} from "./repository";
import type {ImplementationView} from "./contracts";
vi.mock("server-only", () => ({}));
const {source} = fixture;
const context = {params: Promise.resolve({id: source.caseId, reportId: source.reportId})};
const url = `http://localhost/api/v2/cases/${source.caseId}/reports/${source.reportId}/implementation?deliveryRevisionId=${source.deliveryRevisionId}`;
function setup() {
  const repo = {read: vi.fn(async (): Promise<ImplementationView> => ({source, history: []})), save: vi.fn(async (): Promise<ImplementationView> => ({source, history: fixture.history as ImplementationView["history"]}))};
  return {repo, deps: {enabled: () => true, user: async (): Promise<{userId: string} | null> => ({userId: source.userId}), repository: () => repo}};
}
function put(body: unknown = {expectedRevision: 0, entries: fixture.history[0].entries}, headers: Record<string, string> = {}) {
  return new Request(url, {method: "PUT", headers: {origin: "http://localhost", "content-type": "application/json", ...headers}, body: typeof body === "string" ? body : JSON.stringify(body)});
}
describe("private free implementation-record endpoint", () => {
  it("uses authenticated ownership, a pinned revision and no-store responses", async () => {
    const {repo, deps} = setup(), handlers = createImplementationHandlers(deps);
    const response = await handlers.GET(new Request(url), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(repo.read).toHaveBeenCalledWith(source.userId, source.caseId, source.reportId, source.deliveryRevisionId);
    expect(repo.save).not.toHaveBeenCalled();
    expect((await handlers.PUT(put(), context)).status).toBe(200);
    expect(repo.save).toHaveBeenCalledWith(source.userId, source.caseId, source.reportId, source.deliveryRevisionId, 0, fixture.history[0].entries);
  });
  it.each(["disabled", "signed-out", "origin", "cross-site", "oversize", "extra", "invalid-json", "content-type", "revision"])("rejects %s before persistence", async kind => {
    const {repo, deps} = setup();
    if (kind === "disabled") deps.enabled = () => false;
    if (kind === "signed-out") deps.user = async () => null;
    const request = kind === "origin" ? put(undefined, {origin: "https://other.test"}) : kind === "cross-site" ? put(undefined, {"sec-fetch-site": "cross-site"})
      : kind === "oversize" ? put("x".repeat(40001)) : kind === "extra" ? put({expectedRevision: 0, entries: [], userId: source.userId})
      : kind === "invalid-json" ? put("{") : kind === "content-type" ? put(undefined, {"content-type": "text/plain"})
      : kind === "revision" ? new Request(url.replace(source.deliveryRevisionId, "bad")) : put();
    expect((await createImplementationHandlers(deps).PUT(request, context)).status).toBe({disabled: 404, "signed-out": 401, origin: 403, "cross-site": 403, oversize: 413, extra: 400, "invalid-json": 400, "content-type": 415, revision: 404}[kind]);
    expect(repo.save).not.toHaveBeenCalled(); expect(repo.read).not.toHaveBeenCalled();
  });
  it.each(["NOT_FOUND", "INVALID", "CONFLICT", "UNAVAILABLE"] as const)("maps safe %s errors without database details", async code => {
    const {deps, repo} = setup(); repo.save.mockRejectedValue(new ImplementationError(code));
    const response = await createImplementationHandlers(deps).PUT(put(), context);
    expect(response.status).toBe({NOT_FOUND: 404, INVALID: 400, CONFLICT: 409, UNAVAILABLE: 503}[code]);
    expect(await response.json()).toEqual({error: {code}});
  });
});
