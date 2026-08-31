import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import reportSchema from "./contracts/report_v2_2.schema.json";
import manifest from "./test-fixtures/evidence/manifest.json";
import publicEvidence from "./test-fixtures/evidence/public.json";
import verifiedEvidence from "./test-fixtures/evidence/verified.json";
import gapsEvidence from "./test-fixtures/evidence/gaps.json";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true, useDefaults: false });
addFormats(ajv);
// Reuse the frozen definition with all references intact; do not fabricate a report.
const validate = ajv.compile({ $defs: reportSchema.$defs, $ref: "#/$defs/EvidenceItem" });
const samples = { "public.json": publicEvidence, "verified.json": verifiedEvidence, "gaps.json": gapsEvidence };

describe("snapshot-backed evidence fixtures", () => {
  it.each(Object.entries(samples))("validates every EvidenceItem in %s", (_name, items) => {
    const before = JSON.stringify(items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(validate(item), JSON.stringify(validate.errors)).toBe(true);
      expect(item.evidence_id).toMatch(/^ev_[a-f0-9]{64}$/);
    }
    expect(JSON.stringify(items)).toBe(before);
    expect(new Set(items.map((item) => item.evidence_id)).size).toBe(items.length);
  });

  it("consumes every generated sample and verifies byte hashes", () => {
    const directory = new URL("./test-fixtures/evidence/", import.meta.url);
    expect(readdirSync(directory).sort()).toEqual(["gaps.json", "manifest.json", "public.json", "verified.json"]);
    expect(Object.keys(manifest.files).sort()).toEqual(Object.keys(samples).sort());
    expect(Object.keys(manifest.inputs).sort()).toEqual(Object.keys(samples).sort());
    expect(manifest.identity_version).toBe("v22_evidence_identity_v1");
    expect(manifest.synthetic_snapshots).toBe(true);
    for (const [name, items] of Object.entries(samples)) {
      const key = name as keyof typeof samples;
      const bytes = readFileSync(new URL(name, directory));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(manifest.files[key]);
      expect(items.length).toBe(manifest.evidence_counts[key]);
    }
  });

  it("retains existing measured zero and represents unavailable data as coverage", () => {
    expect(verifiedEvidence).toHaveLength(6);
    expect(verifiedEvidence.filter((item) => item.normalized_value === 0)).toHaveLength(3);
    expect(gapsEvidence).toHaveLength(1);
    expect(gapsEvidence[0].source_type).toBe("coverage");
    expect(gapsEvidence[0].normalized_value).toBe("unhealthy");
  });

  it.each([
    { unexpected: true },
    { source_type: "invented" },
    { evidence_id: "page-0001" },
    { snapshot_id: "not-a-uuid" },
    { normalized_value: { not: "a scalar" } },
    { collected_at: "2026-08-30" },
    { coverage_start: "2026-02-30" },
    { source_locator: { device: "tablet" } },
  ])("rejects invalid frozen evidence structure %#", (change) => {
    expect(validate({ ...structuredClone(publicEvidence[0]), ...change })).toBe(false);
  });
});
