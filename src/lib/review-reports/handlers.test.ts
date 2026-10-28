import {afterEach,describe,expect,it,vi} from "vitest";
import {createReviewDeliveryHandlers,reviewRequestOrigin} from "./handlers";
import {deliveryFixture} from "./test-support";
import {ReviewDeliveryError,type ReviewDeliveryRepository} from "./repository";
import type {ReviewShareService} from "./shares";
vi.mock("server-only",()=>({}));
function setup(){const {report,saved}=deliveryFixture();const repository={report:vi.fn(async()=>report),save:vi.fn(async()=>saved),revision:vi.fn(async()=>saved)};
  const deps={getCurrentUser:vi.fn(async()=>({userId:saved.user_id})),isEnabled:vi.fn(()=>true),repository:()=>repository as unknown as ReviewDeliveryRepository,
    shares:()=>({list:vi.fn(async(_u:string,_c:string,_r:string)=>[])} as unknown as ReviewShareService),pdf:vi.fn(async(_d:unknown,_b?:unknown)=>new Response("PDF",{headers:{"Content-Type":"application/pdf"}}))};
  const handlers=createReviewDeliveryHandlers(deps);return {report,saved,repository,deps,handlers,context:{params:Promise.resolve({id:saved.case_id,reportId:report.id})},q:{id:saved.id,content:saved.content,review_confirmed:true}};}
const req=(body:unknown,headers={})=>new Request("https://app.test/api/review",{method:"POST",headers:{"Content-Type":"application/json",origin:"https://app.test",...headers},body:JSON.stringify(body)});
describe("authenticated review delivery routes",()=>{
  it("saves exact confirmed wording under owner identity with no-store headers",async()=>{const f=setup(),r=await f.handlers.save(req(f.q),f.context);expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toContain("no-store");expect(f.repository.save).toHaveBeenCalledWith(f.saved.user_id,f.saved.case_id,f.report,f.q);});
  it.each(["disabled","signed_out","cross_site","bad_body","duplicate","large","unknown_fact"])("blocks %s before saving",async kind=>{
    const f=setup();let request=req(f.q);
    if(kind==="disabled")f.deps.isEnabled.mockReturnValue(false);
    if(kind==="signed_out")f.deps.getCurrentUser.mockResolvedValue(null as never);
    if(kind==="cross_site")request=req(f.q,{origin:"https://other.test"});
    if(kind==="bad_body")request=req({});
    if(kind==="unknown_fact")request=req({...f.q,content:{...f.q.content,observed_fact:"changed"}});
    if(kind==="duplicate")request=new Request("https://app.test/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"id":1,"id":2}'});
    if(kind==="large")request=req({text:"x".repeat(100001)});
    expect((await f.handlers.save(request,f.context)).status).toBeGreaterThanOrEqual(400);expect(f.repository.save).not.toHaveBeenCalled();
  });
  it("requires the current approved revision for a PDF, passing branding only to the renderer",async()=>{
    const f=setup();expect((await f.handlers.pdf(req({expectedRevision:1,branding:{agency_name:"My SEO practice"}}),f.context)).status).toBe(200);
    expect(f.deps.pdf.mock.calls[0][0]).not.toHaveProperty("seo_actions");expect(f.deps.pdf.mock.calls[0][1]).toMatchObject({agencyName:"My SEO practice"});
    expect((await f.handlers.pdf(req({expectedRevision:2}),f.context)).status).toBe(409);
    f.repository.revision.mockResolvedValue({...f.saved,status:"draft"});expect((await f.handlers.pdf(req({expectedRevision:1}),f.context)).status).toBe(409);
  });
  it("keeps a conflicting save distinct from an unknown failure",async()=>{const f=setup();f.repository.save.mockRejectedValue(new ReviewDeliveryError("CONFLICT"));expect((await f.handlers.save(req(f.q),f.context)).status).toBe(409);f.repository.save.mockRejectedValue(Error("private database details"));const response=await f.handlers.save(req(f.q),f.context);expect(response.status).toBe(503);expect(await response.text()).not.toContain("private database");});
  it("accepts the browser request host instead of an internal Next hostname",async()=>{
    const f=setup(),request=new Request("http://localhost:3247/api/review",{method:"POST",headers:{host:"127.0.0.1:3247",origin:"http://127.0.0.1:3247","content-type":"application/json"},body:JSON.stringify(f.q)});
    expect(reviewRequestOrigin(request)).toBe("http://127.0.0.1:3247");expect((await f.handlers.save(request,f.context)).status).toBe(200);
    expect(()=>reviewRequestOrigin(new Request("https://app.test",{headers:{host:"app.test/evil"}}))).toThrow();
    expect(reviewRequestOrigin(new Request("https://app.test",{headers:{"x-forwarded-host":"evil.test"}}))).toBe("https://app.test");
  });
});
