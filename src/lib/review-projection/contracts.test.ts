import {describe, expect, it} from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import bundleSchema from "./contracts/bundle.schema.json";
import projectionSchema from "./contracts/projection.schema.json";
import differenceSchema from "./contracts/difference.schema.json";
import fixtures from "./contracts/fixtures.json";
import {canonicalDigest} from "../verified-analysis-v22/digest";

const ajv = new Ajv2020({strict: false, allErrors: true});
addFormats(ajv);
const bundleValid = ajv.compile(bundleSchema);
const projectionValid = ajv.compile(projectionSchema);
const differenceValid = ajv.compile(differenceSchema);

describe("internal review contracts (not a public validator)", () => {
  it("exports a checksum-bound synthetic input without changing the prior schemas", () => {
    expect(fixtures.kind).toBe("synthetic_contract_examples");
    expect(bundleValid(fixtures.bundle), JSON.stringify(bundleValid.errors)).toBe(true);
    const {checksum, ...body} = fixtures.bundle;
    expect(canonicalDigest(body)).toBe(checksum);
    const {schema_version: _version, evidence_checksum, decisions: _decisions, ...core} = body;
    expect(canonicalDigest(core)).toBe(evidence_checksum);
    expect(fixtures.bundle.report.schema_version).toBe("2.2.2");
  });
  it.each(Object.entries(fixtures.projections))("accepts backend projection %s", (_name, projection) => {
    expect(projectionValid(projection), JSON.stringify(projectionValid.errors)).toBe(true);
    const {checksum, ...body} = projection;
    expect(canonicalDigest(body)).toBe(checksum);
    expect(projection.effect).toBeNull();
    expect(projection.causal_attribution).toBe(false);
    projection.client_actions.forEach((client, i) => {
      expect(client.facts).toEqual(projection.seo_actions[i].facts);
      expect(client.next_decision).toEqual(projection.seo_actions[i].next_decision);
      expect(client.facts.recorded_work.system_completion_verified).toBe(false);
    });
    const clientText = JSON.stringify({actions: projection.client_actions, new: projection.client_new_decisions, prior: projection.prior_diagnosis});
    for (const field of ["user_id", "checksum", "source_references", "decision_record", "implementation_entry"]) {
      expect(clientText).not.toContain(`"${field}"`);
    }
  });
  it.each(Object.entries(fixtures.differences))("accepts semantic diff %s", (_name, diff) => {
    expect(differenceValid(diff), JSON.stringify(differenceValid.errors)).toBe(true);
  });
  it("separates numeric movement, a first baseline, and changes to work", () => {
    expect(fixtures.differences.first.state).toBe("first_baseline");
    expect(fixtures.differences.first.actions).toEqual([]);
    expect(fixtures.differences.unchanged.actions.every(a => !a.evidence_changed && !a.decision_changed)).toBe(true);
    expect(fixtures.differences.changed.actions[0].evidence_changed).toBe(true);
    expect(fixtures.differences.changed.actions[0].decision_changed).toBe(false);
  });
  it("withholds restricted counts and never fills missing evidence with zero", () => {
    expect(fixtures.projections.withheld.client_actions[0].facts.ga4.state).toBe("withheld");
    expect(fixtures.projections.withheld.client_actions[0].facts.ga4.before).toBeNull();
    expect(fixtures.projections.no_sources.client_actions[0].facts.ga4).toBeNull();
    expect(fixtures.projections.zero_baseline.client_actions[0].facts.ga4.relative_change_percent).toBeNull();
    expect(fixtures.projections.zero_baseline.client_actions[0].facts.ga4.difference).toBe(10);
  });
  it.each(["effect", "causal", "completion", "extra", "disposition"])("rejects unsupported output shape: %s", kind => {
    const p = structuredClone(fixtures.projections.baseline) as any;
    if (kind === "effect") p.effect = "improved";
    if (kind === "causal") p.causal_attribution = true;
    if (kind === "completion") p.client_actions[0].facts.recorded_work.system_completion_verified = true;
    if (kind === "extra") p.client_actions[0].private_note = "do not publish";
    if (kind === "disposition") p.client_actions[0].next_decision.disposition = "proven_success";
    expect(projectionValid(p)).toBe(false);
  });
});
