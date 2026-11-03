import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { CapabilitySharedReport } from "@/components/report/CapabilitySharedReport";
import { CapabilityReportPDFDocument } from "@/components/report/pdf/CapabilityReportPDFDocument";
import { validateCapabilityReport } from "./validate";
import { readVersionedReport } from "./read";
import { initialCapabilityRevision } from "./revision";
import { buildApprovedCapabilityDelivery } from "./delivery";

function text(node: unknown): string {
  const value = node as {type?:string;value?:string;children?:unknown[]}|undefined;
  return value?.type === "TEXT_INSTANCE" ? value.value ?? "" : value?.children?.map(text).join("\n") ?? "";
}

describe("P0-04 independently bound rendered evidence", () => {
  it.each(["v7-rendered", "v7-render-unavailable"])("reads and exports %s without internal paths or false corrections", async name => {
    const raw:unknown = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),"utf8"));
    const checked=validateCapabilityReport(raw);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error("Invalid fixture");
    const report=checked.report, before=JSON.stringify(report);
    expect(readVersionedReport(report)).toMatchObject({ok:true,version:"2.2.4"});
    expect(report.evidence.some(e=>e.source_kind==="rendered")).toBe(true);
    const content=initialCapabilityRevision(report);content.status="approved";
    const delivery=buildApprovedCapabilityDelivery(report, {id:"00000000-0000-0000-0000-000000009999",
      report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,
      revision:1,status:"approved",approved_at:report.generated_at,content});
    const html=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
    const share=renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture-token"/>);
    let pdfText="";
    const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
      onRender:(result:unknown)=>{pdfText=text((result as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
    }));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");
    for (const rendered of [html,share,pdfText]) {
      expect(rendered).not.toContain("/payload/");
      expect(rendered).not.toContain("identity_unresolved");
      expect(rendered).not.toContain("does not align");
      expect(rendered).toContain(name==="v7-rendered"?"Based on a rendered page":"could not be completed");
    }
    expect(JSON.stringify(report)).toBe(before);
  });
  it("rejects rendered sources disguised as a historical manifest",()=>{
    const raw=JSON.parse(readFileSync(new URL("./fixtures/v7-rendered.json",import.meta.url),"utf8"));
    raw.schema_version="2.2.2";raw.input_manifest.schema_version="v22_analysis_input_v1";
    expect(validateCapabilityReport(raw).ok).toBe(false);
  });
});
