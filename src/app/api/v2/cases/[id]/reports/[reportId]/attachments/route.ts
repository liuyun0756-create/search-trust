import {getCurrentUser} from "@/lib/auth";
import {isImplementationAttachmentsEnabled} from "@/lib/implementation-attachments/config";
import {attachmentService} from "@/lib/implementation-attachments/server";
import {createAttachmentHandlers} from "@/lib/implementation-attachments/handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const {GET,PUT,POST,DELETE}=createAttachmentHandlers({enabled:isImplementationAttachmentsEnabled,user:getCurrentUser,service:attachmentService});
