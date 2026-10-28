import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/report.schema.json";
import type { VerifiedReviewReport, ReviewPlanAction } from "./types";
import { canonicalDigest } from "../verified-analysis-v22/digest";

export type ReviewRevision = {
  schema_version: "v22_review_delivery_revision_v1"; report_id: string; user_id: string; case_id: string;
  expected_revision: number; source_checksum: string; status: "draft" | "approved";
  title: string; summary: string; client_note: string | null; actions: ReviewPlanAction[];
};
export type SavedReviewRevision = { id: string;report_id:string;user_id:string;case_id:string;revision:number;
  status:"draft"|"approved";approved_at:string|null;content:ReviewRevision };
export type SaveRequest={id:string;review_confirmed:boolean;content:ReviewRevision};
export const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const ajv=new Ajv2020({strict:false});addFormats(ajv);const shape=ajv.compile(schema);
const keys=(v:object,names:string[])=>Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const plain=(s:unknown,max:number):s is string=>typeof s==="string"&&!!s.trim()&&[...s].length<=max&&!/[\u0000-\u0008\u000b-\u001f\u007f\ud800-\udfff]/u.test(s);
export function parseReviewReport(value:unknown):VerifiedReviewReport {
  if(!shape(value))throw new Error("REVIEW_INVALID");
  const r=value as unknown as VerifiedReviewReport,{checksum,...body}=r,c=r.content,{checksum:ch,...cb}=c,ref=r.input_reference;
  if(canonicalDigest(body)!==checksum||canonicalDigest(cb)!==ch||r.id!==ref.job_id||r.business.user_id!==ref.user_id||r.business.case_id!==ref.case_id
    ||c.job_id!==r.id||c.user_id!==ref.user_id||c.case_id!==ref.case_id||c.base_report_id!==ref.report_id||c.input_checksum!==ref.input_checksum
    ||c.review_id!==ref.review_id||c.review_checksum!==ref.review_checksum||c.decision_id!==ref.decision_id||c.decision_checksum!==ref.decision_checksum
    ||r.version!==c.proposed_version||r.generated_at!==ref.prepared_at||c.prepared_at!==r.generated_at
    ||Boolean(r.actions.length)!==(r.action_state==="actions_supported"))throw new Error("REVIEW_INVALID");
  return r;
}
export function initialReviewRevision(r:VerifiedReviewReport):ReviewRevision {
  return {schema_version:"v22_review_delivery_revision_v1",report_id:r.id,user_id:r.input_reference.user_id,case_id:r.input_reference.case_id,
    expected_revision:0,source_checksum:canonicalDigest(r),status:"draft",title:r.title,summary:"This review brings together the recorded work, the selected observations and the next steps to agree.",client_note:null,actions:structuredClone(r.actions)};
}
export function validReviewRevision(v:unknown,r:VerifiedReviewReport):v is ReviewRevision {
  if(!v||typeof v!=="object"||Array.isArray(v))return false;const c=v as ReviewRevision;
  return keys(c,["schema_version","report_id","user_id","case_id","expected_revision","source_checksum","status","title","summary","client_note","actions"])
    &&c.schema_version==="v22_review_delivery_revision_v1"&&c.report_id===r.id&&c.user_id===r.input_reference.user_id&&c.case_id===r.input_reference.case_id
    &&c.source_checksum===canonicalDigest(r)&&Number.isSafeInteger(c.expected_revision)&&c.expected_revision>=0&&c.expected_revision<2147483646
    &&["draft","approved"].includes(c.status)&&plain(c.title,200)&&plain(c.summary,2000)&&(c.client_note===null||plain(c.client_note,2000))
    &&Array.isArray(c.actions)&&c.actions.length===r.actions.length&&c.actions.every((a,i)=>
      !!a&&keys(a,["id","title","target","steps","completion","review","materials"])&&a.id===r.actions[i].id
      &&plain(a.title,200)&&plain(a.target,2000)&&plain(a.review,2000)&&canonicalDigest(a.materials)===canonicalDigest(r.actions[i].materials)
      &&(["steps","completion"] as const).every(k=>Array.isArray(a[k])&&a[k].length>=1&&a[k].length<=12&&a[k].every(t=>plain(t,k==="steps"?4000:2000))));
}
export function parseSavedRevision(v:unknown,r:VerifiedReviewReport):SavedReviewRevision {
  const s=v as SavedReviewRevision;
  if(!s||!uuid(s.id)||s.report_id!==r.id||s.user_id!==r.input_reference.user_id||s.case_id!==r.input_reference.case_id
    ||!validReviewRevision(s.content,r)||s.status!==s.content.status||s.revision!==s.content.expected_revision+1
    ||(s.status==="approved"?typeof s.approved_at!=="string"||!Number.isFinite(Date.parse(s.approved_at)):s.approved_at!==null))throw new Error("REVIEW_INVALID");
  return s;
}
export function validSaveRequest(v:unknown,r:VerifiedReviewReport):v is SaveRequest {
  const q=v as SaveRequest;return !!q&&typeof q==="object"&&keys(q,["id","review_confirmed","content"])&&uuid(q.id)
    &&typeof q.review_confirmed==="boolean"&&validReviewRevision(q.content,r)&&(q.content.status!=="approved"||q.review_confirmed);
}
