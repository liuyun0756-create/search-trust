import {createClient} from "@supabase/supabase-js";
import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {PrivateAttachmentStorage} from "./storage";
import {BUCKET,MAX_FILE_BYTES,MIME} from "./contracts";
import {pdf,fileId} from "./test-fixture";

// Actual SDK with a deterministic HTTP transport, not real Supabase Storage acceptance.
function setup(options:{missing?:string;public?:boolean;failDelete?:boolean}={}) {
  const calls:{path:string;method:string;headers:Headers}[]=[];let bytes:Uint8Array|null=null;
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(String(input)),method=init?.method??"GET";calls.push({path:url.pathname,method,headers:new Headers(init?.headers)});
    if(url.pathname===`/storage/v1/bucket/${BUCKET}`)return Response.json({id:BUCKET,name:BUCKET,public:options.public??false,file_size_limit:MAX_FILE_BYTES,allowed_mime_types:[...MIME]});
    if(method==="POST") {bytes=pdf;return Response.json({Key:`${BUCKET}/files/${fileId}`,Id:fileId});}
    if(method==="DELETE") {if(options.failDelete)return Response.json({message:"private failure",statusCode:"500"},{status:500});bytes=null;return Response.json([{name:`files/${fileId}`}]);}
    if(options.missing||!bytes)return Response.json({message:"Object not found",code:options.missing??"NoSuchKey"},{status:404});
    return new Response(new Uint8Array(bytes),{headers:{"content-type":"application/pdf"}});
  };
  const db=createClient("https://storage.example.invalid","test-only-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetcher}});
  return {s:new PrivateAttachmentStorage(db),calls};
}
describe("private attachment SDK protocol",()=>{
  it("uploads, authenticates downloads, and confirms deletion through actual SDK paths",async()=>{
    const m=setup(),key=`files/${fileId}`;await m.s.upload(key,pdf,"application/pdf");expect(await m.s.read(key)).toEqual(pdf);await m.s.remove(key);expect(await m.s.read(key)).toBeNull();
    expect(m.calls.every(c=>!c.path.includes("/public/")&&!c.path.includes("/sign/"))).toBe(true);
    expect(m.calls.every(c=>c.headers.get("authorization")==="Bearer test-only-key")).toBe(true);
    expect(m.calls.find(c=>c.method==="POST")?.headers.get("x-upsert")).toBe("false");
  });
  it.each(["NoSuchKey","404"])("recognizes specific object absence %s",async missing=>{
    expect(await setup({missing}).s.read(`files/${fileId}`)).toBeNull();
  });
  it.each(["NoSuchBucket","AccessDenied","InternalError"])("does not mistake %s for absence",async missing=>{
    await expect(setup({missing}).s.read(`files/${fileId}`)).rejects.toThrow("UNAVAILABLE");
  });
  it("public bucket is rejected before object access",async()=>{
    const m=setup({public:true});await expect(m.s.read(`files/${fileId}`)).rejects.toThrow("UNAVAILABLE");expect(m.calls).toHaveLength(1);
  });
  it("failed removal is not acknowledged",async()=>{
    const m=setup({failDelete:true});await expect(m.s.remove(`files/${fileId}`)).rejects.toThrow("UNAVAILABLE");
  });
});
