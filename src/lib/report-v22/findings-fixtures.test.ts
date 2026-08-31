import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import reportSchema from "./contracts/report_v2_2.schema.json";
import manifest from "./test-fixtures/findings/manifest.json";
import triggered from "./test-fixtures/findings/triggered.json";
import clear from "./test-fixtures/findings/clear.json";
import gaps from "./test-fixtures/findings/gaps.json";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true, useDefaults: false });
addFormats(ajv);
// Validate real builder fragments against frozen definitions, not a fake full report.
const findingValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/Finding" });
const evidenceValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/EvidenceItem" });
const layerValidator = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/LayerAssessment" });
const samples = { "triggered.json": triggered, "clear.json": clear, "gaps.json": gaps };

describe("bounded public Findings fixtures", () => {
  it.each(Object.entries(samples))("validates frozen definitions and references in %s", (_name, sample) => {
    const before = JSON.stringify(sample);
    const ids = new Set(sample.evidence_index.map((e) => e.evidence_id));
    expect(ids.size).toBe(sample.evidence_index.length);
    for (const item of sample.evidence_index) {
      expect(evidenceValidator(item), JSON.stringify(evidenceValidator.errors)).toBe(true);
    }
    expect(new Set(sample.findings.map((f) => f.finding_id)).size).toBe(sample.findings.length);
    for (const finding of sample.findings) {
      expect(findingValidator(finding), JSON.stringify(findingValidator.errors)).toBe(true);
      expect(finding.finding_id).toMatch(/^fn_[a-f0-9]{64}$/);
      expect(finding.rule_version).toBe("1.0.0");
      const references = [...finding.evidence_ids, ...finding.comparator_ids];
      expect(new Set(references).size).toBe(references.length);
      for (const id of references) expect(ids.has(id)).toBe(true);
      expect(["low", "medium"]).toContain(finding.confidence);
      expect(finding.change_conditions.length).toBeGreaterThan(0);
      expect(finding.missing_data.length).toBeGreaterThan(0);
    }
    expect(sample.layers.length % 8).toBe(0);
    for (const layer of sample.layers) {
      expect(layerValidator(layer), JSON.stringify(layerValidator.errors)).toBe(true);
      expect(layer.status).toBe("not_checked");
      expect(layer.finding_ids).toEqual([]);
      expect(layer.evidence_ids).toEqual([]);
      expect(layer.summary).toContain("semantic_rules_not_implemented");
    }
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("checks every file and byte hash without changing the frozen contract", () => {
    const directory = new URL("./test-fixtures/findings/", import.meta.url);
    expect(readdirSync(directory).sort()).toEqual(["clear.json", "gaps.json", "manifest.json", "triggered.json"]);
    expect(Object.keys(manifest.files).sort()).toEqual(Object.keys(samples).sort());
    expect(Object.keys(manifest.inputs).sort()).toEqual(Object.keys(samples).sort());
    expect(manifest.identity_version).toBe("v22_public_finding_identity_v1");
    expect(manifest.ruleset_version).toBe("v22_public_findings_v1");
    expect(manifest.synthetic_snapshots).toBe(true);
    for (const [name, sample] of Object.entries(samples)) {
      const key = name as keyof typeof samples;
      const bytes = readFileSync(new URL(name, directory));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(manifest.files[key]);
      expect(manifest.counts[key]).toEqual({ findings: sample.findings.length, evidence_index: sample.evidence_index.length, layers: sample.layers.length });
    }
  });

  it("contains all six implemented rules without manufacturing semantic ratings", () => {
    expect(triggered.findings).toHaveLength(7);
    expect(new Set(triggered.findings.map((f) => f.rule_id))).toEqual(new Set([
      "v22_public.site_http_error", "v22_public.site_explicit_noindex", "v22_public.site_duplicate_title",
      "v22_public.market_site_domain_unobserved", "v22_public.market_confirmed_competitors_ahead",
      "v22_public.competitor_sample_page_type_gap",
    ]));
    expect(clear.findings).toHaveLength(0);
    expect(clear.evidence_index.length).toBeGreaterThan(0);
    expect(gaps.findings).toHaveLength(0);
    expect(gaps.evidence_index).toHaveLength(1);
    expect(gaps.evidence_index[0].source_type).toBe("coverage");
    expect(gaps.evidence_index[0].normalized_value).toBe("expired");
  });

  it.each([
    { unexpected: true }, { severity: "invented" }, { classification: "opinion" },
    { confidence: 1 }, { evidence_ids: [] }, { evidence_ids: [17] },
    { affected_urls: ["not a url"] }, { statement: { text: "wrong scalar" } },
  ])("rejects invalid Finding structures %#", (change) => {
    expect(findingValidator({ ...structuredClone(triggered.findings[0]), ...change })).toBe(false);
  });

  it.each([{ unexpected: true }, { status: "excellent" }, { layer_key: "http_health" }, { summary: 42 }])(
    "rejects invalid LayerAssessment structures %#", (change) => {
      expect(layerValidator({ ...structuredClone(triggered.layers[0]), ...change })).toBe(false);
    },
  );
});
