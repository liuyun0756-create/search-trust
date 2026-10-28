import {describe, it, expect, vi} from "vitest";
import {createComparisonHandlers} from "./handler";
import {parseContext, parseSelection, parseView} from "./contracts";
import {record, target, context as catalogue, checkId, selection, resultView} from "./test-fixture";
import {isComparisonChecksEnabled} from "./config";
const route = {params: Promise.resolve({id: target.caseId, reportId: target.reportId})};
const url = `http://localhost/api/comparisons?deliveryRevisionId=${target.deliveryRevisionId}`;
function setup() {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(resultView()));
  const deps = {enabled: () => true, user: async (): Promise<{userId: string} | null> => ({userId: record.user_id}),
    config: () => ({baseUrl: "https://backend.invalid", token: "internal-test"}), fetch: fetcher};
  return {fetcher, deps};
}
const post = (body: unknown = {comparisonId: checkId, selection}, headers = {}) => new Request(url, {method: "POST",
  headers: {origin: "http://localhost", "content-type": "application/json", ...headers}, body: typeof body === "string" ? body : JSON.stringify(body)});
describe("free comparison entry gateway", () => {
  it("requires all opt-in flags", () => {
    try {for (const key of ["V22_COMPARISONS_ENABLED", "V22_IMPLEMENTATION_RECORDS_ENABLED", "V22_CAPABILITY_DISPATCH_ENABLED"]) vi.stubEnv(key, "true");
      expect(isComparisonChecksEnabled()).toBe(true);
      for (const key of ["V22_COMPARISONS_ENABLED", "V22_IMPLEMENTATION_RECORDS_ENABLED", "V22_CAPABILITY_DISPATCH_ENABLED"]) {vi.stubEnv(key, "false"); expect(isComparisonChecksEnabled()).toBe(false); vi.stubEnv(key, "true");}
    } finally {vi.unstubAllEnvs();}
  });
  it("derives ownership, validates response digest and returns only owner projection", async () => {
    const {deps, fetcher} = setup(); const response = await createComparisonHandlers(deps).POST(post(), route);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(resultView());
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({operation: "freeze", user_id: record.user_id,
      case_id: target.caseId, report_id: target.reportId, delivery_revision_id: target.deliveryRevisionId, comparison_id: checkId, selection});
    expect(fetcher.mock.calls[0][1]!.redirect).toBe("error");
  });
  it("loads context and a frozen check through read operations", async () => {
    const {deps, fetcher} = setup(); fetcher.mockResolvedValueOnce(Response.json(catalogue));
    expect((await createComparisonHandlers(deps).GET(new Request(url), route)).status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).operation).toBe("context");
    expect((await createComparisonHandlers(deps).GET(new Request(`${url}&comparisonId=${checkId}`), route)).status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).operation).toBe("read");
  });
  it.each(["off", "no-user", "origin", "cross-site", "type", "large", "extra", "source-body", "shape", "query"])("rejects %s before upstream", async kind => {
    const {deps, fetcher} = setup(); let req = post();
    if (kind === "off") deps.enabled = () => false;
    if (kind === "no-user") deps.user = async () => null;
    if (kind === "origin") req = post(undefined, {origin: "https://other.invalid"});
    if (kind === "cross-site") req = post(undefined, {"sec-fetch-site": "cross-site"});
    if (kind === "type") req = post(undefined, {"content-type": "text/plain"});
    if (kind === "large") req = post("x".repeat(20001));
    if (kind === "extra") req = post({comparisonId: checkId, selection, user_id: record.user_id});
    if (kind === "source-body") req = post({comparisonId: checkId, selection: {...selection, before: {}}});
    if (kind === "shape") req = post({comparisonId: checkId, selection: {...selection, scope: {...selection.scope, key: "wrong"}}});
    if (kind === "query") req = new Request(`${url}&deliveryRevisionId=${target.deliveryRevisionId}`, req);
    expect((await createComparisonHandlers(deps).POST(req, route)).status).toBe({off:404,"no-user":401,origin:403,"cross-site":403,type:415,large:413,extra:400,"source-body":400,shape:400,query:400}[kind]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["checksum", "identity", "id", "effect", "source", "large", "failure"])("withholds %s response details", async kind => {
    const {deps, fetcher} = setup(), value = structuredClone(resultView());
    if (kind === "checksum") value.result.metrics[0].after = 999;
    if (kind === "identity") value.report_id = checkId;
    if (kind === "id") value.id = record.id;
    if (kind === "effect") Object.assign(value.result, {effect_conclusion: "effective"});
    if (kind === "source") value.result.before_source!.snapshot_id = checkId;
    fetcher.mockResolvedValue(kind === "large" ? new Response("x".repeat(150001)) : kind === "failure" ? new Response("SECRET", {status: 500}) : Response.json(value));
    const response = await createComparisonHandlers(deps).POST(post(), route);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({code:"UNAVAILABLE"});
  });
  it.each([404,409,429])("sanitizes upstream %s", async status => {
    const {deps, fetcher} = setup(); fetcher.mockResolvedValue(new Response("secret", {status}));
    const res = await createComparisonHandlers(deps).POST(post(), route);
    expect(res.status).toBe(status === 429 ? 503 : status); expect(await res.text()).not.toContain("secret");
  });
  it.each(["http://remote.invalid", "https://u:p@backend.invalid", "https://backend.invalid?secret=yes"])("rejects unsafe base %s", async baseUrl => {
    const {deps, fetcher} = setup(); deps.config = () => ({baseUrl, token:"test"});
    expect((await createComparisonHandlers(deps).POST(post(), route)).status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
  });
  it("validates every shared vector and rejects extra private fields", () => {
    for (const name of ["positive", "negative", "unchanged", "zero_baseline", "missing_date", "page_unaligned", "source_changed", "waiting", "ga4_all", "ga4_organic"]) expect(parseView(resultView(name), target, checkId)).not.toBeNull();
    expect(parseContext(catalogue, target)).not.toBeNull(); expect(parseSelection(selection)).not.toBeNull();
    expect(parseContext({...catalogue, raw_payload:{}}, target)).toBeNull();
    expect(parseView({...resultView(), request:{}}, target, checkId)).toBeNull();
  });
});
