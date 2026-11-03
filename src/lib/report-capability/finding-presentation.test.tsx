import React from "react";
import {readFileSync} from "node:fs";
import {validateCapabilityReport} from "./validate";
import {initialCapabilityRevision} from "./revision";
import {buildApprovedCapabilityDelivery} from "./delivery";
import {contactCheckLabel,findingLabels,readerFinding} from "./reader-copy";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { CapabilitySharedReport } from "@/components/report/CapabilitySharedReport";
import { CapabilityReportPDFDocument } from "@/components/report/pdf/CapabilityReportPDFDocument";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { evidenceScopes, evidenceSourceLabel, readerDate } from "./reader-copy";

function layoutText(node: unknown): string {
  const n=node as {type?:string;value?:string;children?:unknown[]}|undefined;
  return n?.type==="TEXT_INSTANCE"?n.value??"":n?.children?.map(layoutText).join("\n")??"";
}

describe("P0-06 customer evidence presentation",()=>{
  it("labels sources and preserves the source's calendar date",()=>{
    expect(evidenceSourceLabel("serp")).toBe("Search sample");
    expect(evidenceSourceLabel("public_gbp")).toBe("Public business profile");
    expect(readerDate("2026-10-28T23:30:00-07:00")).toBe("2026-10-28");
    expect(evidenceScopes([{comparison_scope:"serp · Plumbing · Fresno"},{comparison_scope:"serp · Plumbing · Fresno"}]))
      .toEqual(["Search sample · Plumbing · Fresno"]);
  });
  it("deduplicates evidence scope in web/share/PDF and retains advisor timestamps and paths",async()=>{
    const {delivery}=generatedDelivery("public-3.json");
    const first=delivery.document.evidence[0];
    const timestamp="2026-10-28T23:30:00Z";
    delivery.document.evidence=[{...first,source_kind:"serp",observed_at:timestamp,comparison_scope:"Saved serp sample for P006 test market"},
      {...first,id:"p006-other-observation",value:99,source_kind:"serp",observed_at:timestamp,comparison_scope:"Saved serp sample for P006 test market"}];
    delivery.document.findings=[{...delivery.document.findings[0],observed_at:timestamp,evidence_ids:delivery.document.evidence.map(e=>e.id)}];
    const before=JSON.stringify(delivery);
    const client=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
    const share=renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>);
    const owner=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document} technicalDetails/>);
    let pdfText="";
    const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
      onRender:(data:unknown)=>{pdfText=layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
    }));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");
    for(const text of [client,share,pdfText]){
      expect(text.split("Search sample for P006 test market")).toHaveLength(2);
      expect(text).not.toContain("Saved serp sample");
      expect(text).not.toContain(timestamp);
      expect(text).toContain("2026-10-28");
      expect(text).not.toContain("/payload/");
      expect(text).toContain("99");
    }
    expect(owner).toContain(timestamp);
    expect(owner).toContain(first.field_path);
    expect(JSON.stringify(delivery)).toBe(before);
  });
});

function labelledDelivery(name="public") {
  const result=validateCapabilityReport(JSON.parse(readFileSync(new URL(`./fixtures/labelled/${name}.json`,import.meta.url),"utf8")));
  if(!result.ok)throw new Error("Invalid labelled fixture");
  const report=result.report, content=initialCapabilityRevision(report);content.status="approved";
  const delivery=buildApprovedCapabilityDelivery(report,{id:"00000000-0000-0000-0000-000000009999",report_id:report.id,
    user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:"approved",approved_at:report.generated_at,content});
  return {report,delivery};
}

