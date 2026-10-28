import { isRecord, isUuid } from "../verified-analysis-v22/contracts";

export type EntryCommand = {
  action: "start" | "supplement" | "refresh" | "confirm";
  workflowId: string; discoveryId: string; operationId: string;
  gscSnapshotId: string; ga4SnapshotId: string;
  scopeHash: string; acceptedCredit: boolean; queries: string[]; websites: string[];
  planningRevision?: number;
};
export type EntryView = {
  caseId: string; scopeHash: string; creditBalance: number; sourcesReady: boolean; otherWork: boolean;
  gscSnapshotId: string | null; ga4SnapshotId: string | null;
  service: string; market: string; queries: string[];
  workflow: null | { id: string; discoveryId: string; remainingAttempts: number;
    phase: "discovering" | "needs_competitors" | "awaiting_confirmation" | "refresh_required" | "analyzing" | "completed" | "failed" };
  candidates: { website: string; name: string; reason: string }[];
  supplements: string[];
};
export function parseEntryCommand(value: unknown): EntryCommand | null {
  if (!isRecord(value) || Object.keys(value).filter(k=>k!=="planningRevision").sort().join() !== ["action","workflowId","discoveryId","operationId","gscSnapshotId","ga4SnapshotId","scopeHash","acceptedCredit","queries","websites"].sort().join()
    || (Object.hasOwn(value,"planningRevision") && (!Number.isSafeInteger(value.planningRevision)||(value.planningRevision as number)<0||(value.planningRevision as number)>2147483647))
    || !["start","supplement","refresh","confirm"].includes(value.action as string)
    || ![value.workflowId,value.discoveryId,value.operationId,value.gscSnapshotId,value.ga4SnapshotId].every(isUuid)
    || value.workflowId===value.discoveryId || value.gscSnapshotId===value.ga4SnapshotId
    || typeof value.scopeHash!=="string" || !/^sha256:[a-f0-9]{64}$/.test(value.scopeHash)
    || typeof value.acceptedCredit!=="boolean" || (value.action==="start" && value.acceptedCredit!==true)
    || !Array.isArray(value.queries) || value.queries.length<3 || value.queries.length>5
    || value.queries.some(q=>typeof q!=="string" || !q.trim() || q.length>300)
    || new Set(value.queries.map(q=>(q as string).trim().toLowerCase())).size!==value.queries.length
    || !Array.isArray(value.websites) || value.websites.length>3
    || value.websites.some(v=>typeof v!=="string" || v.length>2048 || /\s/.test(v))
    || ((value.action==="confirm" || value.action==="supplement") && !value.websites.length)
    || (value.action==="start" && value.websites.length)) return null;
  try {
    const domains=value.websites.map(v=>{ const u=new URL(v as string); if(!["https:","http:"].includes(u.protocol)||u.username||u.password) throw Error(); return u.hostname.replace(/^www\./,""); });
    if(new Set(domains).size!==domains.length) return null;
  } catch {return null;}
  return value as EntryCommand;
}
