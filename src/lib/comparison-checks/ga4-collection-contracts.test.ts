import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import {describe, expect, it} from "vitest";
import schema from "./ga4-collection-contracts/collection.schema.json";
import vectors from "./ga4-collection-contracts/fixtures.json";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {parseView} from "./contracts";
import {resultView, target, checkId} from "./test-fixture";

// Preparation only: production owner routes do not accept this new source yet.
const ajv = new Ajv2020({strict: false}); addFormats(ajv);
const valid = ajv.compile(schema);
describe("separate GA4 exact-window contract", () => {
  it.each(vectors)("validates backend fixture $name without claiming a final comparison", ({collection: c}) => {
    expect(valid(c)).toBe(true);
    const {checksum, ...body} = c; expect(canonicalDigest(body)).toBe(checksum);
    const {checksum: planChecksum, ...plan} = c.plan; expect(canonicalDigest(plan)).toBe(planChecksum);
    expect(c.plan.scope.channel).toBe("organic_search");
    if (c.qualification) {
      expect(c.qualification.observation_checksum).toBe(canonicalDigest(c.snapshot));
      expect(c.qualification.effect_conclusion).toBeNull(); expect(c.qualification.causal_attribution).toBe(false);
      expect(c.qualification.processing_completeness).toBe("not_attested");
      expect(c.qualification.event_history).toBe("unverified");
      expect(c.qualification.metrics.every(m => m.state === "not_comparable")).toBe(true);
    } else {
      expect(c.state).toBe("waiting"); expect(c.snapshot).toBeNull(); expect(c.plan.expected_report_requests).toBe(0);
    }
    expect(parseView({...resultView(), result: c}, target, checkId)).toBeNull();
  });
  it("cannot be relabeled as all traffic or a qualified SEO effect", () => {
    const c = structuredClone(vectors[0].collection);
    expect(valid({...c, plan: {...c.plan, scope: {...c.plan.scope, channel: "all"}}})).toBe(false);
    expect(valid({...c, qualification: {...c.qualification, effect_conclusion: "effective"}})).toBe(false);
    expect(valid({...c, raw_token: "not-permitted"})).toBe(false);
  });
  it("keeps coverage observation distinct from completeness and event history", () => {
    const observed = vectors.find(v => v.name === "observed_not_final")!.collection.qualification!;
    const missing = vectors.find(v => v.name === "missing_dates")!.collection.qualification!;
    const changed = vectors.find(v => v.name === "changed_configuration")!.collection.qualification!;
    expect(observed.complete_daily_observations).toBe(true); expect(missing.complete_daily_observations).toBe(false);
    expect(observed.processing_completeness).toBe(missing.processing_completeness);
    expect(changed.event_configuration).toBe("changed_during_collection");
    expect(changed.metrics[0].reasons).not.toContain("GA4_EVENT_CONFIGURATION_CHANGED");
    expect(changed.metrics[3].reasons).toContain("GA4_EVENT_CONFIGURATION_CHANGED");
  });
});