describe("P0-06 typed findings",()=>{
  it.each(["public","service"])("renders generated %s labels and coverage in web/share/PDF",async name=>{
    const {report,delivery}=labelledDelivery(name), before=JSON.stringify(report);
    const html=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
    const share=renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>);
    let pdfText="";
    const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
      onRender:(data:unknown)=>{pdfText=layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
    }));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");
    for(const text of [html,share,pdfText]){
      expect(text).toContain("Confirmed");expect(text).toContain("Business listings");
      expect(text).toContain("Coverage for this finding");
      if(name==="public")expect(text).toContain("Not detected");
      expect(text).not.toContain("/payload/");
    }
    expect(JSON.stringify(report)).toBe(before);
  });
  it.each(["not_detected","not_checked","not_assessed"] as const)("uses neutral %s client copy while retaining advisor observations",status=>{
    const {delivery}=labelledDelivery();
    const finding=delivery.document.findings[0];finding.status=status;
    finding.observed_fact="The saved search sample for plumber did not contain the client site domain.";
    finding.judgment="Correct the missing phone immediately.";finding.impact_path="This caused lost leads.";
    const before=JSON.stringify(finding);
    const copy=readerFinding(finding);
    expect(copy.observed_fact).toBe(finding.observed_fact);
    expect(copy.judgment).not.toContain("Correct the missing");
    expect(copy.impact_path).not.toContain("caused lost leads");
    const client=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>);
    const owner=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document} technicalDetails/>);
    expect(client).toContain(finding.observed_fact);expect(owner).toContain(finding.observed_fact);
    expect(client).not.toContain("Confirm the relevant details and checked scope before drawing a conclusion.");
    expect(JSON.stringify(finding)).toBe(before);
  });
  it("keeps inference separate from fact and leaves historical labels unknown",()=>{
    const {delivery}=labelledDelivery();
    const f=delivery.document.findings[0];f.kind="inference";f.status="not_assessed";
    expect(findingLabels(f)).toMatchObject({kind:"Inference",status:"Not assessed"});
    expect(readerFinding(f).judgment).toContain("not a confirmed fact");
    const old=generatedDelivery("public-3.json").delivery.document;
    expect(findingLabels(old.findings[0])).toEqual({kind:"Unlabelled",status:"Unlabelled",coverage:[]});
    expect(renderToStaticMarkup(<CapabilityReportDocument document={old}/>)).toContain("Coverage: Unlabelled");
  });
  it("rejects missing labels, fabricated factual confirmation and labels on historical versions",()=>{
    const report=labelledDelivery().report;
    for(const mutate of [
      (raw:typeof report)=>{delete raw.findings[0].status;},
      (raw:typeof report)=>{raw.findings[0].kind="inference";raw.findings[0].status="confirmed";},
      (raw:typeof report)=>{raw.schema_version="2.2.2";},
      (raw:typeof report)=>{raw.findings[0].coverage=null;},
    ]){const raw=structuredClone(report);mutate(raw);expect(validateCapabilityReport(raw).ok).toBe(false);}
  });
});


function pdfContactSection(node: unknown): string {
  const n=node as {type?:string;children?:unknown[]}|undefined;
  if(n?.type === "VIEW" && n.children?.some(child=>
    (child as {type?:string}).type === "TEXT" && layoutText(child)==="Business details check")) return layoutText(n);
  return n?.children?.map(pdfContactSection).find(Boolean) ?? "";
}

