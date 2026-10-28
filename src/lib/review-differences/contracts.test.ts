import { describe, it, expect, vi, afterEach } from "vitest";
import fixture from "./contracts/fixture.json";
import { parseReportDifference } from "./contracts";
import { parseReviewReport } from "../review-reports/delivery";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { isReportDifferencesEnabled } from "./config";
const examples = fixture.cases;
afterEach(() => vi.unstubAllEnvs());
describe("saved generated-version comparison", () => {
  it.each(Object.keys(examples) as (keyof typeof examples)[])(
    "validates the Python %s result",
    (key) => {
      const c = structuredClone(examples[key]),
        r = parseReviewReport(c.report);
      expect(parseReportDifference(c.difference, r)).toEqual(c.difference);
    },
  );
  it.each(["report", "owner", "basis", "evidence", "work", "order", "extra"])(
    "rejects rehashed %s tampering",
    (kind) => {
      const { difference: d, report } = structuredClone(examples.updated),
        r = parseReviewReport(report);
      if (kind === "report") d.report_id = d.basis.report_id;
      if (kind === "owner") d.user_id = d.case_id;
      if (kind === "basis") d.basis_action_order = [];
      if (kind === "evidence") d.evidence[0].changed_sections = [];
      if (kind === "work") d.work[0].changed_fields = [];
      if (kind === "order") d.plan_order_changed = !d.plan_order_changed;
      if (kind === "extra") Object.assign(d, { private_reason: "must reject" });
      const { checksum: _, ...body } = d;
      d.checksum = canonicalDigest(body);
      expect(() => parseReportDifference(d, r)).toThrow(
        "REVIEW_DIFFERENCE_INVALID",
      );
    },
  );
  it("does not equate unavailable and absent records, and defaults closed", () => {
    const r = parseReviewReport(examples.baseline.report);
    expect(() => parseReportDifference(null, r)).toThrow();
    for (const k of [
      "V22_CAPABILITY_DISPATCH_ENABLED",
      "V22_REVIEW_DELIVERY_ENABLED",
    ])
      vi.stubEnv(k, "true");
    for (const v of [undefined, "false", "TRUE", "1"]) {
      vi.stubEnv("V22_REVIEW_DIFFERENCES_ENABLED", v);
      expect(isReportDifferencesEnabled()).toBe(false);
    }
    vi.stubEnv("V22_REVIEW_DIFFERENCES_ENABLED", "true");
    expect(isReportDifferencesEnabled()).toBe(true);
    vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED", "false");
    expect(isReportDifferencesEnabled()).toBe(false);
  });
});
