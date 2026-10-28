import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import schema from "./contracts/schema.json";
import fixtures from "./contracts/fixtures.json";
import type { ActionFacts } from "../review-reports/types";
import { buildMetricReviewGuidance } from "./build";
const cases = fixtures.cases;
const valid = new Ajv2020({ strict: false }).compile(schema);
describe("metric review guidance", () => {
  for (const [name, v] of Object.entries(cases))
    it(`matches the independent reference: ${name}`, () => {
      const facts = structuredClone(v.facts) as unknown as ActionFacts,
        before = JSON.stringify(facts);
      const result = buildMetricReviewGuidance(facts);
      expect(result).toEqual(v.guide);
      expect(valid(result)).toBe(true);
      expect(JSON.stringify(facts)).toBe(before);
    });
  for (const mutation of [
    "counts",
    "delta",
    "ratio",
    "blocked_counts",
    "ga4_delta",
    "ga4_percent",
    "blocked_sessions",
    "source",
    "channel",
  ])
    it(`rejects inconsistent ${mutation}`, () => {
      const a = structuredClone(cases.available.facts) as unknown as ActionFacts;
      if (mutation === "counts") a.gsc!.metrics[0].before = 1.5;
      if (mutation === "delta") a.gsc!.metrics[0].absolute_change = 999;
      if (mutation === "ratio") a.gsc!.metrics[2].before = 0.99;
      if (mutation === "blocked_counts") a.gsc!.state = "waiting";
      if (mutation === "ga4_delta") a.ga4!.difference = 999;
      if (mutation === "ga4_percent") a.ga4!.relative_change_percent = "0.00";
      if (mutation === "blocked_sessions")
        Object.assign(a.ga4!, { state: "withheld", reasons: ["SAMPLED"] });
      if (mutation === "source") a.gsc!.scope.source = "ga4";
      if (mutation === "channel")
        Object.assign(a.ga4!.scope, { channel: "all" });
      expect(buildMetricReviewGuidance(a)).toBeNull();
    });
});
