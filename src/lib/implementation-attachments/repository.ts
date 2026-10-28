import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {uuid} from "../implementation-records/contracts";
import {AttachmentError, parseAttachment, validTarget, type Attachment, type AttachmentTarget, type FileMime} from "./contracts";

export type StoredAttachment = {view: Attachment; key: string; digest: string};
export type FileMetadata = {name: string; mime: FileMime; size: number; digest: string};
const codes = ["INVALID","NOT_FOUND","CONFLICT","STALE","EXPIRED","LIMIT"] as const;
export function storedAttachment(data: unknown, user?: string, t?: AttachmentTarget): StoredAttachment {
  const r=data as Record<string,unknown> | null;
  if (!r || !uuid(r.id) || r.object_key!==`files/${r.id}` || typeof r.digest!=="string" || !/^[a-f0-9]{64}$/.test(r.digest)) throw new AttachmentError("UNAVAILABLE");
  if (t && (r.user_id!==user || r.case_id!==t.caseId || r.report_id!==t.reportId || r.delivery_revision_id!==t.deliveryRevisionId
    || r.record_id!==t.recordId || r.record_revision!==t.revision || r.record_checksum!==t.checksum || r.action_id!==t.actionId)) throw new AttachmentError("UNAVAILABLE");
  const view=parseAttachment({id:r.id,name:r.file_name,mime:r.mime,size:r.byte_size,status:r.status,createdAt:r.created_at,expiresAt:r.expires_at});
  if (!view) throw new AttachmentError("UNAVAILABLE");
  return {view,key:r.object_key as string,digest:r.digest};
}
export class AttachmentRepository {
  constructor(private db: SupabaseClient) {}
  private async command(user: string,t: AttachmentTarget,operation: string,id?: string,m?: FileMetadata) {
    if (!uuid(user) || !validTarget(t) || (id!==undefined && !uuid(id))) throw new AttachmentError("NOT_FOUND");
    const {data,error}=await this.db.rpc("v22_attachments",{p_user:user,p_case:t.caseId,p_report:t.reportId,p_delivery:t.deliveryRevisionId,
      p_record:t.recordId,p_revision:t.revision,p_checksum:t.checksum,p_action:t.actionId,p_operation:operation,p_id:id??null,
      p_name:m?.name??null,p_mime:m?.mime??null,p_size:m?.size??null,p_digest:m?.digest??null});
    if (error) {
      const known=codes.find(c=>error.message===`ATTACHMENT_${c}`);
      throw new AttachmentError(known ?? (error.message==="IMPLEMENTATION_SOURCE_NOT_FOUND" ? "NOT_FOUND":"UNAVAILABLE"));
    }
    return data;
  }
  async list(user:string,t:AttachmentTarget) {
    const data=await this.command(user,t,"list");
    if (!Array.isArray(data) || data.length>100) throw new AttachmentError("UNAVAILABLE");
    return data.map(r=>storedAttachment(r,user,t).view);
  }
  async read(user:string,t:AttachmentTarget,id:string) {return storedAttachment(await this.command(user,t,"read",id),user,t);}
  async reserve(user:string,t:AttachmentTarget,id:string,m:FileMetadata) {
    const data=await this.command(user,t,"reserve",id,m);
    if (!data || typeof data.created!=="boolean") throw new AttachmentError("UNAVAILABLE");
    return {created:data.created as boolean,attachment:storedAttachment(data.attachment,user,t)};
  }
  async finalize(user:string,t:AttachmentTarget,id:string,m:FileMetadata) {return storedAttachment(await this.command(user,t,"finalize",id,m),user,t);}
  async remove(user:string,t:AttachmentTarget,id:string) {return storedAttachment(await this.command(user,t,"remove",id),user,t);}
}
