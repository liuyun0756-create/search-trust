import { describe,expect,it,vi } from "vitest";
import { createCapabilityRevisionHandlers } from "./revision-handler";
import { CapabilityPersistenceError } from "./repository";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { initialCapabilityRevision } from "./revision";
vi.mock("server-only",()=>({}));

function setup() {
  const {report,saved} = generatedDelivery("service-first.json"), m=report.input_manifest;
  const repository={loadCompletedReport:vi.fn(async()=>report),loadRevision:vi.fn(async()=>saved),saveRevision:vi.fn(async()=>saved)};
  const deps={getCurrentUser:vi.fn(async():Promise<{userId:string}|null>=>({userId:m.user_id})),isEnabled:vi.fn(()=>true),repository:vi.fn(()=>repository)};
  const handlers=createCapabilityRevisionHandlers(deps);
  const context={params:Promise.resolve({id:m.case_id,reportId:report.id})};
  const request=(body:unknown={content:saved.content,reviewConfirmed:true},headers:Record<string,string>={})=>new Request(`http://localhost/api/v2/cases/${m.case_id}/reports/${report.id}/content-revision`,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
  return {report,saved,repository,deps,handlers,context,request};
}
describe("completed report owner revision API",()=>{
  it.each(["anonymous","disabled","unowned"])("does not expose or save %s reports",async(kind)=>{
    const f=setup();
    if(kind==="anonymous") f.deps.getCurrentUser.mockResolvedValue(null);
    if(kind==="disabled") f.deps.isEnabled.mockReturnValue(false);
    if(kind==="unowned") f.repository.loadCompletedReport.mockResolvedValue(null as never);
    const response=await f.handlers.POST(f.request(),f.context);
    expect(response.status).toBe(kind==="anonymous"?401:404);
    expect(f.repository.saveRevision).not.toHaveBeenCalled();
    expect(f.repository.loadRevision).not.toHaveBeenCalled();
    if(kind!=="unowned") expect(f.deps.repository).not.toHaveBeenCalled();
  });
  it.each(["original","draft","approved"])("reloads %s at the next expected revision without approval promotion",async(kind)=>{
    const f=setup();
    if(kind==="original") f.repository.loadRevision.mockResolvedValue(null as never);
    else if(kind==="draft") { f.saved.status=f.saved.content.status="draft";f.saved.approved_at=null; }
    const response=await f.handlers.GET(f.request(),f.context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const value=await response.json();
    expect(value.status).toBe(kind);
    expect(value.content.expected_revision).toBe(kind==="original"?0:1);
    if(kind==="original") expect(value.content).toEqual(initialCapabilityRevision(f.report));
  });
  it.each(["draft","approved"] as const)("saves %s only through the completed-report boundary",async(kind)=>{
    const f=setup(); f.saved.status=f.saved.content.status=kind;
    const response=await f.handlers[kind==="draft"?"PUT":"POST"](f.request(),f.context);
    expect(response.status).toBe(200);
    expect(f.repository.loadCompletedReport).toHaveBeenCalledWith(f.report.input_manifest.user_id,f.report.input_manifest.case_id,f.report.id);
    expect(f.repository.saveRevision).toHaveBeenCalledWith(f.report.input_manifest.user_id,f.report.input_manifest.case_id,f.report,f.saved.content);
    expect(await response.json()).toEqual({ok:true,revision:1,content:f.saved.content});
  });
  it.each(["confirmation","user","case","report","source","evidence","status","material","oversize","extra"])("rejects %s without writing",async(kind)=>{
    const f=setup(),body:Record<string,unknown>={content:structuredClone(f.saved.content),reviewConfirmed:true};
    const content=body.content as typeof f.saved.content;
    if(kind==="confirmation") body.reviewConfirmed=false;
    if(kind==="user") content.user_id="00000000-0000-0000-0000-000000000099";
    if(kind==="case") content.case_id="00000000-0000-0000-0000-000000000099";
    if(kind==="report") content.report_id="00000000-0000-0000-0000-000000000099";
    if(kind==="source") content.source_checksum=`sha256:${"0".repeat(64)}`;
    if(kind==="evidence") Object.assign(content,{evidence:[]});
    if(kind==="status") content.status="draft";
    if(kind==="material") content.actions[0]!.materials[0]!.target="Invented target";
    if(kind==="oversize") content.summary="x".repeat(100_001);
    if(kind==="extra") body.report=f.report;
    expect((await f.handlers.POST(f.request(body),f.context)).status).toBe(400);
    expect(f.repository.saveRevision).not.toHaveBeenCalled();
  });
  it.each(["origin","fetch-site","content-type"])("rejects invalid %s",async(kind)=>{
    const f=setup();
    const headers:Record<string,string>=kind==="origin"?{origin:"https://attacker.invalid"}:kind==="fetch-site"?{"sec-fetch-site":"cross-site"}:{"content-type":"text/plain"};
    expect((await f.handlers.POST(f.request(undefined,headers),f.context)).status).toBe(kind==="content-type"?415:403);
    expect(f.deps.repository).not.toHaveBeenCalled();
  });
  it("maps conflicts and hides database failure details",async()=>{
    const f=setup();
    f.repository.saveRevision.mockRejectedValueOnce(new CapabilityPersistenceError("CAPABILITY_CONFLICT")).mockRejectedValueOnce(new Error("private SQL data"));
    expect((await f.handlers.POST(f.request(),f.context)).status).toBe(409);
    const response=await f.handlers.POST(f.request(),f.context);
    expect(response.status).toBe(503);expect(await response.text()).not.toContain("private SQL");
  });
});
