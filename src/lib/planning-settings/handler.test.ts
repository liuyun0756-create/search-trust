import {describe,expect,it,vi} from "vitest";
import {createPlanningSettingsHandlers} from "./handler";
import {PlanningSettingsError} from "./repository";
import {defaultPlanningSettings} from "./contracts";
vi.mock("server-only",()=>({}));
const owner="00000000-0000-4000-8000-000000000001",caseId="00000000-0000-4000-8000-000000000002";
const view={caseId,siteUrl:"https://client.example/",revision:0,settings:defaultPlanningSettings()};
function setup(){const repo={read:vi.fn(async()=>view),save:vi.fn(async()=>({...view,revision:1}))};return {repo,deps:{enabled:()=>true,user:async()=>({userId:owner}),repository:()=>repo}};}
const context={params:Promise.resolve({id:caseId})};
function put(body:unknown={expectedRevision:0,settings:view.settings},headers:Record<string,string>={}){return new Request(`http://localhost/api/v2/cases/${caseId}/planning-settings`,{
  method:"PUT",headers:{origin:"http://localhost","content-type":"application/json",...headers},body:typeof body==="string"?body:JSON.stringify(body)});}
describe("private, bounded planning-settings API",()=>{
  it("reads without starting a task and passes the authenticated owner and expected revision on save",async()=>{
    const {deps,repo}=setup(),h=createPlanningSettingsHandlers(deps);
    const read=await h.GET(new Request("http://localhost/"),context);expect(read.status).toBe(200);expect(read.headers.get("cache-control")).toContain("no-store");expect(repo.save).not.toHaveBeenCalled();
    expect((await h.PUT(put(),context)).status).toBe(200);expect(repo.save).toHaveBeenCalledWith(owner,caseId,0,view.settings);
  });
  it.each(["disabled","signed-out","origin","cross-site","oversize","extra"])("rejects %s before saving",async kind=>{
    const {deps,repo}=setup();if(kind==="disabled")deps.enabled=()=>false;if(kind==="signed-out")Object.assign(deps,{user:async()=>null});
    const request=kind==="origin"?put(undefined,{origin:"https://other.example"}):kind==="cross-site"?put(undefined,{"sec-fetch-site":"cross-site"})
      :kind==="oversize"?put("a".repeat(50001)):kind==="extra"?put({expectedRevision:0,settings:view.settings,userId:owner}):put();
    const result=await createPlanningSettingsHandlers(deps).PUT(request,context);
    expect(result.status).toBe(kind==="disabled"?404:kind==="signed-out"?401:kind==="oversize"?413:kind==="extra"?400:403);expect(repo.save).not.toHaveBeenCalled();
  });
  it("returns a conflict without hiding or overwriting the submitted version",async()=>{
    const {deps,repo}=setup();repo.save.mockRejectedValue(new PlanningSettingsError("CONFLICT"));
    const result=await createPlanningSettingsHandlers(deps).PUT(put(),context);expect(result.status).toBe(409);expect(await result.json()).toMatchObject({error:{code:"CONFLICT"}});
  });
});
