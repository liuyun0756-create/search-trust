import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {AttachmentError} from "./contracts";
import {storedAttachment} from "./repository";
import type {AttachmentStorage} from "./storage";
export async function cleanupAttachments(db:SupabaseClient,storage:AttachmentStorage) {
  const {data,error}=await db.rpc("prepare_v22_attachment_cleanup");
  if (error || !Array.isArray(data) || data.length>20) throw new AttachmentError("UNAVAILABLE");
  let removed=0,failed=0;
  for (const row of data) {
    try {
      const a=storedAttachment(row);
      if (!["removing","removed"].includes(a.view.status)) throw new AttachmentError("UNAVAILABLE");
      await storage.remove(a.key);
      const result=await db.rpc("finish_v22_attachment_cleanup",{p_id:a.view.id});
      if (result.error) throw new AttachmentError("UNAVAILABLE");
      removed++;
    } catch {failed++;}
  }
  return {processed:data.length,removed,failed};
}
