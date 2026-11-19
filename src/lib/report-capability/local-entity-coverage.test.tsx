// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToBuffer } from "@react-pdf/renderer";
import { afterEach, expect, it } from "vitest";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { CapabilitySharedReport } from "@/components/report/CapabilitySharedReport";
import { CapabilityReportPDFDocument } from "@/components/report/pdf/CapabilityReportPDFDocument";
import raw from "./fixtures/local-entity-v18/report.json";
import { buildApprovedCapabilityDelivery } from "./delivery";
import { projectCapabilityReport } from "./projection";
import { initialCapabilityRevision } from "./revision";
import { validateCapabilityReport } from "./validate";

function fixture() {
  const archived=structuredClone(raw);
  const headline=archived.local_entity_coverage.evidence.find(row=>row.location==="title")!;
  headline.url="https://example.test/tag/austin/";
  archived.local_entity_coverage.archive_headings_only=true;
  const verified=validateCapabilityReport(archived);
  if(!verified.ok) throw new Error("Invalid synthetic v18 fixture");
  const {report}=verified;
  const content=initialCapabilityRevision(report);
  content.status="approved";
  const delivery=buildApprovedCapabilityDelivery(report,{
    id:"00000000-0000-4000-8000-000000009998",report_id:report.id,
    user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,
    revision:1,status:"approved",approved_at:report.generated_at,content,
  });
  return {report,delivery};
}
const internal=/\/payload\/|snapshot_id|Archive page|\/tag\/austin|v22_|rank_source|latitude|longitude| · en · mobile/;
afterEach(cleanup);

it("validates v18 and rejects altered status or unbound observations",()=>{
  const {report}=fixture();
  for(const change of ["status","source","absent"]){
    const altered=structuredClone(report);
    if(change==="status")altered.local_entity_coverage!.status="not_detected";
    if(change==="source")altered.local_entity_coverage!.evidence[0].snapshot_id=report.id;
    if(change==="absent")delete altered.local_entity_coverage;
    expect(validateCapabilityReport(altered).ok).toBe(false);
  }
});

it("renders the same customer status on the report and shared page, with archive URLs reserved for advisors",()=>{
  const {report,delivery}=fixture();
  for(const shared of [false,true]){
    render(shared?<CapabilitySharedReport delivery={delivery} token="synthetic"/>:
      <CapabilityReportDocument document={projectCapabilityReport(report)}/>);
    const section=screen.getByRole("region",{name:"Target city coverage"});
    expect(section.textContent).toContain("Austin · Present");
    expect(section.textContent).toContain("Plumbing services in Austin");
    expect(section.textContent).not.toMatch(internal);
    cleanup();
  }
  expect(JSON.stringify(delivery.document.localEntityCoverage)).not.toMatch(internal);
  render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
  const section=screen.getByRole("region",{name:"Target city coverage"});
  expect(section.textContent).toContain("Archive page");
  expect(section.textContent).toContain("/tag/austin/");
});

function pdfText(node:unknown): string {
  if(!node||typeof node!=="object")return "";
  const x=node as {type?:string;value?:string;children?:unknown[]};
  return x.type==="TEXT_INSTANCE" ? x.value??"" : x.children?.map(pdfText).join("\n")??"";
}

it("renders PDF coverage and omits advisor details even with an advisor projection",async()=>{
  const {report,delivery}=fixture();
  delivery.document.localEntityCoverage=projectCapabilityReport(report).localEntityCoverage;
  let output="";
  const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
    onRender:(data:unknown)=>{output=pdfText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(pdf.subarray(0,4).toString()).toBe("%PDF");
  expect(output).toContain("Target city coverage");
  expect(output).toContain("Plumbing services in Austin");
  expect(output).not.toMatch(internal);
});
