import {describe, expect, it} from "vitest";
import Ajv2020 from "ajv/dist/2020";
import vectors from "./metric-reading-contracts/fixtures.json";
import schema from "./metric-reading-contracts/reading.schema.json";
import {buildMetricReading, metricArithmeticValid, resolutionNumber} from "./metric-reading";
import {parseView} from "./contracts";
import {checkId, resultView, target} from "./test-fixture";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {createComparisonHandlers} from "./handler";
import type {ComparisonView} from "./types";
const validate = new Ajv2020({strict: false}).compile(schema);
const result = (name: string) => structuredClone(vectors.find(v => v.name === name)!.result) as ComparisonView["result"];
describe("versioned arithmetic reading, not effect calibration", () => {
  it.each(vectors)("matches backend exactly: $name without mutating saved values", v => {
    const r = structuredClone(v.result) as ComparisonView["result"], before = JSON.stringify(r);
    const reading = buildMetricReading(r);
    expect(reading).toEqual(v.reading); expect(validate(reading)).toBe(true);
    expect(JSON.stringify(r)).toBe(before); expect(buildMetricReading(r)).toEqual(reading);
    expect(reading?.effect_conclusion).toBeNull(); expect(reading?.inference_status).toBe("not_calibrated");
    expect(reading?.calibrated_threshold).toBeNull(); expect(reading?.causal_attribution).toBe(false);
    expect(parseView({...resultView(), result: r}, target, checkId)).not.toBeNull();
  });
  it("distinguishes equal growth at different count resolutions, not confidence", () => {
    const low = buildMetricReading(result("one_to_two"))!, high = buildMetricReading(result("hundred_to_two_hundred"))!;
    expect(low.metrics[0]!.relative_step_pp).toBe(100); expect(high.metrics[0]!.relative_step_pp).toBe(1);
    expect(low.metrics[0]!.notes).toContain("ONE_COUNT_DIFFERENCE"); expect(high.metrics[0]!.notes).not.toContain("ONE_COUNT_DIFFERENCE");
    expect(high.inference_status).toBe("not_calibrated");
  });
  it.each([.001, 100 / Number.MAX_SAFE_INTEGER])("never rounds a positive resolution to zero: %s", n => {
    expect(Number(resolutionNumber(n))).toBeGreaterThan(0);
  });
  it.each(["before", "delta", "relative", "ratio", "pp", "unit", "reason", "order", "fraction", "unsafe", "negative", "clicks-over-impressions"])("rejects self-signed inconsistent %s at the gateway", async kind => {
    const r = result("one_to_two");
    if (kind === "before") r.metrics[0].before = null;
    if (kind === "delta") r.metrics[0].absolute_change = 999;
    if (kind === "relative") r.metrics[0].relative_change = null;
    if (kind === "ratio") r.metrics[2].after = .9;
    if (kind === "pp") r.metrics[2].percentage_point_change = 99;
    if (kind === "unit") r.metrics[0].unit = "ratio";
    if (kind === "reason") r.metrics[0].reasons = ["ZERO_BASELINE_NO_RELATIVE_CHANGE"];
    if (kind === "order") r.metrics.reverse();
    if (kind === "fraction") r.metrics[0].before = .5;
    if (kind === "unsafe") r.metrics[0].before = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "negative") r.metrics[0].before = -1;
    if (kind === "clicks-over-impressions") r.metrics[0].before = r.metrics[1].before! + 1;
    const {checksum: _, ...content} = r; r.checksum = canonicalDigest(content);
    expect(metricArithmeticValid(r)).toBe(false); expect(buildMetricReading(r)).toBeNull();
    const view = {...resultView(), result: r}; expect(parseView(view, target, checkId)).toBeNull();
    const h = createComparisonHandlers({enabled: () => true, user: async () => ({userId: "owner"}),
      config: () => ({baseUrl: "https://backend.invalid", token: "test"}), fetch: async () => Response.json(view)});
    const response = await h.GET(new Request(`http://localhost/api/comparisons?deliveryRevisionId=${target.deliveryRevisionId}&comparisonId=${checkId}`), {params: Promise.resolve({id: target.caseId, reportId: target.reportId})});
    expect(response.status).toBe(503); expect(await response.json()).toEqual({code: "UNAVAILABLE"});
  });
});
