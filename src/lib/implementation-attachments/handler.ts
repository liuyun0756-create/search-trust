import {AttachmentError,MAX_FILE_BYTES,validTarget,type AttachmentTarget} from "./contracts";
import {uuid} from "../implementation-records/contracts";
import type {AttachmentService} from "./service";
type Context={params:Promise<{id:string;reportId:string}>};
type Dependencies={enabled():boolean;user():Promise<{userId:string}|null>;service():Pick<AttachmentService,"list"|"read"|"upload"|"recover"|"download"|"remove">};
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const fail=(code:string,status:number)=>json({error:{code}},status);
async function readBytes(request:Request) {
  const declared=request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared)>MAX_FILE_BYTES)) throw new AttachmentError("TOO_LARGE");
  const reader=request.body?.getReader();
  if (!reader) throw new AttachmentError("INVALID");
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const chunks:Uint8Array[]=[]; let size=0;
    const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new AttachmentError("UNAVAILABLE"));},30000);});
    for (;;) {
      const {done,value}=await Promise.race([reader.read(),deadline]);
      if (done) break;
      size+=value.length;
      if (size>MAX_FILE_BYTES) {await reader.cancel();throw new AttachmentError("TOO_LARGE");}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size); let offset=0;
    for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
    return bytes;
  } finally {clearTimeout(timer);reader.releaseLock();}
}
export function createAttachmentHandlers(deps:Dependencies) {
  async function handle(request:Request,context:Context) {
    if (!deps.enabled()) return fail("NOT_FOUND",404);
    const user=await deps.user(); if (!user) return fail("UNAUTHORIZED",401);
    try {
      const {id,reportId}=await context.params,url=new URL(request.url),q=url.searchParams;
      const allowed=["deliveryRevisionId","recordId","revision","checksum","actionId","attachmentId","download"];
      if ([...q.keys()].some(k=>!allowed.includes(k)||q.getAll(k).length!==1)) throw new AttachmentError("INVALID");
      const t:AttachmentTarget={caseId:id,reportId,deliveryRevisionId:q.get("deliveryRevisionId")??"",recordId:q.get("recordId")??"",
        revision:Number(q.get("revision")),checksum:q.get("checksum")??"",actionId:q.get("actionId")??""};
      if (!validTarget(t) || !/^[1-9]\d*$/.test(q.get("revision")??"")) throw new AttachmentError("NOT_FOUND");
      const fileId=q.get("attachmentId"),download=q.get("download");
      if ((fileId!==null&&!uuid(fileId)) || (download!==null&&download!=="1") || (download&&!fileId)) throw new AttachmentError("INVALID");
      const svc=deps.service();
      if (request.method==="GET") {
        if (download) {
          const {file,bytes}=await svc.download(user.userId,t,fileId!);
          return new Response(new Uint8Array(bytes),{headers:{...headers,"Content-Type":"application/octet-stream","Content-Length":String(bytes.length),
            "Content-Security-Policy":"sandbox; default-src 'none'","Content-Disposition":`attachment; filename="supporting-file"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`)}`}});
        }
        return json(fileId ? await svc.read(user.userId,t,fileId):{files:await svc.list(user.userId,t)});
      }
      const host=request.headers.get("host"),origin=host?`${url.protocol}//${host}`:url.origin;
      if (request.headers.get("origin")!==origin || request.headers.get("sec-fetch-site")==="cross-site") return fail("FORBIDDEN",403);
      if (!fileId || download) throw new AttachmentError("INVALID");
      if (request.method==="PUT") {
        let name:string; try {name=decodeURIComponent(request.headers.get("x-file-name")??"");} catch {throw new AttachmentError("INVALID");}
        return json(await svc.upload(user.userId,t,fileId,name,request.headers.get("content-type")??"",await readBytes(request)));
      }
      if (request.body) {await request.body.cancel();throw new AttachmentError("INVALID");}
      if (request.method==="POST") return json(await svc.recover(user.userId,t,fileId));
      if (request.method==="DELETE") return json(await svc.remove(user.userId,t,fileId));
      return fail("METHOD_NOT_ALLOWED",405);
    } catch(e) {
      const code=e instanceof AttachmentError?e.code:"UNAVAILABLE";
      return fail(code,{INVALID:400,TOO_LARGE:413,NOT_FOUND:404,CONFLICT:409,STALE:409,EXPIRED:409,LIMIT:429,UNAVAILABLE:503}[code]);
    }
  }
  return {GET:handle,PUT:handle,POST:handle,DELETE:handle};
}
