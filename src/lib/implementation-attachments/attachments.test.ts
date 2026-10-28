import {createHash} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {AttachmentError,attachmentQuery,MAX_FILE_BYTES,safeName,validateFile} from "./contracts";
import {isImplementationAttachmentsEnabled} from "./config";
import {AttachmentService} from "./service";
import {AttachmentRepository,storedAttachment} from "./repository";
import {PrivateAttachmentStorage} from "./storage";
import {createAttachmentHandlers} from "./handler";
import {cleanupAttachments} from "./cleanup";
import {owner,target,pdf,fileId,fileView} from "./test-fixture";
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
function row(status="ready") {return {id:fileId,user_id:owner,case_id:target.caseId,report_id:target.reportId,delivery_revision_id:target.deliveryRevisionId,
  record_id:target.recordId,record_revision:1,record_checksum:target.checksum,action_id:target.actionId,file_name:"published-work.pdf",mime:"application/pdf",
  byte_size:pdf.length,digest:sha(pdf),object_key:`files/${fileId}`,status,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString()};}
function setup() {
  const a=storedAttachment(row("uploading"));
  const repo={list:vi.fn(async()=>[a.view]),read:vi.fn(async()=>a),reserve:vi.fn(async()=>({created:true,attachment:a})),
    finalize:vi.fn(async()=>{a.view.status="ready";return a;}),remove:vi.fn(async()=>{a.view.status="removing";return a;})};
  const storage={upload:vi.fn(async()=>{}),read:vi.fn(async()=>pdf as Uint8Array|null),remove:vi.fn(async()=>{})};
  return {a,repo,storage,svc:new AttachmentService(repo,storage)};
}
describe("attachment boundaries",()=>{
  it("is off by default and requires both implementation gates",()=>{
    for(const name of ["V22_CAPABILITY_DISPATCH_ENABLED","V22_IMPLEMENTATION_RECORDS_ENABLED","V22_IMPLEMENTATION_ATTACHMENTS_ENABLED"]) vi.stubEnv(name,undefined);
    expect(isImplementationAttachmentsEnabled()).toBe(false);
    vi.stubEnv("V22_IMPLEMENTATION_ATTACHMENTS_ENABLED","true");expect(isImplementationAttachmentsEnabled()).toBe(false);
    vi.stubEnv("V22_IMPLEMENTATION_RECORDS_ENABLED","true");expect(isImplementationAttachmentsEnabled()).toBe(false);
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");expect(isImplementationAttachmentsEnabled()).toBe(true);vi.unstubAllEnvs();
  });
  it.each([["x.pdf","application/pdf",pdf],["x.PNG","image/png",new Uint8Array([137,80,78,71,13,10,26,10])],["x.jpeg","image/jpeg",new Uint8Array([255,216,255])]])("accepts signature-matched %s",(name,mime,bytes)=>expect(validateFile(name,mime,bytes)).toBe(mime));
  it.each([["x.svg","image/svg+xml",pdf],["x.png","image/png",pdf],["x.pdf","image/png",pdf],["x.pdf","application/pdf",new Uint8Array()],["x.pdf","application/pdf",new Uint8Array(MAX_FILE_BYTES+1)]])("rejects invalid %s %s",(name,mime,bytes)=>expect(()=>validateFile(name,mime,bytes)).toThrow());
  it("sanitizes paths, controls and bidi markers; rejects excessive names",()=>{
    expect(safeName("../private/\u202efile\n.pdf")).toBe("file.pdf");expect(safeName("C:\\secret\\file.pdf")).toBe("file.pdf");
    expect(()=>safeName("a".repeat(161))).toThrow();expect(()=>safeName(".." )).toThrow();
  });
  it("uploads once, checks stored bytes, and confirms exact source",async()=>{
    const m=setup();expect((await m.svc.upload(owner,target,fileId,"published-work.pdf","application/pdf",pdf)).status).toBe("ready");
    expect(m.storage.upload).toHaveBeenCalledTimes(1);expect(m.repo.finalize).toHaveBeenCalledWith(owner,target,fileId,expect.objectContaining({digest:sha(pdf)}));
  });
  it("replays an accepted ID without a second upload",async()=>{
    const m=setup();m.repo.reserve.mockResolvedValue({created:false,attachment:m.a});await m.svc.upload(owner,target,fileId,"published-work.pdf","application/pdf",pdf);
    expect(m.storage.upload).not.toHaveBeenCalled();expect(m.repo.finalize).toHaveBeenCalledTimes(1);
  });
  it("missing object stays pending during explicit recovery",async()=>{
    const m=setup();m.storage.read.mockResolvedValue(null);expect((await m.svc.recover(owner,target,fileId)).status).toBe("uploading");expect(m.repo.finalize).not.toHaveBeenCalled();
  });
  it("unknown storage error never pretends missing or retries writes",async()=>{
    const m=setup();m.storage.read.mockRejectedValue(new Error("private provider failure"));await expect(m.svc.recover(owner,target,fileId)).rejects.toThrow();expect(m.storage.upload).not.toHaveBeenCalled();
  });
  it("corrupt stored bytes cannot be finalized",async()=>{
    const m=setup();m.storage.read.mockResolvedValue(new Uint8Array(pdf.length));await expect(m.svc.recover(owner,target,fileId)).rejects.toThrow("UNAVAILABLE");expect(m.repo.finalize).not.toHaveBeenCalled();
  });
  it("expired recovery does not read or create objects",async()=>{
    const m=setup();m.a.view.expiresAt="2000-01-01T00:00:00Z";await expect(m.svc.recover(owner,target,fileId)).rejects.toThrow("EXPIRED");expect(m.storage.read).not.toHaveBeenCalled();
  });
  it("rechecks removal after storage read",async()=>{
    const m=setup();m.a.view.status="ready";m.repo.read.mockResolvedValueOnce(structuredClone(m.a));m.a.view.status="removing";
    await expect(m.svc.download(owner,target,fileId)).rejects.toThrow("NOT_FOUND");expect(m.repo.read).toHaveBeenCalledTimes(2);
  });
  it("read and remove do not fetch or write storage",async()=>{
    const m=setup();await m.svc.read(owner,target,fileId);await m.svc.remove(owner,target,fileId);expect(m.storage.read).not.toHaveBeenCalled();expect(m.storage.upload).not.toHaveBeenCalled();
  });
  it.each(["user_id","case_id","report_id","delivery_revision_id","record_id","record_revision","record_checksum","action_id","object_key","digest"])("rejects invalid repository binding %s",key=>{
    expect(()=>storedAttachment({...row(),[key]:"wrong"},owner,target)).toThrow("UNAVAILABLE");
  });
  it("strict database failures are finite and never expose details",async()=>{
    const db={rpc:vi.fn(async()=>({data:null,error:{message:"ATTACHMENT_LIMIT"}}))};
    await expect(new AttachmentRepository(db as never).list(owner,target)).rejects.toThrow("LIMIT");
    db.rpc.mockResolvedValue({data:null,error:{message:"secret SQL detail"}});await expect(new AttachmentRepository(db as never).list(owner,target)).rejects.toThrow("UNAVAILABLE");
  });
});

