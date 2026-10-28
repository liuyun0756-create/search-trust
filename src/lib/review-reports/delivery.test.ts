import {afterEach,describe,expect,it,vi} from "vitest";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {deliveryFixture} from "./test-support";
import {initialReviewRevision,validReviewRevision,validSaveRequest,parseSavedRevision,parseReviewReport} from "./delivery";
import {projectReviewDelivery} from "./projection";
import {isReviewDeliveryEnabled} from "./config";
import {ReviewShareService} from "./shares";
import {ReviewDeliveryRepository} from "./repository";
import type {SupabaseClient} from "@supabase/supabase-js";
import {hashReportShareToken} from "../report-shares/tokens";
vi.mock("server-only",()=>({}));
afterEach(()=>vi.unstubAllEnvs());

describe("review client delivery boundary",()=>{
  it("defaults off and requires both rollout flags",()=>{vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED","");expect(isReviewDeliveryEnabled()).toBe(false);vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED","true");expect(isReviewDeliveryEnabled()).toBe(true);vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","false");expect(isReviewDeliveryEnabled()).toBe(false);});
  it("accepts unchanged explicit approval and rejects unconfirmed approval",()=>{
    const {report,saved}=deliveryFixture();expect(validReviewRevision(saved.content,report)).toBe(true);expect(parseSavedRevision(saved,report)).toEqual(saved);
    expect(validSaveRequest({id:saved.id,content:saved.content,review_confirmed:true},report)).toBe(true);
    expect(validSaveRequest({id:saved.id,content:saved.content,review_confirmed:false},report)).toBe(false);
    expect(initialReviewRevision(report).status).toBe("draft");
  });
  it.each(["identity","source","material","fact","step","blank","extra"])("rejects unsupported %s edits",kind=>{
    const {report,saved}=deliveryFixture(),c=structuredClone(saved.content);
    if(kind==="identity")c.actions[0].id="foreign";
    if(kind==="source")c.source_checksum="sha256:"+"0".repeat(64);
    if(kind==="material")c.actions[0].materials=[];
    if(kind==="fact")Object.assign(c,{observed_fact:"rewritten"});
    if(kind==="step")c.actions[0].steps=["x".repeat(4001)];
    if(kind==="blank")c.summary=" \n";
    if(kind==="extra")Object.assign(c.actions[0],{private_note:"hidden"});
    expect(validReviewRevision(c,report)).toBe(false);
  });
  it("preserves client wording, fixed metrics and diagnosis without private decisions",()=>{
    const {report,saved}=deliveryFixture();report.content.seo_actions[0]!.selected_decision!.reason="PRIVATE_REVIEW_REASON";
    const {checksum:_,...cb}=report.content;report.content.checksum=canonicalDigest(cb);const {checksum:__,...rb}=report;report.checksum=canonicalDigest(rb);
    parseReviewReport(report);saved.content.source_checksum=canonicalDigest(report);saved.content.summary="My approved client summary.";
    const before=JSON.stringify(report),d=projectReviewDelivery(report,saved),text=JSON.stringify(d);
    expect(d.summary).toBe(saved.content.summary);expect(text).toContain("280 → 336");expect(text).toContain("100 → 125");
    for(const marker of ["PRIVATE_REVIEW_REASON",'"user_id"','"selected_decision"','"source_references"','"input_text"'])expect(text).not.toContain(marker);
    expect(JSON.stringify(report)).toBe(before);expect(d.observations[0].lines.join(" ")).toContain("First observation");
  });
  it("requires approval, including a zero-action diagnosis",()=>{
    const {report,saved}=deliveryFixture(true);expect(projectReviewDelivery(report,saved).actions).toEqual([]);
    saved.status="draft";saved.content.status="draft";saved.approved_at=null;expect(()=>projectReviewDelivery(report,saved)).toThrow("REVIEW_NEEDS_APPROVAL");
  });
  it("resolves a pinned approved revision after later drafts and never exposes the private report",async()=>{
    const {report,saved}=deliveryFixture(),token="a".repeat(43),row={id:"72000000-0000-4000-8000-000000000009",user_id:saved.user_id,case_id:saved.case_id,report_id:report.id,revision_id:saved.id,
      token_hash:hashReportShareToken(token),created_at:"2026-01-01T00:00:00Z",expires_at:"2099-01-01T00:00:00Z",revoked_at:null};
    const rpc=vi.fn(()=>({maybeSingle:async()=>({data:row,error:null})}));
    const reports={db:{rpc},report:vi.fn(async()=>report),revision:vi.fn(async()=>saved)};
    const service=new ReviewShareService(reports as unknown as ReviewDeliveryRepository);
    const resolved=await service.resolve(token);expect(reports.revision).toHaveBeenCalledWith(saved.user_id,saved.case_id,report,saved.id);
    expect(resolved.delivery.revision).toBe(1);expect(resolved).not.toHaveProperty("report");expect(resolved.share).not.toHaveProperty("token_hash");
  });
  it("validates server completed entitlement and saved body before accepting a write receipt",async()=>{
    const {report,saved}=deliveryFixture();let changed=false;
    const rpc=vi.fn(async(name:string)=>({error:null,data:name==="get_v22_completed_review_report"?{schema_version:"v22_completed_review_report_v1",report,payload_checksum:canonicalDigest(report)}:
      changed?{...saved,content:{...saved.content,summary:"wrong body"}}:saved}));
    const repository=new ReviewDeliveryRepository({rpc} as unknown as SupabaseClient);
    expect(await repository.report(saved.user_id,saved.case_id,report.id)).toEqual(report);
    const q={id:saved.id,review_confirmed:true,content:saved.content};expect(await repository.save(saved.user_id,saved.case_id,report,q)).toEqual(saved);
    changed=true;await expect(repository.save(saved.user_id,saved.case_id,report,q)).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
});
