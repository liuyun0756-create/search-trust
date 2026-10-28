import type {Attachment,AttachmentTarget} from "./contracts";
export const owner="11111111-1111-4111-8111-111111111111";
export const fileId="66666666-6666-4666-8666-666666666666";
export const target:AttachmentTarget={caseId:"22222222-2222-4222-8222-222222222222",reportId:"33333333-3333-4333-8333-333333333333",
  deliveryRevisionId:"44444444-4444-4444-8444-444444444444",recordId:"55555555-5555-4555-8555-555555555555",revision:1,checksum:`sha256:${"a".repeat(64)}`,actionId:"action-1"};
export const pdf=new TextEncoder().encode("%PDF-1.4\nSynthetic supporting file\n%%EOF");
export const fileView=(status:Attachment["status"]="ready",id=fileId):Attachment=>({id,name:"published-work.pdf",mime:"application/pdf",size:pdf.length,status,
  createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
