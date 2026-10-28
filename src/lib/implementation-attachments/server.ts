import "server-only";
import {createClient} from "@supabase/supabase-js";
import {AttachmentError} from "./contracts";
import {AttachmentRepository} from "./repository";
import {PrivateAttachmentStorage} from "./storage";
import {AttachmentService} from "./service";
export function attachmentClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AttachmentError("UNAVAILABLE");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,
    signal:AbortSignal.any([AbortSignal.timeout(30000),...(init?.signal?[init.signal]:[])]),redirect:"error",cache:"no-store"})}});
}
export function attachmentService() {
  const db=attachmentClient(); return new AttachmentService(new AttachmentRepository(db),new PrivateAttachmentStorage(db));
}
