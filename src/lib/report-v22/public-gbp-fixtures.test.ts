import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import reportSchema from "./contracts/report_v2_2.schema.json";
import manifest from "./test-fixtures/public-gbp/manifest.json";
import matched from "./test-fixtures/public-gbp/matched.json";
import partial from "./test-fixtures/public-gbp/partial.json";
import conflict from "./test-fixtures/public-gbp/identity_conflict.json";
import expired from "./test-fixtures/public-gbp/expired.json";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true, useDefaults: false });
addFormats(ajv);
const evidenceValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/EvidenceItem" });
const layerValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/LayerAssessment" });
const samples = { "matched.json": matched, "partial.json": partial, "identity_conflict.json": conflict, "expired.json": expired };

describe("customer public GBP frozen fragments", () => {
  it.each(Object.entries(samples))("validates actual builder evidence and unchecked layers in %s", (_name, sample) => {
    const before = JSON.stringify(sample);
    expect(Object.keys(sample).sort()).toEqual(["evidence_index", "findings", "layers"]);
    expect(sample.findings).toEqual([]);
    const ids = new Set(sample.evidence_index.map((item) => item.evidence_id));
    expect(ids.size).toBe(sample.evidence_index.length);
    expect(new Set(sample.evidence_index.map((item) => item.snapshot_id)).size).toBe(1);
    for (const item of sample.evidence_index) {
      expect(evidenceValidator(item), JSON.stringify(evidenceValidator.errors)).toBe(true);
      expect(["gbp", "coverage"]).toContain(item.source_type);
      expect(["low", "medium"]).toContain(item.confidence);
      expect(item.limitations).toContain("These observations are from a public customer GBP profile, not authorized GBP Performance data.");
    }
    expect(sample.layers).toHaveLength(8);
    for (const layer of sample.layers) {
      expect(layerValidator(layer), JSON.stringify(layerValidator.errors)).toBe(true);
      expect(layer.status).toBe("not_checked");
      expect(layer.evidence_ids).toEqual([]);
      expect(layer.finding_ids).toEqual([]);
      for (const id of layer.evidence_ids) expect(ids.has(id)).toBe(true);
    }
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("keeps all inputs backend-only and verifies exact exported bytes", () => {
    const directory = new URL("./test-fixtures/public-gbp/", import.meta.url);
    expect(readdirSync(directory).sort()).toEqual([...Object.keys(samples), "manifest.json"].sort());
    expect(Object.keys(manifest.files).sort()).toEqual(Object.keys(samples).sort());
    expect(Object.keys(manifest.inputs).sort()).toEqual(Object.keys(samples).sort());
    expect(manifest.identity_version).toBe("customer_public_gbp_identity_v1");
    expect(manifest.synthetic_snapshots).toBe(true);
    for (const [name, sample] of Object.entries(samples)) {
      const key = name as keyof typeof samples;
      expect(`sha256:${createHash("sha256").update(readFileSync(new URL(name, directory))).digest("hex")}`).toBe(manifest.files[key]);
      expect(manifest.counts[key]).toEqual({ evidence_index: sample.evidence_index.length, findings: 0, layers: 8 });
    }
  });

  it("distinguishes actual false, absent fields, identity conflict and expiry", () => {
    expect(matched.evidence_index).toHaveLength(10);
    expect(matched.evidence_index.some((item) => item.original_value === false && item.normalized_value === false)).toBe(true);
    expect(matched.evidence_index.every((item) => item.source_type === "gbp")).toBe(true);
    expect(partial.evidence_index.filter((item) => item.source_type === "coverage").map((item) => item.normalized_value).sort()).toEqual(["empty", "partial", "partial"]);
    expect(conflict.evidence_index).toHaveLength(1);
    expect(expired.evidence_index).toHaveLength(1);
    expect(conflict.evidence_index[0].normalized_value).toBe("identity_mismatch");
    expect(expired.evidence_index[0].normalized_value).toBe("expired");
    expect(conflict.evidence_index[0].source_type).toBe("coverage");
    expect(expired.evidence_index[0].source_type).toBe("coverage");
  });

  it.each([
    { source_type: "public_gbp" }, { gbp_origin: "public_profile" }, { confidence: "certain" },
    { original_value: { value: "business" } }, { normalized_value: [] }, { snapshot_id: "not-uuid" },
    { evidence_id: "invented" }, { source_locator: { url: "not-a-url" } },
  ])("rejects invalid frozen evidence structure %#", (change) => {
    expect(evidenceValidator({ ...structuredClone(matched.evidence_index[0]), ...change })).toBe(false);
  });
});