describe("private storage and cleanup",()=>{
  function storageSetup(isPublic=false) {
    const file={upload:vi.fn(async()=>({error:null})),download:vi.fn(async()=>({data:new Blob([pdf]),error:null})),remove:vi.fn(async()=>({error:null}))};
    const db={storage:{getBucket:vi.fn(async()=>({data:{public:isPublic,file_size_limit:MAX_FILE_BYTES,allowed_mime_types:["image/png","image/jpeg","application/pdf"]},error:null})),from:vi.fn(()=>file)}};
    return {file,db,s:new PrivateAttachmentStorage(db as never)};
  }
  it("refuses public buckets and arbitrary paths",async()=>{
    const m=storageSetup(true);await expect(m.s.read(`files/${fileId}`)).rejects.toThrow("UNAVAILABLE");await expect(m.s.read("../other/file")).rejects.toThrow("INVALID");expect(m.db.storage.from).not.toHaveBeenCalled();
  });
  it("writes without overwrite and never returns signed URLs",async()=>{
    const m=storageSetup();await m.s.upload(`files/${fileId}`,pdf,"application/pdf");expect(m.file.upload).toHaveBeenCalledWith(`files/${fileId}`,pdf,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
  });
  it("does not release quota when deletion cannot be confirmed",async()=>{
    const rpc=vi.fn(async()=>({data:[row("removing")],error:null})),storage=setup().storage;storage.remove.mockRejectedValue(new Error("uncertain"));
    expect(await cleanupAttachments({rpc} as never,storage)).toEqual({processed:1,removed:0,failed:1});expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("cleans exact tombstone key and acknowledges only after confirmed deletion",async()=>{
    const rpc=vi.fn(async()=>({data:[row("removed")],error:null})),storage=setup().storage;
    expect(await cleanupAttachments({rpc} as never,storage)).toEqual({processed:1,removed:1,failed:0});expect(storage.remove).toHaveBeenCalledWith(`files/${fileId}`);
    expect(rpc).toHaveBeenLastCalledWith("finish_v22_attachment_cleanup",{p_id:fileId});
  });
});

describe("owner attachment HTTP boundary",()=>{
  const url=`https://app.example/api/v2/cases/${target.caseId}/reports/${target.reportId}/attachments?${attachmentQuery(target)}`;
  const context={params:Promise.resolve({id:target.caseId,reportId:target.reportId})};
  function gateway() {
    const service={list:vi.fn(async()=>[fileView()]),read:vi.fn(async()=>fileView()),upload:vi.fn(async()=>fileView()),recover:vi.fn(async()=>fileView()),remove:vi.fn(async()=>fileView("removing")),download:vi.fn(async()=>({file:fileView(),bytes:pdf}))};
    const deps={enabled:()=>true,user:vi.fn(async()=>({userId:owner} as {userId:string}|null)),service:()=>service};return {service,deps,api:createAttachmentHandlers(deps)};
  }
  it("is hidden when disabled and requires session",async()=>{
    const m=gateway();m.deps.enabled=()=>false;expect((await m.api.GET(new Request(url),context)).status).toBe(404);expect(m.deps.user).not.toHaveBeenCalled();
    m.deps.enabled=()=>true;m.deps.user.mockResolvedValue(null);expect((await m.api.GET(new Request(url),context)).status).toBe(401);
  });
  it.each(["&evil=1","&revision=2","&download=1","&attachmentId=bad"])("rejects malformed query %s",async suffix=>{
    const m=gateway();expect((await m.api.GET(new Request(url+suffix),context)).status).toBe(400);expect(m.service.list).not.toHaveBeenCalled();
  });
  it.each(["PUT","POST","DELETE"])("requires same origin for %s",async method=>{
    const m=gateway();expect((await m.api.PUT(new Request(`${url}&attachmentId=${fileId}`,{method}),context)).status).toBe(403);
  });
  it("enforces streaming body size and conceals infrastructure errors",async()=>{
    const m=gateway(),headers={origin:"https://app.example","content-type":"application/pdf","x-file-name":"file.pdf"};
    const r=await m.api.PUT(new Request(`${url}&attachmentId=${fileId}`,{method:"PUT",headers,body:new Uint8Array(MAX_FILE_BYTES+1)}),context);expect(r.status).toBe(413);expect(m.service.upload).not.toHaveBeenCalled();
    m.service.list.mockRejectedValue(new Error("secret provider detail"));const fail=await m.api.GET(new Request(url),context);expect(fail.status).toBe(503);expect(await fail.text()).not.toContain("secret");
  });
  it("downloads as non-rendered attachment with private cache headers",async()=>{
    const m=gateway(),r=await m.api.GET(new Request(`${url}&attachmentId=${fileId}&download=1`),context);
    expect(r.status).toBe(200);expect(r.headers.get("content-type")).toBe("application/octet-stream");expect(r.headers.get("content-disposition")).toContain("attachment;");expect(r.headers.get("cache-control")).toBe("private, no-store");expect(new Uint8Array(await r.arrayBuffer())).toEqual(pdf);
  });
  it("uploads exact owner and version and allows explicit recovery only",async()=>{
    const m=gateway(),r=await m.api.PUT(new Request(`${url}&attachmentId=${fileId}`,{method:"PUT",headers:{origin:"https://app.example","content-type":"application/pdf","x-file-name":"work.pdf"},body:pdf}),context);
    expect(r.status).toBe(200);expect(m.service.upload).toHaveBeenCalledWith(owner,target,fileId,"work.pdf","application/pdf",pdf);
    await m.api.GET(new Request(`${url}&attachmentId=${fileId}`),context);expect(m.service.recover).not.toHaveBeenCalled();
    await m.api.POST(new Request(`${url}&attachmentId=${fileId}`,{method:"POST",headers:{origin:"https://app.example"}}),context);expect(m.service.recover).toHaveBeenCalledWith(owner,target,fileId);
  });
  it.each([["LIMIT",429],["STALE",409],["EXPIRED",409],["NOT_FOUND",404]])("maps %s without detail",async(code,status)=>{
    const m=gateway();m.service.list.mockRejectedValue(new AttachmentError(code as "LIMIT"));const r=await m.api.GET(new Request(url),context);expect(r.status).toBe(status);expect(await r.json()).toEqual({error:{code}});
  });
});
