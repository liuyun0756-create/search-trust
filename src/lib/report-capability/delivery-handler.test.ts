import {describe,expect,it,vi} from "vitest";
import {createCapabilityDeliveryHandlers} from "./delivery-handler";
import {generatedDelivery} from "./fixtures/generated-delivery";
vi.mock("server-only",()=>({}));
function setup(){
  const {report,saved,delivery}=generatedDelivery("public-0.json"),m=report.input_manifest;
  const reports={loadCompletedReport:vi.fn(async()=>report),loadRevision:vi.fn(async()=>saved)};
  const shares={list:vi.fn(async()=>[]),create:vi.fn(),revoke:vi.fn()};
  const deps={getCurrentUser:vi.fn(async():Promise<{userId:string}|null>=>({userId:m.user_id})),isEnabled:vi.fn(()=>true),reports:()=>reports,shares:()=>shares,pdf:vi.fn(async()=>new Response("pdf"))};
  const handlers=createCapabilityDeliveryHandlers(deps),context={params:Promise.resolve({id:m.case_id,reportId:report.id})};
  const request=(body:unknown={expectedRevision:1},headers:Record<string,string>={})=>new Request("https://example.invalid/api/delivery",{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
  return {report,saved,delivery,reports,shares,deps,handlers,context,request};
}
describe("approved client export boundary",()=>{
  it("exports the approved zero-action diagnosis and applies branding only to the download",async()=>{
    const f=setup();const response=await f.handlers.pdf(f.request({expectedRevision:1,branding:{agency_name:"Independent SEO"}}),f.context);
    expect(response.status).toBe(200);expect(f.deps.pdf).toHaveBeenCalledWith(f.delivery,expect.objectContaining({agencyName:"Independent SEO"}));
    expect(f.saved.content.actions).toEqual([]);expect(f.shares.create).not.toHaveBeenCalled();
  });
  it.each(["anonymous","disabled","missing","unapproved","draft","stale","forged-content","cross-site","remote-logo"])("blocks %s export before rendering",async(kind)=>{
    const f=setup();let body:unknown={expectedRevision:1};let headers:Record<string,string>={};
    if(kind==="anonymous")f.deps.getCurrentUser.mockResolvedValue(null);
    if(kind==="disabled")f.deps.isEnabled.mockReturnValue(false);
    if(kind==="missing")f.reports.loadCompletedReport.mockResolvedValue(null as never);
    if(kind==="unapproved")f.reports.loadRevision.mockResolvedValue(null as never);
    if(kind==="draft")f.saved.status=f.saved.content.status="draft";
    if(kind==="stale")body={expectedRevision:2};
    if(kind==="forged-content")body={expectedRevision:1,delivery:f.delivery};
    if(kind==="cross-site")headers={origin:"https://other.invalid"};
    if(kind==="remote-logo")body={expectedRevision:1,branding:{agency_logo_data:"https://other.invalid/logo.png"}};
    expect((await f.handlers.pdf(f.request(body,headers),f.context)).status).toBeGreaterThanOrEqual(400);
    expect(f.deps.pdf).not.toHaveBeenCalled();
  });
  it("returns a safe actionable error for unsupported glyphs, not a partial PDF",async()=>{
    const f=setup();f.deps.pdf.mockRejectedValue(new Error("CAPABILITY_PDF_UNSUPPORTED_TEXT"));
    const result=await f.handlers.pdf(f.request(),f.context);expect(result.status).toBe(422);expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("creates a fragment-only link, lists metadata and revokes using authenticated route identities",async()=>{
    const f=setup(),m=f.report.input_manifest;f.shares.create.mockResolvedValue({id:"share-id",revision_id:f.saved.id,expires_at:"2026-12-01",token:"a".repeat(43)});
    const result=await f.handlers.create(f.request(),f.context);expect(result.status).toBe(201);
    expect((await result.json()).url).toBe(`https://example.invalid/share#${"a".repeat(43)}`);
    expect(f.shares.create).toHaveBeenCalledWith(m.user_id,m.case_id,f.report.id,1);
    expect((await f.handlers.list(f.request(),f.context)).status).toBe(200);
    const shareId="00000000-0000-0000-0000-000000000777";
    expect((await f.handlers.revoke(f.request(),{params:Promise.resolve({id:m.case_id,reportId:f.report.id,shareId})})).status).toBe(200);
    expect(f.shares.revoke).toHaveBeenCalledWith(m.user_id,m.case_id,f.report.id,shareId);
  });
});
