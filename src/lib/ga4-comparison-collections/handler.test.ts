import {describe,it,expect,vi} from "vitest";
import {createComparisonHandlers} from "../comparison-checks/handler";
import {record,target} from "../comparison-checks/test-fixture";
import {ga4Context,ga4View,ga4Id,ga4Choice} from "./test-fixture";
import {parseGa4Context,parseGa4View,parseGa4Selection} from "./contracts";
import {isGa4CollectionsEnabled} from "./config";
const url=`https://app.test/api/v2/cases/${target.caseId}/reports/${target.reportId}/ga4-comparison-collections?deliveryRevisionId=${target.deliveryRevisionId}`;
const route={params:Promise.resolve({id:target.caseId,reportId:target.reportId})};
const options={kind:"ga4-collection" as const,enabled:()=>true,user:async()=>({userId:record.user_id}),config:()=>({baseUrl:"https://backend.test",token:"test"})};
const request=()=>new Request(url,{method:"POST",headers:{origin:"https://app.test","Content-Type":"application/json"},body:JSON.stringify({collectionId:ga4Id,selection:ga4Choice})});
describe("GA4 owner collection boundary",()=>{
  it("uses separate endpoint and authenticated owner; context is read-only",async()=>{
    const calls:Record<string,unknown>[]=[];
    const h=createComparisonHandlers({...options,fetch:async(url,init)=>{expect(url).toBe("https://backend.test/api/v2/ga4-comparison-collections");const c=JSON.parse(init!.body as string);calls.push(c);return Response.json(c.operation==="context"?ga4Context:ga4View());}});
    expect((await h.GET(new Request(url),route)).status).toBe(200);
    const response=await h.POST(request(),route);expect(response.status).toBe(200);
    expect(calls.map(c=>c.operation)).toEqual(["context","request"]);
    expect(calls[1]).toMatchObject({user_id:record.user_id,collection_id:ga4Id,selection:ga4Choice});
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await h.GET(new Request(`${url}&collectionId=${ga4Id}`),route)).status).toBe(200);
    expect(calls[2].operation).toBe("read");
  });
  it.each(["disabled","signed_out","cross_origin","extra","bad_id"])("rejects %s before backend",async kind=>{
    const backend=vi.fn();let req=request();
    if(kind==="cross_origin")req.headers.set("origin","https://evil.test");
    if(kind==="extra")req=new Request(url,{method:"POST",headers:{origin:"https://app.test","Content-Type":"application/json"},body:JSON.stringify({collectionId:ga4Id,selection:ga4Choice,user_id:record.user_id})});
    if(kind==="bad_id")req=new Request(url.replace(target.caseId,"bad"),{method:"POST"});
    const h=createComparisonHandlers({...options,enabled:()=>kind!=="disabled",user:async()=>kind==="signed_out"?null:{userId:record.user_id},fetch:backend});
    expect((await h.POST(req,kind==="bad_id"?{params:Promise.resolve({id:"bad",reportId:target.reportId})}:route)).status).toBeGreaterThanOrEqual(400);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each(["report","id","window","timezone","path","private_payload","selection","status","metric_duplicate","event_reason","effect"])("rejects invalid %s",async kind=>{
    const v=structuredClone(ga4View(ga4Id,"succeeded"));
    if(kind==="report")v.report_id=ga4Id;
    if(kind==="id")v.id=ga4Choice.binding_id;
    if(kind==="window")v.windows.after.end="2026-12-31";
    if(kind==="timezone")v.scope.timezone="Europe/London";
    if(kind==="path")v.scope.landing_path="/other";
    if(kind==="private_payload")Object.assign(v,{snapshot:{secret:"private"}});
    if(kind==="selection")v.selection.days=7;
    if(kind==="status")v.status="queued";
    if(kind==="metric_duplicate")v.qualification!.metrics[1]=v.qualification!.metrics[0];
    if(kind==="event_reason")v.qualification!.metrics[3].reasons=["GA4_COMPLETENESS_NOT_ATTESTED"];
    if(kind==="effect")Object.assign(v.qualification!,{effect_conclusion:"effective"});
    expect(parseGa4View(v,target,ga4Id)).toBeNull();
    const h=createComparisonHandlers({...options,fetch:async()=>Response.json(v)});
    expect((await h.POST(request(),route)).status).toBe(503);
  });
  it.each(["/a b","//example.test/a","https://example.test/a","/a?b=c","/a#x","/a\\b"])("rejects non-exact path %s",path=>{
    expect(parseGa4Selection({...ga4Choice,landing_path:path})).toBeNull();
  });
  it("accepts projected qualification but not duplicate/foreign context",()=>{
    expect(parseGa4View(ga4View(ga4Id,"succeeded"),target,ga4Id)).toBeTruthy();
    expect(parseGa4Context(ga4Context,target)).toBeTruthy();
    const c=structuredClone(ga4Context);c.bindings.push(c.bindings[0]);expect(parseGa4Context(c,target)).toBeNull();
    c.bindings.pop();c.previews[0].binding_id=ga4Id;expect(parseGa4Context(c,target)).toBeNull();
  });
  it("is default-off and depends on existing capability guards",()=>{
    vi.stubEnv("V22_GA4_COMPARISON_COLLECTIONS_ENABLED","");expect(isGa4CollectionsEnabled()).toBe(false);
    vi.stubEnv("V22_GA4_COMPARISON_COLLECTIONS_ENABLED","true");vi.stubEnv("V22_COMPARISONS_ENABLED","false");
    expect(isGa4CollectionsEnabled()).toBe(false);vi.unstubAllEnvs();
  });
});
