import {uuid} from "../implementation-records/contracts";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ACTION_FILES = 5;
export const BUCKET = "implementation-files";
export const MIME = ["image/png", "image/jpeg", "application/pdf"] as const;
export type FileMime = typeof MIME[number];
export type AttachmentTarget = {caseId: string; reportId: string; deliveryRevisionId: string; recordId: string; revision: number; checksum: string; actionId: string};
export type Attachment = {id: string; name: string; mime: FileMime; size: number; status: "uploading" | "ready" | "removing" | "removed"; createdAt: string; expiresAt: string};
export class AttachmentError extends Error {
  constructor(public code: "INVALID" | "TOO_LARGE" | "NOT_FOUND" | "CONFLICT" | "STALE" | "EXPIRED" | "LIMIT" | "UNAVAILABLE") {super(code);}
}
export function validTarget(t: AttachmentTarget) {
  return [t.caseId,t.reportId,t.deliveryRevisionId,t.recordId].every(uuid) && Number.isSafeInteger(t.revision) && t.revision>0
    && /^sha256:[a-f0-9]{64}$/.test(t.checksum) && typeof t.actionId==="string" && t.actionId.length>0 && t.actionId.length<=200;
}
export function safeName(input: string) {
  const value = input.normalize("NFC").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  if (!value || value.length>160 || value==="." || value==="..") throw new AttachmentError("INVALID");
  return value;
}
export function validateFile(name: string, mime: string, bytes: Uint8Array): FileMime {
  if (!bytes.length) throw new AttachmentError("INVALID");
  if (bytes.length>MAX_FILE_BYTES) throw new AttachmentError("TOO_LARGE");
  const prefix = (...values: number[]) => values.every((v,i) => bytes[i]===v);
  const png = mime==="image/png" && /\.png$/i.test(name) && prefix(137,80,78,71,13,10,26,10);
  const jpeg = mime==="image/jpeg" && /\.jpe?g$/i.test(name) && prefix(255,216,255);
  const pdf = mime==="application/pdf" && /\.pdf$/i.test(name) && prefix(37,80,68,70,45);
  // Signature validation is not a malware scanner. Downloads never render inline.
  if (!png && !jpeg && !pdf) throw new AttachmentError("INVALID");
  return mime as FileMime;
}
export function attachmentQuery(t: AttachmentTarget) {
  return new URLSearchParams({deliveryRevisionId:t.deliveryRevisionId,recordId:t.recordId,revision:String(t.revision),checksum:t.checksum,actionId:t.actionId});
}
export function parseAttachment(v: unknown): Attachment | null {
  if (!v || typeof v!=="object") return null;
  const a=v as Attachment;
  try {
    if (!uuid(a.id) || safeName(a.name)!==a.name || !(MIME as readonly string[]).includes(a.mime) || !Number.isSafeInteger(a.size) || a.size<1 || a.size>MAX_FILE_BYTES
      || !["uploading","ready","removing","removed"].includes(a.status) || !Number.isFinite(Date.parse(a.createdAt)) || !Number.isFinite(Date.parse(a.expiresAt))) return null;
  } catch {return null;}
  return a;
}
