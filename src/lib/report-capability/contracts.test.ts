import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import manifest from "./contracts/manifest.json";
import rejected from "./contracts/fixtures/rejected.json";
import legacy from "../report-v22/contracts/fixtures/prospect.json";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import type { CapabilityReport, DeliveryRevision } from "./generated/types";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { projectCapabilityReport } from "./projection";
import { readVersionedReport } from "./read";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";

const fixtures = readdirSync(new URL("./contracts/fixtures", import.meta.url)).filter((p) => p !== "rejected.json")
  .map((name) => ({ name, report: JSON.parse(readFileSync(new URL(`./contracts/fixtures/${name}`, import.meta.url), "utf8")) as CapabilityReport }));

describe("P1 shared capability contract", () => {
  it.each(fixtures)("accepts $name without modifying the report", ({ report }) => {
    const before = JSON.stringify(report);
    expect(validateCapabilityReport(report).ok).toBe(true);
    expect(JSON.stringify(report)).toBe(before);
  });
  it.each(rejected)("rejects backend parity vector $id", ({ report }) => {
    expect(validateCapabilityReport(report).ok).toBe(false);
  });
  it("pins all schemas and fixtures to the exported manifest", () => {
    for (const [name, checksum] of Object.entries(manifest.files)) {
      expect(`sha256:${createHash("sha256").update(readFileSync(new URL(`./contracts/${name}`, import.meta.url))).digest("hex")}`).toBe(checksum);
    }
  });
  it("keeps old reports readable without adding new fields", () => {
    expect(readVersionedReport(legacy)).toMatchObject({ ok: true, version: "2.2.1" });
    expect(readVersionedReport(fixtures[0].report)).toMatchObject({ ok: true, version: "2.2.2" });
    expect(readVersionedReport(null)).toEqual({ ok: false, code: "REPORT_CONTRACT_INVALID" });
    expect(legacy).not.toHaveProperty("input_manifest");
  });
  it.each([0, 1, 2, 3])("approves unchanged content and renders %i actions without padding", (count) => {
    const report = fixtures.find((f) => f.name === `first_service-${count}.json`)!.report;
    const revision = {
      schema_version: "v22_delivery_revision_v1", report_id: report.id,
      user_id: report.input_manifest.user_id, case_id: report.input_manifest.case_id,
      expected_revision: 0, source_checksum: canonicalDigest(report), status: "approved",
      title: report.title, summary: report.summary, client_note: null,
      actions: report.actions.map(({ finding_ids, dependencies, ...action }) => action),
    } as DeliveryRevision;
    expect(validateDeliveryRevision(revision, report)).toBe(true);
    const projection = projectCapabilityReport(report, revision);
    expect(projection.actions).toHaveLength(count);
    expect(projection.actions.map((a) => a.sequence)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    const html = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: projection }));
    expect(html).toContain("Contact us");
    expect(html.includes("No action proposed yet")).toBe(count === 0);
    expect(validateDeliveryRevision({ ...revision, evidence: report.evidence }, report)).toBe(false);
    expect(() => projectCapabilityReport(report, { ...revision, status: "draft" })).toThrow();
    expect(() => projectCapabilityReport(report, { ...revision, source_checksum: `sha256:${"0".repeat(64)}` })).toThrow();
  });
});