async function customerSurfaces(delivery: ReturnType<typeof labelledDelivery>["delivery"], contactOnly=false) {
  let pdfText="";
  const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
    onRender:(data:unknown)=>{pdfText=(contactOnly?pdfContactSection:layoutText)((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(pdf.subarray(0,4).toString()).toBe("%PDF");
  return [renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),
    renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>),pdfText]
    .map((text,index)=>contactOnly && index<2 ? text.match(/<section aria-label="Business details check"[\s\S]*?<\/section>/)?.[0] ?? "" : text);
}

describe("P0-06 mid-review decisions",()=>{
  it.each([
    ["structured","Phone · Matches business profile"],
    ["text_pattern","Address · Matches business profile · based on text recognition · street only · other address parts not compared"],
    ["rendered","Phone · Matches business profile · based on a rendered page · phone number only"],
    ["not_checked","Phone · Not checked"],
  ])("shows %s contact checks in web/share/PDF",async(caseName,expected)=>{
    const {report,delivery}=labelledDelivery(`contact-${caseName}`), before=JSON.stringify(report);
    const record=delivery.document.contactChecks!.find(c=>c.field===(caseName==="text_pattern"?"address":"phone"))!;
    expect(contactCheckLabel(record)).toBe(expected);
    for(const text of await customerSurfaces(delivery)){
      expect(text).toContain("Business details check");expect(text).toContain(expected);
      expect(text).not.toContain("remaining_address_components");expect(text).not.toContain("text_pattern");
      expect(text).not.toContain("/payload/");
    }
    expect(JSON.stringify(report)).toBe(before);
  });
  it("does not invent a contact section for historical reports in web/share/PDF",async()=>{
    const {delivery}=generatedDelivery("public-3.json");
    for(const text of await customerSurfaces(delivery)) expect(text).not.toContain("Business details check");
  });
  it("preserves distinct observations for multiple not-detected findings in web/share/PDF",async()=>{
    const {delivery}=labelledDelivery();
    const template=delivery.document.findings[0];
    const observations=["The saved maps sample for plumber did not contain the client site domain.",
      "The saved maps sample for drain repair did not contain the client site domain.",
      "The saved organic sample for water heater did not contain the client site domain."];
    delivery.document.findings=observations.map((observed_fact,index)=>({...template,id:`observation-${index}`,
      status:"not_detected",observed_fact,judgment:"Old judgment",impact_path:"Old impact"}));
    for(const text of await customerSurfaces(delivery)){
      for(const observation of observations) expect(text).toContain(observation);
      expect(text).toContain("Not detected in the checked sample. This does not show that it is absent.");
      expect(text).not.toContain("Old judgment");expect(text).not.toContain("Old impact");
      expect(text).not.toContain("Confirm the relevant details and checked scope before drawing a conclusion.");
    }
    const advisor=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document} technicalDetails/>);
    expect(advisor).toContain("Old judgment");expect(advisor).toContain("Old impact");
    expect(new Set(delivery.document.findings.map(f=>readerFinding(f).observed_fact)).size).toBe(3);
  });
  it("rejects missing contact records, duplicate fields and unknown evidence",()=>{
    const {report}=labelledDelivery("contact-structured");
    for(const mutate of [
      (raw:typeof report)=>{delete raw.contact_checks;},
      (raw:typeof report)=>{Reflect.deleteProperty(raw.contact_checks![0]!,"result");},
      (raw:typeof report)=>{Reflect.set(raw.contact_checks![0]!,"result","confirmed");},
      (raw:typeof report)=>{raw.contact_checks![1]=raw.contact_checks![0];},
      (raw:typeof report)=>{raw.contact_checks![0]!.evidence_ids=["unbound-evidence"];},
    ]){const raw=structuredClone(report);mutate(raw);expect(validateCapabilityReport(raw).ok).toBe(false);}
  });
});


describe("P0-06 final-review contact result",()=>{
  it("shows a structured mismatch as Differs, never Confirmed, in the web/share/PDF contact section",async()=>{
    const {report,delivery}=labelledDelivery("contact-mismatch");
    const before=JSON.stringify(report);
    const check=report.contact_checks!.find(c=>c.field==="phone")!;
    expect(check).toMatchObject({status:"confirmed",result:"mismatch",basis:"structured"});
    expect(report.findings.find(f=>f.rule_id==="v22_public.gbp_phone_alignment")!.status).toBe("confirmed");
    for(const text of await customerSurfaces(delivery,true)){
      expect(text).toContain("Business details check");
      expect(text).toContain("Phone · Differs from business profile");
      expect(text).not.toContain("Confirmed");
      expect(text).not.toContain("Phone · Matches business profile");
    }
    expect(JSON.stringify(report)).toBe(before);
  });
  it("distinguishes partial comparison from an unobserved site value",()=>{
    const {report}=labelledDelivery("contact-text_pattern");
    const address=report.contact_checks!.find(c=>c.field==="address")!;
    expect(contactCheckLabel({...address,result:"partial_match",compared_components:["postal"]}))
      .toBe("Address · Partly matches business profile · based on text recognition · postcode only · other address parts not compared");
    expect(contactCheckLabel({...address,result:"none",status:"not_detected",basis:"structured",compared_components:[],omitted_components:[]}))
      .toBe("Address · Not detected on the site");
  });
});
