import {describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {CapabilityShareService} from "./shares";
import type {CapabilityRepository} from "./repository";
import {generatedDelivery} from "./fixtures/generated-delivery";
import {hashReportShareToken} from "../report-shares/tokens";
vi.mock("server-only",()=>({}));
function setup() {
  const {report,saved,delivery}=generatedDelivery("service-first.json"),m=report.input_manifest;
  const token="a".repeat(43),row={id:"00000000-0000-0000-0000-000000000555",user_id:m.user_id,case_id:m.case_id,report_id:report.id,revision_id:saved.id,
    token_hash:hashReportShareToken(token),created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),revoked_at:null};
  const reports={loadCompletedReport:vi.fn(async()=>report),loadRevision:vi.fn(async()=>saved),loadApprovedDelivery:vi.fn(async()=>delivery)};
  const rpc=vi.fn(()=>({single:async()=>({data:row,error:null}),maybeSingle:async()=>({data:row,error:null})}));
  const service=new CapabilityShareService({rpc} as unknown as SupabaseClient,reports as unknown as CapabilityRepository,()=>token);
  return {report,saved,delivery,row,reports,rpc,service,token};
}
describe("capability share binding",()=>{
  it("stores only a token hash and creates only from the current approved revision",async()=>{
    const f=setup(),m=f.report.input_manifest,result=await f.service.create(m.user_id,m.case_id,f.report.id,1);
    expect(result.token).toBe(f.token);expect(result).not.toHaveProperty("token_hash");expect(result).not.toHaveProperty("user_id");
    expect(f.rpc).toHaveBeenCalledWith("create_v22_capability_share",expect.objectContaining({p_revision_id:f.saved.id,p_token_hash:hashReportShareToken(f.token)}));
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(f.token);
  });
  it.each(["missing-report","no-approval","draft","stale"])("rejects %s without inserting a share",async(kind)=>{
    const f=setup(),m=f.report.input_manifest;
    if(kind==="missing-report")f.reports.loadCompletedReport.mockResolvedValue(null as never);
    if(kind==="no-approval")f.reports.loadRevision.mockResolvedValue(null as never);
    if(kind==="draft")f.saved.status=f.saved.content.status="draft";
    await expect(f.service.create(m.user_id,m.case_id,f.report.id,kind==="stale"?2:1)).rejects.toThrow();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("reads the exact saved approval, never the newest revision, without exposing ownership metadata",async()=>{
    const f=setup(),m=f.report.input_manifest;
    const result=await f.service.resolve(f.token);
    expect(f.reports.loadApprovedDelivery).toHaveBeenCalledWith(m.user_id,m.case_id,f.report.id,f.saved.id);
    expect(result.delivery).toEqual(f.delivery);expect(result.share).not.toHaveProperty("token_hash");expect(result.share).not.toHaveProperty("user_id");
  });
  it.each(["token","revoked","expired","revision"])("rejects invalid %s on resolution",async(kind)=>{
    const f=setup();
    if(kind==="revoked")Object.assign(f.row,{revoked_at:new Date().toISOString()});
    if(kind==="expired")f.row.expires_at="2000-01-01T00:00:00Z";
    if(kind==="revision")f.delivery.revisionId="00000000-0000-0000-0000-000000000999";
    await expect(f.service.resolve(kind==="token"?"invalid":f.token)).rejects.toThrow();
    if(kind==="token")expect(f.rpc).not.toHaveBeenCalled();
  });
});
