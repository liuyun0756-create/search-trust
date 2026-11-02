import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generatedDelivery } from "@/lib/report-capability/fixtures/generated-delivery";
import { CapabilityReportPDFDocument } from "./CapabilityReportPDFDocument";
import { buildApprovedCapabilityDelivery } from "@/lib/report-capability/delivery";
import { novaSampleDelivery, sampleTargetDelivery, targetQueries, ordinaryTarget, unmatchedTarget } from "@/lib/report-capability/fixtures/sample-target-delivery";

// Inspect text from the completed PDF layout, not compressed PDF bytes or mocked components.
function renderedText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const value = node as { type?: string; value?: string; children?: unknown[] };
  if (value.type === "TEXT_INSTANCE") return value.value ?? "";
  return value.children?.map(renderedText).join("\n") ?? "";
}

describe("Capability approved PDF renderer", () => {
  it.runIf(Boolean(process.env.P0_01_NOVA_REPORT_PATH))("renders the real Nova PDF without sampling coordinates or device parameters", async () => {
    const delivery = novaSampleDelivery();
    const before = JSON.stringify(delivery);
    let text = "";
    const pdf = await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({ delivery }), {
      onRender: (result: unknown) => {
        text = renderedText((result as { _INTERNAL__LAYOUT__DATA_: unknown })._INTERNAL__LAYOUT__DATA_);
      },
    }));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(text).toContain("Plumbing repair Fresno · Organic search");
    expect(text).not.toContain("36.774001");
    expect(text).not.toContain("· en · mobile");
    expect(JSON.stringify(delivery)).toBe(before);
    if (process.env.V22_PDF_OUTPUT_DIR) {
      await mkdir(path.resolve(process.env.V22_PDF_OUTPUT_DIR), { recursive: true });
      await writeFile(path.join(path.resolve(process.env.V22_PDF_OUTPUT_DIR), "nova-v5-p0-01.pdf"), pdf);
    }
  });
  it("renders PDF text without sample coordinates in targets, rationale, materials or execution steps", async () => {
    const delivery = sampleTargetDelivery();
    const before = JSON.stringify(delivery);
    let text = "";
    const document = React.cloneElement(CapabilityReportPDFDocument({ delivery }), {
      onRender: (result: unknown) => {
        text = renderedText((result as { _INTERNAL__LAYOUT__DATA_: unknown })._INTERNAL__LAYOUT__DATA_);
      },
    });
    const pdf = await renderToBuffer(document);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(text).not.toContain("36.774001");
    expect(text).not.toContain("-119.68942");
    expect(text.replaceAll(unmatchedTarget, "")).not.toContain("· en · mobile");
    expect(text).not.toContain("· en · desktop");
    for (const query of targetQueries) expect(text).toContain(`${query} · Organic search`);
    expect(text).toContain(ordinaryTarget);
    expect(text).toContain(unmatchedTarget);
    expect(text.match(/Checked scope: Scope query · Organic search/g)).toHaveLength(1);
    expect(JSON.stringify(delivery)).toBe(before);
  });
  it.each(["public-0.json", "public-3.json", "service-first.json", "service-measurement.json"])("renders the exact approved projection for %s", async (name) => {
    const { report, saved } = generatedDelivery(name);
    saved.content.summary = "SEO-approved client summary, retained in the PDF.";
    if (saved.content.actions.length) saved.content.actions[0]!.materials[0]!.body = "SEO-approved execution material, retained in the PDF.";
    const delivery = buildApprovedCapabilityDelivery(report, saved);
    const before = JSON.stringify(delivery);
    const pdf = await renderToBuffer(CapabilityReportPDFDocument({ delivery, branding: { enabled: true,
      agencyName: "Northside SEO", agencyLogoData: null, clientName: "Example Plumbing", footerNote: "Prepared for client discussion" } }));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(4000);
    expect(JSON.stringify(delivery)).toBe(before);
    if (process.env.V22_PDF_OUTPUT_DIR) {
      await mkdir(path.resolve(process.env.V22_PDF_OUTPUT_DIR), { recursive: true });
      await writeFile(path.join(path.resolve(process.env.V22_PDF_OUTPUT_DIR),name.replace(".json",".pdf")),pdf);
    }
  });
  it("renders Chinese and accented text using bundled fonts without changing the projection", async () => {
    const {delivery}=generatedDelivery("public-0.json");
    delivery.document.title="客户诊断报告 · Café";delivery.document.summary="先确认现有服务页面，再讨论下一步。";
    const pdf=await renderToBuffer(CapabilityReportPDFDocument({delivery}));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");
    if(process.env.V22_PDF_OUTPUT_DIR)await writeFile(path.join(path.resolve(process.env.V22_PDF_OUTPUT_DIR),"multilingual.pdf"),pdf);
  });
  it("rejects remote logos and characters missing from the bundled font", async () => {
    const { delivery } = generatedDelivery("public-0.json");
    expect(() => CapabilityReportPDFDocument({ delivery, branding: { enabled:true,agencyName:null,
      clientName:null,footerNote:null,agencyLogoData:"https://example.invalid/remote-logo.png" } })).toThrow("CAPABILITY_PDF_LOGO_INVALID");
    delivery.document.title = "Missing glyph \u{10ffff}";
    expect(() => CapabilityReportPDFDocument({ delivery })).toThrow("CAPABILITY_PDF_UNSUPPORTED_TEXT");
  });
});
