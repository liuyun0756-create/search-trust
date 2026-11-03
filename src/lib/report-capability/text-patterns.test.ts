import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { validateCapabilityReport } from "./validate";
import { readVersionedReport } from "./read";
import { projectCapabilityReport } from "./projection";

const readFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("v6 text corroboration delivery", () => {
  it("validates and renders an actual v6 report without a false phone or address correction", () => {
    const result = validateCapabilityReport(readFixture("v6-footer.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Invalid v6 fixture");
    const report = result.report;
    expect(report.input_manifest.ruleset_version).toBe("v22_capability_public_v6");
    expect(report.prioritization?.rules_version).toBe("v22_business_priority_v2");
    expect(report.evidence.some(e => e.value === "Mon - Fri: 09:00 - 17:30")).toBe(true);
    expect(report.findings.some(f => /(?:phone|address)_alignment$/.test(f.rule_id))).toBe(false);
    expect(readVersionedReport(report)).toMatchObject({ ok: true, version: "2.2.2" });
    const html = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: projectCapabilityReport(report) }));
    expect(html).toContain(report.title);
    expect(html).not.toContain("does not align");
    expect(html).not.toContain("text_pattern");
    expect(html).not.toContain("site_business_extraction_v2");
  });

  it("continues to validate the frozen v5 report", () => {
    expect(validateCapabilityReport(readFixture("generated/public-title-review.json")).ok).toBe(true);
  });
});
