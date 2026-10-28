import "server-only";
import {createHash} from "node:crypto";
import {AttachmentError,safeName,validateFile,type AttachmentTarget} from "./contracts";
import type {AttachmentRepository, StoredAttachment} from "./repository";
import type {AttachmentStorage} from "./storage";
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export class AttachmentService {
  constructor(private repo:Pick<AttachmentRepository,"list"|"read"|"reserve"|"finalize"|"remove">,private storage:AttachmentStorage) {}
  list(user:string,t:AttachmentTarget) {return this.repo.list(user,t);}
  async read(user:string,t:AttachmentTarget,id:string) {return (await this.repo.read(user,t,id)).view;}
  private checkBytes(a:StoredAttachment,bytes:Uint8Array) {
    if (bytes.length!==a.view.size || digest(bytes)!==a.digest) throw new AttachmentError("UNAVAILABLE");
    validateFile(a.view.name,a.view.mime,bytes);
  }
  async upload(user:string,t:AttachmentTarget,id:string,name:string,mime:string,bytes:Uint8Array) {
    const clean=safeName(name),type=validateFile(clean,mime,bytes),meta={name:clean,mime:type,size:bytes.length,digest:digest(bytes)};
    const {created,attachment:a}=await this.repo.reserve(user,t,id,meta);
    // A lost acknowledgement never causes a second object write.
    if (!created) return this.recover(user,t,id);
    await this.storage.upload(a.key,bytes,type);
    const stored=await this.storage.read(a.key);
    if (!stored) throw new AttachmentError("UNAVAILABLE");
    this.checkBytes(a,stored);
    return (await this.repo.finalize(user,t,id,meta)).view;
  }
  async recover(user:string,t:AttachmentTarget,id:string) {
    const a=await this.repo.read(user,t,id);
    if (a.view.status!=="uploading") return a.view;
    if (Date.parse(a.view.expiresAt)<=Date.now()) throw new AttachmentError("EXPIRED");
    const bytes=await this.storage.read(a.key);
    if (!bytes) return a.view;
    this.checkBytes(a,bytes);
    return (await this.repo.finalize(user,t,id,{name:a.view.name,mime:a.view.mime,size:a.view.size,digest:a.digest})).view;
  }
  async download(user:string,t:AttachmentTarget,id:string) {
    const a=await this.repo.read(user,t,id);
    if (a.view.status!=="ready") throw new AttachmentError("NOT_FOUND");
    const bytes=await this.storage.read(a.key);
    if (!bytes) throw new AttachmentError("UNAVAILABLE");
    this.checkBytes(a,bytes);
    // Recheck permission and removal state after object I/O.
    const current=await this.repo.read(user,t,id);
    if (current.view.status!=="ready" || current.digest!==a.digest) throw new AttachmentError("NOT_FOUND");
    return {file:a.view,bytes};
  }
  async remove(user:string,t:AttachmentTarget,id:string) {
    // Revoke first. Bounded maintenance handles physical deletion after in-flight upload grace.
    return (await this.repo.remove(user,t,id)).view;
  }
}
