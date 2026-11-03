import React from "react";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
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
import type { CustomerPublicGbpSnapshots } from "./public-gbp-contracts/types";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./public-gbp-contracts/${name}.json`, import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validateSnapshot = ajv.compile<CustomerPublicGbpSnapshots>(fixture("snapshot.schema"));

function text(node: unknown): string {
  const value = node as {type?:string;value?:string;children?:unknown[]}|undefined;
  return value?.type === "TEXT_INSTANCE" ? value.value ?? "" : value?.children?.map(text).join("\n") ?? "";
}

describe("P0-05 public GBP snapshot compatibility", () => {
  it.each(["v1", "v2"])("validates %s snapshot without adding missing values", version => {
    const raw: unknown = fixture(`${version}-snapshot`), before = JSON.stringify(raw);
    expect(validateSnapshot(raw), JSON.stringify(validateSnapshot.errors)).toBe(true);
    expect(JSON.stringify(raw)).toBe(before);
    if (validateSnapshot(raw) && raw.schema_version === "customer_public_gbp_snapshot_v2") {
      expect(raw.record.fields.review_count).toEqual({state:"observed",value:1388});
      expect(raw.record.fields.photo_count).toEqual({state:"not_returned",value:null});
    }
  });
  it("rejects version disguises and invalid new numeric values", () => {
    const raw = fixture("v2-snapshot");
    raw.schema_version="customer_public_gbp_snapshot_v1";
    expect(validateSnapshot(raw)).toBe(false);
    raw.schema_version="customer_public_gbp_snapshot_v2";
    raw.record.fields.rating.value=6;
    expect(validateSnapshot(raw)).toBe(false);
  });
  it.each(["v1", "v2"])("reads, shares and exports a report using %s without mutating it", async version => {
    const raw: unknown = fixture(`${version}-report`);
    const checked=validateCapabilityReport(raw);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error("Invalid report fixture");
    const report=checked.report, before=JSON.stringify(report);
    expect(readVersionedReport(report)).toMatchObject({ok:true,version:"2.2.2"});
    const content=initialCapabilityRevision(report); content.status="approved";
    const delivery=buildApprovedCapabilityDelivery(report,{id:"00000000-0000-0000-0000-000000009999",
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
      expect(rendered).not.toContain("customer_public_gbp_snapshot");
      expect(rendered).not.toContain("1388");
    }
    expect(JSON.stringify(report)).toBe(before);
  });
});
