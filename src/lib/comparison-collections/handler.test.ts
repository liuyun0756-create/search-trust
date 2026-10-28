import {describe,it,expect,vi} from "vitest";
import {createComparisonHandlers} from "../comparison-checks/handler";
import {record,target} from "../comparison-checks/test-fixture";
import {collectionContext,collectionView,collectionId,choice} from "./test-fixture";
import {parseCollectionContext,parseCollectionView} from "./contracts";
import {isComparisonCollectionsEnabled} from "./config";
const url=`https://app.test/api/v2/cases/${target.caseId}/reports/${target.reportId}/comparison-collections?deliveryRevisionId=${target.deliveryRevisionId}`;
const route={params:Promise.resolve({id:target.caseId,reportId:target.reportId})};
const options={kind:"collection" as const,enabled:()=>true,user:async()=>({userId:record.user_id}),config:()=>({baseUrl:"https://backend.test",token:"test"})};
const request=()=>new Request(url,{method:"POST",headers:{origin:"https://app.test","Content-Type":"application/json"},body:JSON.stringify({collectionId,selection:choice})});
describe("explicit collection boundary",()=>{
  it("read-only context and owner-derived request",async()=>{
    const calls:Record<string,unknown>[]=[];
    const handlers=createComparisonHandlers({...options,fetch:async(_url,init)=>{const c=JSON.parse(init!.body as string);calls.push(c);return Response.json(c.operation==="context"?collectionContext:collectionView());}});
    expect((await handlers.GET(new Request(url),route)).status).toBe(200);
    const result=await handlers.POST(request(),route);expect(result.status).toBe(200);
    expect(calls.map(c=>c.operation)).toEqual(["context","request"]);
    expect(calls[1]).toMatchObject({user_id:record.user_id,collection_id:collectionId,selection:choice});
    expect(calls[1]).not.toHaveProperty("comparison_id");expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["disabled","signed_out","cross_origin","extra","bad_id"])("rejects %s before backend",async kind=>{
    const backend=vi.fn();let req=request();
    if(kind==="cross_origin")req.headers.set("origin","https://evil.test");
    if(kind==="extra")req=new Request(url,{method:"POST",headers:{origin:"https://app.test","Content-Type":"application/json"},body:JSON.stringify({collectionId,selection:choice,user_id:record.user_id})});
    if(kind==="bad_id")req=new Request(url.replace(target.caseId,"bad"),{method:"POST"});
    const h=createComparisonHandlers({...options,enabled:()=>kind!=="disabled",user:async()=>kind==="signed_out"?null:{userId:record.user_id},fetch:backend});
    expect((await h.POST(req,kind==="bad_id"?{params:Promise.resolve({id:"bad",reportId:target.reportId})}:route)).status).toBeGreaterThanOrEqual(400);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each(["wrong_report","wrong_id","window","private_payload","selection","status"])("rejects %s reply",async kind=>{
    const value=structuredClone(collectionView()) as Record<string,any>;
    if(kind==="wrong_report")value.report_id=collectionId;
    if(kind==="wrong_id")value.id=choice.binding_id;
    if(kind==="window")value.windows.after.end="2026-12-31";
    if(kind==="private_payload")value.snapshot={secret:"not for browser"};
    if(kind==="selection")value.selection.days=7;
    if(kind==="status")value.status="succeeded";
    const h=createComparisonHandlers({...options,fetch:async()=>Response.json(value)});
    expect((await h.POST(request(),route)).status).toBe(503);
  });
  it("context rejects duplicates and invalid projected history",()=>{
    expect(parseCollectionContext(collectionContext,target)).toBeTruthy();
    const invalid=structuredClone(collectionContext);invalid.bindings.push(invalid.bindings[0]);
    expect(parseCollectionContext(invalid,target)).toBeNull();
    expect(parseCollectionView(collectionView(),target,collectionId,choice)).toBeTruthy();
  });
  it("collection flag requires all existing guards",()=>{
    vi.stubEnv("V22_COMPARISON_COLLECTIONS_ENABLED","true");vi.stubEnv("V22_COMPARISONS_ENABLED","false");
    expect(isComparisonCollectionsEnabled()).toBe(false);vi.unstubAllEnvs();
  });
});
