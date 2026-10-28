import {afterEach, describe, expect, it, vi} from "vitest";
import {parseSessionReading, relativePercent} from "./contracts";
import {createGa4SessionHandler} from "./handler";
import {isGa4SessionReadingEnabled} from "./config";
import {reading, readingJob, target} from "./test-fixture";

const data = reading(), route = {params: Promise.resolve({id: target.caseId, reportId: target.reportId})};
const url = `https://app.test/api/v2/cases/${target.caseId}/reports/${target.reportId}/ga4-session-readings?deliveryRevisionId=${target.deliveryRevisionId}&collectionId=${data.collection_id}`;
const options = {enabled: () => true, user: async () => ({userId: data.user_id}), config: () => ({baseUrl: "https://backend.test", token: "test"})};
afterEach(() => vi.unstubAllEnvs());
describe("saved session contract and reads", () => {
  it("accepts exact exported result bound to its observation", () => {
    expect(parseSessionReading(data, target, data.collection_id, readingJob())).toEqual(data);
  });
  it.each([[0,0,null], [0,10,null], [20000,20001,"0.01"], [20000,19999,"-0.01"], [3,1,"-66.67"],
    [9007199254740991,9007199254740990,"0.00"], [1,9007199254740991,"900719925474099000.00"]] as const)("exact percent %s / %s", (b,a,p) => expect(relativePercent(b,a)).toBe(p));
  it.each(["owner", "case", "report", "delivery", "collection", "extra", "percent", "unsafe", "negative", "difference", "state", "duplicate_reason", "invented_reason", "dates", "zone", "host", "path", "finality", "effect", "causal", "time", "not_elapsed"])("rejects invalid %s", async kind => {
    const r: any = reading();
    if (kind === "owner") r.user_id = r.collection_id;
    if (kind === "case") r.case_id = r.collection_id;
    if (kind === "report") r.report_id = r.collection_id;
    if (kind === "delivery") r.delivery_revision_id = r.collection_id;
    if (kind === "collection") r.collection_id = r.case_id;
    if (kind === "extra") r.comparisons_available = true;
    if (kind === "percent") r.relative_change_percent = "25.01";
    if (kind === "unsafe") r.before = Number.MAX_SAFE_INTEGER+1;
    if (kind === "negative") r.after = -1;
    if (kind === "difference") r.difference = 2;
    if (kind === "state") r.state = "withheld";
    if (kind === "duplicate_reason") r.reasons = ["SAMPLED", "SAMPLED"];
    if (kind === "invented_reason") r.reasons = ["TRUST_ME"];
    if (kind === "dates") r.windows.before.end = r.windows.before.start;
    if (kind === "zone") r.scope.timezone = "Fake/Zone";
    if (kind === "host") r.scope.hosts = ["https://host.test"];
    if (kind === "path") r.scope.landing_path = "https://host.test/";
    if (kind === "finality") r.processing_completeness = "complete";
    if (kind === "effect") r.effect = "improved";
    if (kind === "causal") r.causal_attribution = true;
    if (kind === "time") r.started_at = "2027-01-01T00:00:00Z";
    if (kind === "not_elapsed") r.started_at = `${r.windows.after.end}T00:00:00Z`;
    const h = createGa4SessionHandler({...options, fetch: async () => Response.json(r)});
    expect((await h(new Request(url), route)).status).toBe(503);
  });
  it.each(["digest", "implementation", "action", "scope", "window"])("UI rejects source mismatch %s", kind => {
    const j = readingJob();
    if (kind === "digest") j.qualification.observation_checksum = `sha256:${"0".repeat(64)}`;
    if (kind === "implementation") j.selection.implementation.revision++;
    if (kind === "action") j.selection.action_id = "another";
    if (kind === "scope") j.scope.hosts = ["other.test"];
    if (kind === "window") j.windows.before.start = "2026-08-05";
    expect(parseSessionReading(reading(), target, data.collection_id, j)).toBeNull();
  });
  it("only reads with server-owned identity and prevents caching", async () => {
    const upstream = vi.fn(async (_url, init) => {
      expect(_url).toBe("https://backend.test/api/v2/ga4-session-readings");
      expect(JSON.parse(init.body)).toEqual({user_id: data.user_id, case_id: data.case_id, report_id: data.report_id, delivery_revision_id: data.delivery_revision_id, collection_id: data.collection_id});
      expect(init.redirect).toBe("error"); expect(init.cache).toBe("no-store");
      return Response.json(data);
    });
    const h = createGa4SessionHandler({...options, fetch: upstream});
    const r = await h(new Request(url), route); expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store"); expect(r.headers.get("vary")).toBe("Cookie");
    await h(new Request(url), route); expect(upstream).toHaveBeenCalledTimes(2);
  });
  it.each(["flag", "auth", "method", "duplicate", "unknown", "missing", "cross_site"])("rejects %s without upstream", async kind => {
    const upstream = vi.fn(); let request = new Request(url);
    if (kind === "method") request = new Request(url, {method: "POST"});
    if (kind === "duplicate") request = new Request(url+`&collectionId=${data.collection_id}`);
    if (kind === "unknown") request = new Request(url+`&user_id=${data.user_id}`);
    if (kind === "missing") request = new Request(url.split("?")[0]);
    if (kind === "cross_site") request.headers.set("sec-fetch-site", "cross-site");
    const h = createGa4SessionHandler({...options, enabled: () => kind !== "flag", user: async () => kind === "auth" ? null : {userId: data.user_id}, fetch: upstream});
    expect((await h(request, route)).status).toBeGreaterThanOrEqual(400); expect(upstream).not.toHaveBeenCalled();
  });
  it.each([404,409,500])("safe upstream error %s", async status => {
    const h = createGa4SessionHandler({...options, fetch: async () => new Response("private upstream", {status})});
    const r = await h(new Request(url), route); expect(r.status).toBe(status === 500 ? 503 : status);
    expect(await r.text()).not.toContain("private upstream");
  });
  it("bounds the response and refuses unsafe upstream addresses", async () => {
    const h = createGa4SessionHandler({...options, fetch: async () => new Response("x".repeat(32001))});
    expect((await h(new Request(url), route)).status).toBe(503);
    const upstream = vi.fn();
    const invalid = createGa4SessionHandler({...options, config: () => ({baseUrl: "http://example.com", token: "test"}), fetch: upstream});
    expect((await invalid(new Request(url), route)).status).toBe(503); expect(upstream).not.toHaveBeenCalled();
  });
  it("all gates are required and default off", () => {
    const flags = ["V22_CAPABILITY_DISPATCH_ENABLED", "V22_IMPLEMENTATION_RECORDS_ENABLED", "V22_COMPARISONS_ENABLED", "V22_GA4_COMPARISON_COLLECTIONS_ENABLED", "V22_GA4_SESSION_SNAPSHOT_READING_ENABLED"];
    flags.forEach(f => vi.stubEnv(f, undefined)); expect(isGa4SessionReadingEnabled()).toBe(false);
    flags.forEach(f => vi.stubEnv(f, "true")); expect(isGa4SessionReadingEnabled()).toBe(true);
    for (const f of flags) {vi.stubEnv(f,"false"); expect(isGa4SessionReadingEnabled()).toBe(false); vi.stubEnv(f,"true");}
  });
});
