import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import type { CapabilityReport } from "./generated/types";
import { validateCapabilityReport } from "./validate";

const original = () => JSON.parse(readFileSync(new URL("./fixtures/labelled/public.json", import.meta.url), "utf8")) as CapabilityReport;
function rebind(report: CapabilityReport) {
  const { input_checksum: _old, ...body } = report.input_manifest;
  report.input_manifest.input_checksum = canonicalDigest(body);
  if (report.prioritization) report.prioritization.input_checksum = report.input_manifest.input_checksum;
  return report;
}

describe("P0-10 public v9 compatibility", () => {
  it("accepts the new ruleset and retains frozen v8 reports", () => {
    const old = original();
    const before = JSON.stringify(old);
    expect(validateCapabilityReport(old).ok).toBe(true);
    const next = structuredClone(old);
    next.input_manifest.ruleset_version = "v22_capability_public_v9";
    expect(validateCapabilityReport(rebind(next)).ok).toBe(true);
    expect(JSON.stringify(old)).toBe(before);
  });

  it("accepts the versioned inventory only with the new public ruleset", () => {
    const report = original();
    report.input_manifest.snapshots.find(s => s.source_kind === "site")!.schema_version = "site_inventory_snapshot_v2";
    expect(validateCapabilityReport(rebind(report)).ok).toBe(false);
    report.input_manifest.ruleset_version = "v22_capability_public_v9";
    expect(validateCapabilityReport(rebind(report)).ok).toBe(true);
    const overLimit = { ...report, actions: [...report.actions, ...report.actions, ...report.actions] };
    expect(validateCapabilityReport(overLimit).ok).toBe(false);
  });
});
