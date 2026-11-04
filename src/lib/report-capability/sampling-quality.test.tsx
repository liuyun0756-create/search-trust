import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { expect, it } from "vitest";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { validateCapabilityReport } from "./validate";
import { initialCapabilityRevision } from "./revision";
import { buildApprovedCapabilityDelivery } from "./delivery";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { CapabilitySharedReport } from "@/components/report/CapabilitySharedReport";
import { CapabilityReportPDFDocument } from "@/components/report/pdf/CapabilityReportPDFDocument";

function layoutText(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] } | undefined;
  return n?.type === "TEXT_INSTANCE" ? n.value ?? "" : n?.children?.map(layoutText).join("\n") ?? "";
}

it("P1-00 renders the approved locality copy in v10 web/share/PDF without internal reasons", async () => {
  const raw = JSON.parse(readFileSync(new URL("./fixtures/labelled/public.json", import.meta.url), "utf8"));
  raw.input_manifest.ruleset_version = "v22_capability_public_v10";
  const { input_checksum: _old, ...body } = raw.input_manifest;
  raw.input_manifest.input_checksum = canonicalDigest(body);
  raw.prioritization.input_checksum = raw.input_manifest.input_checksum;
  const note = "This organic search sample mostly reflected other areas, so it is not used to judge local visibility.";
  raw.limitations.push(note);
  const validated = validateCapabilityReport(raw);
  if (!validated.ok) throw new Error("Invalid v10 fixture");
  const report = validated.report;
  const content = initialCapabilityRevision(report); content.status = "approved";
  const delivery = buildApprovedCapabilityDelivery(report, {id:"00000000-0000-0000-0000-000000009999",report_id:report.id,
    user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:"approved",approved_at:report.generated_at,content});
  const before = JSON.stringify(delivery);
  const web = renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
  const shared = renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>);
  let pdfText = "";
  const pdf = await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}), {
    onRender: (data: unknown) => {pdfText = layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(pdf.subarray(0,4).toString()).toBe("%PDF");
  for (const text of [web, shared, pdfText]) {
    expect(text.replaceAll("\n", "")).toContain(note);
    for (const internal of ["sample_not_local", "page_out_of_scope", "/payload/", "· en · mobile"])
      expect(text).not.toContain(internal);
  }
  expect(JSON.stringify(delivery)).toBe(before);
});
