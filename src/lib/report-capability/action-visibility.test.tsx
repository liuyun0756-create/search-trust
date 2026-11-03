import React from "react";
import {readFileSync} from "node:fs";
import {renderToStaticMarkup} from "react-dom/server";
import {renderToBuffer} from "@react-pdf/renderer";
import {describe,it,expect} from "vitest";
import fixture from "./fixtures/labelled/public.json";
import {generatedDelivery} from "./fixtures/generated-delivery";
import {actionNeedsVerification,clientActionIds,editableVisibility} from "./action-visibility";
import {initialCapabilityRevision} from "./revision";
import {validateCapabilityReport,validateDeliveryRevision} from "./validate";
import {projectCapabilityReport} from "./projection";
import {buildApprovedCapabilityDelivery} from "./delivery";
import type {CapabilityReport,DeliveryRevision} from "./generated/types";
import {CapabilityReportDocument} from "@/components/report/CapabilityReportDocument";
import {CapabilitySharedReport} from "@/components/report/CapabilitySharedReport";
import {CapabilityReportPDFDocument} from "@/components/report/pdf/CapabilityReportPDFDocument";

function report(value:unknown=fixture):CapabilityReport {
  const result=validateCapabilityReport(structuredClone(value));
  if(!result.ok)throw new Error("Invalid labelled report");
  return result.report;
}
function approved(r:CapabilityReport,c=initialCapabilityRevision(r)) {
  const content={...c,status:"approved" as const};
  return buildApprovedCapabilityDelivery(r,{id:"00000000-0000-0000-0000-000000009999",report_id:r.id,
    user_id:r.input_manifest.user_id,case_id:r.input_manifest.case_id,revision:content.expected_revision+1,
    status:"approved",approved_at:r.generated_at,content});
}
function layoutText(node:unknown):string {
  const n=node as {type?:string;value?:string;children?:unknown[]}|undefined;
  return n?.type==="TEXT_INSTANCE"?n.value??"":n?.children?.map(layoutText).join("\n")??"";
}
async function surfaces(delivery:ReturnType<typeof approved>){
  let pdfText="";
  const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
    onRender:(data:unknown)=>{pdfText=layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(pdf.subarray(0,4).toString()).toBe("%PDF");
  return [renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),
    renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="fixture"/>),pdfText];
}

