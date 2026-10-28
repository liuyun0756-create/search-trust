import {describe,expect,it,vi} from "vitest";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {renderToBuffer} from "@react-pdf/renderer";
import {ReviewPDFDocument} from "./pdf";
import {deliveryFixture} from "./test-support";
import {projectReviewDelivery} from "./projection";
vi.mock("server-only",()=>({}));
describe("review approved PDF",()=>{
  it.each([false,true])("renders exact approved summary and zero-action state (%s)",async zero=>{
    const {report,saved}=deliveryFixture(zero);saved.content.summary="APPROVED REVIEW SUMMARY FOR CLIENT";const d=projectReviewDelivery(report,saved),before=JSON.stringify(d);
    const pdf=await renderToBuffer(ReviewPDFDocument({delivery:d,branding:{enabled:true,agencyName:"Independent SEO",agencyLogoData:null,clientName:"Client Business",footerNote:"Approved for discussion"}}));
    expect(pdf.subarray(0,4).toString()).toBe("%PDF");expect(pdf.byteLength).toBeGreaterThan(4000);expect(JSON.stringify(d)).toBe(before);
    if(process.env.V22_PDF_OUTPUT_DIR){await mkdir(process.env.V22_PDF_OUTPUT_DIR,{recursive:true});await writeFile(path.join(process.env.V22_PDF_OUTPUT_DIR,`review-${zero?"zero":"work"}.pdf`),pdf);}
  });
  it("refuses remote logos and unsupported text",()=>{const {report,saved}=deliveryFixture(),d=projectReviewDelivery(report,saved);
    expect(()=>ReviewPDFDocument({delivery:d,branding:{enabled:true,agencyName:null,clientName:null,footerNote:null,agencyLogoData:"https://other.test/logo.png"}})).toThrow("CAPABILITY_PDF_LOGO_INVALID");
    d.title="Missing \u{10ffff}";expect(()=>ReviewPDFDocument({delivery:d})).toThrow("CAPABILITY_PDF_UNSUPPORTED_TEXT");});
});
