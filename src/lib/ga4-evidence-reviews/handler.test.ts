import {describe, it, expect, vi} from "vitest";
import {createGa4ReviewHandlers} from "./handler";
import {parseReviewInput, parseReviewView} from "./contracts";
import {reviewView, reviewRecord, input} from "./test-fixture";
import {record, target} from "../comparison-checks/test-fixture";
import {ga4Id} from "../ga4-comparison-collections/test-fixture";
import {canonicalDigest} from "../verified-analysis-v22/digest";
const url = `https://app.test/api/v2/cases/${target.caseId}/reports/${target.reportId}/ga4-evidence-reviews?deliveryRevisionId=${target.deliveryRevisionId}&collectionId=${ga4Id}`;
const route = {params: Promise.resolve({id: target.caseId, reportId: target.reportId})};
const options = {enabled: () => true, user: async () => ({userId: record.user_id}), config: () => ({baseUrl: "https://backend.test", token: "test"})};
const request = (value: unknown = input()) => new Request(url, {method: "POST", headers: {origin: "https://app.test", "Content-Type": "application/json"}, body: JSON.stringify(value)});
describe("independent GA4 SEO evidence review", () => {
  it("authenticates ownership and preserves distinct system/manual evidence", async () => {
    const calls: any[] = [];
    const h = createGa4ReviewHandlers({...options, fetch: async (url, init) => {
      expect(url).toBe("https://backend.test/api/v2/ga4-evidence-reviews");
      const c = JSON.parse(init!.body as string); calls.push(c); const view = reviewView();
      if (c.operation === "save") {view.saved = reviewRecord(c.review); view.reviews = [view.saved];}
      return Response.json(view);
    }});
    expect((await h.GET(new Request(url), route)).status).toBe(200);
    const response = await h.POST(request(), route); expect(response.status).toBe(200);
    const value = await response.json(); expect(value.saved.source).toBe("seo_recorded");
    expect(value.audit.comparisons_available).toBe(false); expect(value.audit.event_history).toBe("unverified");
    expect(calls.map(c => c.operation)).toEqual(["read", "save"]); expect(calls[1].user_id).toBe(record.user_id);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["disabled", "signed_out", "origin", "extra", "basis", "too_large", "duplicate_query"])("rejects %s before upstream", async kind => {
    const backend = vi.fn(); let req = request();
    if (kind === "origin") req.headers.set("origin", "https://other.test");
    if (kind === "extra") req = request({...input(), user_id: record.user_id});
    if (kind === "basis") {const value = input(); value.checks.event_history.status = "no_issue_found"; req = request(value);}
    if (kind === "too_large") req = request({...input(), extra: "x".repeat(20000)});
    if (kind === "duplicate_query") req = new Request(`${url}&collectionId=${ga4Id}`);
    const h = createGa4ReviewHandlers({...options, enabled: () => kind !== "disabled", user: async () => kind === "signed_out" ? null : {userId: record.user_id}, fetch: backend});
    expect((await h.POST(req, route)).status).toBeGreaterThanOrEqual(400); expect(backend).not.toHaveBeenCalled();
  });
  it.each(["owner", "report", "collection", "digest", "promoted", "missing_dates", "missing_check", "reordered", "old_truncation", "receipt", "history"])("rejects invalid %s", async kind => {
    const value = reviewView(); value.saved = reviewRecord(); value.reviews = [structuredClone(value.saved)];
    if (kind === "owner") {for (const r of [value.saved, ...value.reviews]) {r.user_id = ga4Id; const {checksum, ...body} = r; r.checksum = canonicalDigest(body);}}
    if (kind === "report") value.report_id = ga4Id;
    if (kind === "collection") value.audit.collection_id = target.caseId;
    if (kind === "digest") value.saved.checksum = `sha256:${"0".repeat(64)}`;
    if (kind === "promoted") Object.assign(value.audit, {comparisons_available: true});
    if (kind === "missing_dates") value.audit.coverage[0].missing_dates.push("2026-01-01");
    if (kind === "missing_check") value.audit.views.pop();
    if (kind === "reordered") value.audit.views.reverse();
    if (kind === "old_truncation") value.audit.views[0].truncation_reasons.push({type: "UNKNOWN", before_date: null, date_ranges: []});
    if (kind === "receipt") value.saved.request_id = ga4Id;
    if (kind === "history") value.reviews = [];
    const h = createGa4ReviewHandlers({...options, fetch: async () => Response.json(value)});
    expect((await h.POST(request(), route)).status).toBe(503);
  });
  it("accepts old save receipt without replacing the newest review", () => {
    const value = reviewView(), first = reviewRecord(), second = reviewRecord({...input(), request_id: ga4Id, expected_revision: 1});
    value.reviews = [second, first]; value.saved = first;
    expect(parseReviewView(value, target, ga4Id, input())).toBeTruthy();
    expect(parseReviewInput({...input(), checks: {...input().checks, event_history: {status: "verified", note: "yes"}}})).toBeNull();
  });
  it.each([404, 409, 500])("maps safe upstream error %s", async status => {
    const h = createGa4ReviewHandlers({...options, fetch: async () => new Response("private details", {status})});
    const result = await h.POST(request(), route); expect(result.status).toBe(status === 500 ? 503 : status);
    expect(await result.text()).not.toContain("private details");
  });
});