describe("P0-07 action visibility",()=>{
  it("uses every finding's status OR low confidence, retaining any confirmed non-low basis",()=>{
    const r=report(),action=r.actions[0]!,other=r.findings[1];
    action.finding_ids=[r.findings[0].id,other.id];
    r.findings[0].status="not_detected";r.findings[0].confidence="high";
    other.status="confirmed";other.confidence="low";
    expect(actionNeedsVerification(r,action.id)).toBe(true);
    other.confidence="medium";expect(actionNeedsVerification(r,action.id)).toBe(false);
    other.status="not_checked";expect(actionNeedsVerification(r,action.id)).toBe(true);
  });
  it("hides only unsupported actions in customer surfaces and keeps them in the advisor view",async()=>{
    const r=report(),before=JSON.stringify(r),delivery=approved(r);
    const hidden=r.actions.filter(a=>actionNeedsVerification(r,a.id));
    const visible=r.actions.filter(a=>!actionNeedsVerification(r,a.id));
    expect(hidden.length).toBeGreaterThan(0);expect(visible.length).toBeGreaterThan(0);
    for(const text of await surfaces(delivery)){
      for(const a of hidden)expect(text).not.toContain(a.title);
      for(const a of visible)expect(text).toContain(a.title);
    }
    expect(delivery.document.actions.map(a=>a.sequence)).toEqual(visible.map((_,i)=>i+1));
    const advisor=renderToStaticMarkup(<CapabilityReportDocument document={projectCapabilityReport(r)} technicalDetails/>);
    expect(advisor).toContain("建议先核实");for(const a of hidden)expect(advisor).toContain(a.title);
    expect(JSON.stringify(r)).toBe(before);
  });
  it("renders an empty plan without inventing work and supports explicitly adding an action back",async()=>{
    const r=report();r.findings.forEach(f=>f.status="not_checked");
    const c=initialCapabilityRevision(r);expect(c.client_action_ids).toEqual([]);
    const empty=approved(r,c);expect(empty.document.actions).toEqual([]);
    for(const text of await surfaces(empty)){
      expect(text).toMatch(/No action proposed/);
      for(const a of r.actions)expect(text).not.toContain(a.title);
    }
    c.client_action_ids=[r.actions[0]!.id];
    expect(validateDeliveryRevision(c,r)).toBe(true);
    for(const text of await surfaces(approved(r,c)))expect(text).toContain(r.actions[0]!.title);
  });
  it("leaves historical approved deliveries unchanged and upgrades labelled v1 drafts without assuming inclusion",()=>{
    const old=generatedDelivery("public-3.json"),c=initialCapabilityRevision(old.report);
    expect(c.schema_version).toBe("v22_delivery_revision_v1");expect(c).not.toHaveProperty("client_action_ids");
    expect(clientActionIds(old.report,c)).toEqual(old.report.actions.map(a=>a.id));
    expect(old.delivery.document.actions.map(a=>a.id)).toEqual(old.report.actions.map(a=>a.id));
    const r=report(),initial=initialCapabilityRevision(r),legacy={...initial,schema_version:"v22_delivery_revision_v1" as const};
    delete legacy.client_action_ids;
    expect(editableVisibility(r,legacy)).toEqual(initial);
    expect(approved(r,legacy).document.actions.map(a=>a.id)).toEqual(clientActionIds(r));
  });
  it("rejects unversioned, missing, duplicate or invented client selections",()=>{
    const r=report(),c=initialCapabilityRevision(r);
    for(const mutate of [
      (v:DeliveryRevision)=>{delete v.client_action_ids;},
      (v:DeliveryRevision)=>{v.client_action_ids=null;},
      (v:DeliveryRevision)=>{v.client_action_ids=[r.actions[0]!.id,r.actions[0]!.id];},
      (v:DeliveryRevision)=>{v.client_action_ids=["invented"];},
      (v:DeliveryRevision)=>{v.schema_version="v22_delivery_revision_v1";},
    ]){const bad=structuredClone(c);mutate(bad);expect(validateDeliveryRevision(bad,r)).toBe(false);}
  });
  it.skipIf(!process.env.P007_NOVA_REPORT_PATH)("keeps Nova's mixed-basis recheck and filters a weak-only control with explicit add-back",async()=>{
    const r=report(JSON.parse(readFileSync(process.env.P007_NOVA_REPORT_PATH!,"utf8")));
    const recheck=r.actions.find(a=>a.title==="Comparable search recheck")!;expect(recheck).toBeDefined();
    const bases=r.findings.filter(f=>recheck.finding_ids.includes(f.id));
    expect(bases.filter(f=>f.status==="confirmed" && f.confidence==="medium")).toHaveLength(3);
    expect(bases.filter(f=>f.status==="not_detected" && f.confidence==="low")).toHaveLength(1);
    const before=JSON.stringify(r);
    expect(actionNeedsVerification(r,recheck.id)).toBe(false);
    for(const text of await surfaces(approved(r)))expect(text).toContain(recheck.title);
    const weak=structuredClone(r);
    // Synthetic control only; never rewrite Nova's real or frozen observations.
    weak.findings.filter(f=>recheck.finding_ids.includes(f.id)).forEach(f=>f.status="not_checked");
    for(const text of await surfaces(approved(weak)))expect(text).not.toContain(recheck.title);
    const advisor=renderToStaticMarkup(<CapabilityReportDocument document={projectCapabilityReport(weak)} technicalDetails/>);
    expect(advisor).toContain(recheck.title);expect(advisor).toContain("建议先核实");
    const c=initialCapabilityRevision(weak);c.client_action_ids=[recheck.id];
    for(const text of await surfaces(approved(weak,c)))expect(text).toContain(recheck.title);
    expect(JSON.stringify(r)).toBe(before);
  });
});
