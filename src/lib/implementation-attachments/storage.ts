import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {AttachmentError, BUCKET, MAX_FILE_BYTES, MIME, type FileMime} from "./contracts";
export interface AttachmentStorage {
  upload(key:string,bytes:Uint8Array,mime:FileMime):Promise<void>;
  read(key:string):Promise<Uint8Array | null>;
  remove(key:string):Promise<void>;
}
export class PrivateAttachmentStorage implements AttachmentStorage {
  constructor(private db:SupabaseClient) {}
  private async bucket(key:string) {
    if (!/^files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) throw new AttachmentError("INVALID");
    const {data,error}=await this.db.storage.getBucket(BUCKET);
    if (error || !data || data.public!==false || Number(data.file_size_limit)!==MAX_FILE_BYTES
      || !data.allowed_mime_types || data.allowed_mime_types.length!==MIME.length || MIME.some(m=>!data.allowed_mime_types!.includes(m))) throw new AttachmentError("UNAVAILABLE");
    return this.db.storage.from(BUCKET);
  }
  async upload(key:string,bytes:Uint8Array,mime:FileMime) {
    const bucket=await this.bucket(key);
    const {error}=await bucket.upload(key,bytes,{contentType:mime,upsert:false,cacheControl:"0"});
    if (error) throw new AttachmentError("UNAVAILABLE");
  }
  async read(key:string) {
    const bucket=await this.bucket(key), {data,error}=await bucket.download(key);
    if (error) {
      // Only the provider's specific missing-object code is absence; outages stay unknown.
      if ("statusCode" in error && ["404","NoSuchKey"].includes(String(error.statusCode))) return null;
      throw new AttachmentError("UNAVAILABLE");
    }
    if (!data || data.size<1 || data.size>MAX_FILE_BYTES) throw new AttachmentError("UNAVAILABLE");
    return new Uint8Array(await data.arrayBuffer());
  }
  async remove(key:string) {
    const bucket=await this.bucket(key), {error}=await bucket.remove([key]);
    if (error) throw new AttachmentError("UNAVAILABLE");
    if (await this.read(key)) throw new AttachmentError("UNAVAILABLE");
  }
}
