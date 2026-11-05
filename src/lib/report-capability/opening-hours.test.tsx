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
function fixture(name="all-star-plumbing-fresno") {
  return JSON.parse(readFileSync(new URL(`./fixtures/opening-hours/${name}.json`, import.meta.url), "utf8"));
}
function layoutText(node: unknown): string {
  const n=node as {type?:string;value?:string;children?:unknown[]} | undefined;
  return n?.type === "TEXT_INSTANCE" ? n.value ?? "" : n?.children?.map(layoutText).join("\n") ?? "";
}
it.each(["all-star-plumbing-fresno","vision-tech-swansea"])("renders real v11 hours mismatch in web/share/PDF: %s", async name=>{
 const raw=fixture(name); const validated=validateCapabilityReport(raw);
 if(!validated.ok) throw new Error("Invalid real v11 report");
 const report=validated.report, content=initialCapabilityRevision(report); content.status="approved";
 expect(content.schema_version).toBe("v22_delivery_revision_v2");
 const delivery=buildApprovedCapabilityDelivery(report,{id:"00000000-0000-0000-0000-000000009999",report_id:report.id,
 user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:"approved",approved_at:report.generated_at,content});
 const before=JSON.stringify(delivery);
 const web=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
 const shared=renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>);
 let pdfText="";
 const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{onRender:(data:unknown)=>{
 pdfText=layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);}}));
 expect(pdf.subarray(0,4).toString()).toBe("%PDF");
 for(const rawText of [web,shared,pdfText]){
  const text=rawText.replaceAll("\n","");
  expect(text).toContain("The published hours on the two channels differ. Please check both channels");
  expect(text).toContain(name.startsWith("all-star")?"Website structured data":"Website text");
  for(const internal of ["/payload/","identity_unresolved","· en · mobile"]) expect(text).not.toContain(internal);
 }
 expect(JSON.stringify(delivery)).toBe(before);
});
it.each(["match","partial_match","none"])("renders conservative hours result %s in all three client surfaces",async result=>{
 const source=JSON.parse(readFileSync(new URL("./fixtures/labelled/public.json",import.meta.url),"utf8"));
 source.schema_version="2.2.6";source.input_manifest.ruleset_version="v22_capability_public_v11";
 const {input_checksum:_,...body}=source.input_manifest;source.input_manifest.input_checksum=canonicalDigest(body);source.prioritization.input_checksum=source.input_manifest.input_checksum;
 source.contact_checks.push({...fixture().contact_checks.find((c:{field:string})=>c.field==="opening_hours"),evidence_ids:[],result,status:result==="none"?"not_checked":"confirmed"});
 const checked=validateCapabilityReport(source);if(!checked.ok)throw new Error("synthetic display fixture");
 const report=checked.report;
 const content=initialCapabilityRevision(report);content.status="approved";
 const delivery=buildApprovedCapabilityDelivery(report,{id:"00000000-0000-0000-0000-000000009999",report_id:report.id,
 user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:"approved",approved_at:report.generated_at,content});
 let pdfText="";await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{onRender:(d:unknown)=>{pdfText=layoutText((d as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);}}));
 const expected=result==="match"?"Published hours match for all seven days":result==="partial_match"?"Published hours match for the compared days":"Published hours could not be compared";
 for(const text of [renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>),pdfText])expect(text.replaceAll("\n","")).toContain(expected);
});
it("rejects the fifth contact field and v3 inventory under v10",()=>{
 const raw=fixture();raw.schema_version="2.2.5";raw.input_manifest.ruleset_version="v22_capability_public_v10";
 const {input_checksum:_,...body}=raw.input_manifest;raw.input_manifest.input_checksum=canonicalDigest(body);raw.prioritization.input_checksum=raw.input_manifest.input_checksum;
 expect(validateCapabilityReport(raw).ok).toBe(false);
 raw.contact_checks=raw.contact_checks.filter((c:{field:string})=>c.field!=="opening_hours");
 expect(validateCapabilityReport(raw).ok).toBe(true);
 raw.input_manifest.snapshots[0].schema_version="site_inventory_snapshot_v3";
 const {input_checksum:__,...changed}=raw.input_manifest;raw.input_manifest.input_checksum=canonicalDigest(changed);raw.prioritization.input_checksum=raw.input_manifest.input_checksum;
 expect(validateCapabilityReport(raw).ok).toBe(false);
});
