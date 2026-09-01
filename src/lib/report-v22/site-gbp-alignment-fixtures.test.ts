import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import reportSchema from "./contracts/report_v2_2.schema.json";

const directory = new URL("./test-fixtures/site-gbp-alignment/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const filenames = Object.keys(manifest.files).sort();
const samples = Object.fromEntries(filenames.map((name) => [
  name,
  JSON.parse(readFileSync(new URL(name, directory), "utf8")),
]));
const gbpRules = new Set([
  "v22_public.gbp_name_alignment",
  "v22_public.gbp_address_alignment",
  "v22_public.gbp_phone_alignment",
  "v22_public.gbp_service_area_alignment",
]);

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true, useDefaults: false });
addFormats(ajv);
const findingValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/Finding" });
const evidenceValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/EvidenceItem" });
const layerValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/LayerAssessment" });

describe("confirmed-identity site/public GBP alignment fixtures", () => {
  it("contains the exact twelve shared deterministic scenarios", () => {
    expect(filenames).toEqual([
      "both_missing.json", "comparison_time_gap.json", "exact_match.json", "gbp_missing.json",
      "identity_unresolved.json", "multiple_candidates_one_match.json",
      "operating_model_not_applicable.json", "semantic_match.json", "service_area_mismatch.json",
      "service_area_partial.json", "site_missing.json", "source_unavailable.json",
    ]);
    expect(readdirSync(directory).sort()).toEqual([...filenames, "manifest.json"].sort());
    expect(manifest.rule_version).toBe("1.1.0");
    expect(manifest.synthetic_snapshots).toBe(true);
  });

  it.each(Object.entries(samples))("validates frozen report fragments and all references in %s", (name, sample: any) => {
    const before = JSON.stringify(sample);
    expect(sample.ruleset_version).toBe("v22_public_findings_v1");
    const ids = new Set(sample.evidence_result.evidence_index.map((item: any) => item.evidence_id));
    expect(ids.size).toBe(sample.evidence_result.evidence_index.length);
    for (const item of sample.evidence_result.evidence_index) {
      expect(evidenceValidator(item), JSON.stringify(evidenceValidator.errors)).toBe(true);
    }
    for (const finding of sample.findings) {
      expect(findingValidator(finding), JSON.stringify(findingValidator.errors)).toBe(true);
      for (const id of [...finding.evidence_ids, ...finding.comparator_ids]) expect(ids.has(id)).toBe(true);
      if (gbpRules.has(finding.rule_id)) expect(finding.rule_version).toBe("1.1.0");
    }
    const evaluations = sample.rule_evaluations.filter((item: any) => gbpRules.has(item.rule_id));
    expect(evaluations).toHaveLength(4);
    expect(new Set(evaluations.map((item: any) => item.rule_version))).toEqual(new Set(["1.1.0"]));
    expect(Object.fromEntries(evaluations.map((item: any) => [item.rule_id, { state: item.state, reason: item.reason }]))).toEqual(manifest.states[name]);
    expect(sample.findings.filter((item: any) => gbpRules.has(item.rule_id))).toHaveLength(manifest.finding_counts[name]);
    for (const layer of sample.site_rollup.layers) {
      expect(layerValidator(layer), JSON.stringify(layerValidator.errors)).toBe(true);
      expect(layer.status).toBe("not_checked");
      expect(layer.evidence_ids).toEqual([]);
      expect(layer.finding_ids).toEqual([]);
    }
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("checks exact exported bytes and keeps the frozen report schema unchanged", () => {
    expect(Object.keys(manifest.inputs).sort()).toEqual(filenames);
    for (const name of filenames) {
      const bytes = readFileSync(new URL(name, directory));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(manifest.files[name]);
    }
    expect(reportSchema.$defs.Finding).toBeDefined();
  });
});
