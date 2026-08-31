import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import reportSchema from "./contracts/report_v2_2.schema.json";
import manifest from "./test-fixtures/site-business/manifest.json";
import structured from "./test-fixtures/site-business/structured_single.json";
import multiple from "./test-fixtures/site-business/multiple_candidates.json";
import partial from "./test-fixtures/site-business/partial_parse.json";
import noContent from "./test-fixtures/site-business/no_content.json";
import expired from "./test-fixtures/site-business/expired.json";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true, useDefaults: false });
addFormats(ajv);
const validate = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/EvidenceItem" });
const samples = { "structured_single.json": structured, "multiple_candidates.json": multiple,
  "partial_parse.json": partial, "no_content.json": noContent, "expired.json": expired };
const declaration = "These values are declarations found in saved customer-site pages; they do not establish the confirmed customer entity, a primary location, or GBP alignment.";

describe("offline website business candidate evidence", () => {
  it.each(Object.entries(samples))("validates actual builder evidence in %s without changing the frozen contract", (_name, sample) => {
    const before = JSON.stringify(sample);
    expect(Array.isArray(sample)).toBe(true);
    expect(new Set(sample.map((item) => item.evidence_id)).size).toBe(sample.length);
    for (const item of sample) {
      expect(validate(item), JSON.stringify(validate.errors)).toBe(true);
      expect(item.source_type).toBe("site");
      expect(item.confidence).toBe("low");
      expect(item.health_status).toBe("healthy");
      expect(typeof item.original_value).toBe("string");
      expect(item.original_value).toBe(item.normalized_value);
      expect(item.limitations).toContain(declaration);
      expect(item.source_locator.url).toBe("https://example.test/");
    }
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("exports only evidence arrays and verifies exact bytes and counts", () => {
    const directory = new URL("./test-fixtures/site-business/", import.meta.url);
    expect(readdirSync(directory).sort()).toEqual([...Object.keys(samples), "manifest.json"].sort());
    expect(Object.keys(manifest.files).sort()).toEqual(Object.keys(samples).sort());
    expect(Object.keys(manifest.inputs).sort()).toEqual(Object.keys(samples).sort());
    expect(manifest.identity_version).toBe("v22_evidence_identity_v1");
    expect(manifest.extraction_version).toBe("site_business_extraction_v1");
    expect(manifest.synthetic_snapshots).toBe(true);
    for (const [name, sample] of Object.entries(samples)) {
      const key = name as keyof typeof samples;
      expect(`sha256:${createHash("sha256").update(readFileSync(new URL(name, directory))).digest("hex")}`).toBe(manifest.files[key]);
      expect(manifest.evidence_counts[key]).toBe(sample.length);
      expect(JSON.stringify(sample)).not.toContain("<script");
    }
  });

  it("preserves raw strings, component addresses and multiple declarations", () => {
    expect(structured).toHaveLength(7);
    expect(structured.map((item) => item.original_value)).toContain(" Fixture Plumbing ");
    expect(structured.map((item) => item.original_value)).toContain("123 Fixture St");
    expect(structured.map((item) => item.original_value)).toContain("Austin");
    expect(multiple).toHaveLength(30);
    expect(multiple.filter((item) => item.original_value === "+1 512 555 0100")).toHaveLength(4);
    expect(multiple.map((item) => item.original_value)).toContain("Second Fixture Shop");
    expect(multiple.map((item) => item.original_value)).toContain("555-0199");
    expect(partial.map((item) => item.original_value).sort()).toEqual([" Saved address ", "555-0100"]);
    expect(noContent).toEqual([]);
    expect(expired).toEqual([]);
  });

  it.each([
    { source_type: "site_business" }, { candidate_id: "sf_extra" }, { confidence: "confirmed" },
    { original_value: { streetAddress: "A" } }, { normalized_value: [] }, { snapshot_id: "not-uuid" },
    { evidence_id: "invented" }, { source_locator: { url: "not-a-url" } },
  ])("rejects invalid evidence structure %#", (change) => {
    expect(validate({ ...structuredClone(structured[0]), ...change })).toBe(false);
  });
});
