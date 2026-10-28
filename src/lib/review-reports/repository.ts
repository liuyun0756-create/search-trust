import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReviewReport,parseSavedRevision,validSaveRequest,uuid,type SaveRequest } from "./delivery";
import type { VerifiedReviewReport } from "./types";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { capabilityWorkspaceItem } from "../report-capability/workspace";

export class ReviewDeliveryError extends Error {constructor(public code:"INVALID"|"CONFLICT"|"UNAVAILABLE"|"NOT_FOUND"){super(code);}}
function failure(e:{code?:string}|null){if(e)throw new ReviewDeliveryError(e.code==="40001"?"CONFLICT":"UNAVAILABLE");}
export class ReviewDeliveryRepository {
  constructor(public readonly db:SupabaseClient){}
  async report(userId:string,caseId:string,reportId:string){
    if(![userId,caseId,reportId].every(uuid))throw new ReviewDeliveryError("NOT_FOUND");
    const {data,error}=await this.db.rpc("get_v22_completed_review_report",{p_user_id:userId,p_case_id:caseId,p_job_id:reportId});
    if(error){if(error.code==="P0001"&&error.message?.includes("REVIEW_REPORT_UNAVAILABLE"))return null;throw new ReviewDeliveryError("UNAVAILABLE");}
    if(!data)return null;
    try{const r=parseReviewReport(data.report);if(data.schema_version!=="v22_completed_review_report_v1"||r.id!==reportId||r.input_reference.user_id!==userId||r.input_reference.case_id!==caseId||data.payload_checksum!==canonicalDigest(r))throw Error();return r;}
    catch{throw new ReviewDeliveryError("INVALID");}
  }
  async revision(userId:string,caseId:string,r:VerifiedReviewReport,id?:string){
    const {data,error}=await this.db.rpc("get_v22_review_delivery",{p_user_id:userId,p_case_id:caseId,p_report_id:r.id,p_revision_id:id??null});failure(error);
    if(!data)return null;try{const s=parseSavedRevision(data,r);if(id&&s.id!==id)throw Error();return s;}catch{throw new ReviewDeliveryError("INVALID");}
  }
  async save(userId:string,caseId:string,r:VerifiedReviewReport,request:SaveRequest){
    if(!validSaveRequest(request,r)||r.input_reference.user_id!==userId||r.input_reference.case_id!==caseId)throw new ReviewDeliveryError("INVALID");
    const {data,error}=await this.db.rpc("save_v22_review_delivery",{p_user_id:userId,p_case_id:caseId,p_report_id:r.id,p_request_text:JSON.stringify(request)});failure(error);
    try{const s=parseSavedRevision(data,r);if(canonicalDigest(s.content)!==canonicalDigest(request.content))throw Error();return s;}
    catch{throw new ReviewDeliveryError("UNAVAILABLE");}
  }
  async history(userId:string,caseId:string,reportId:string){
    const {data,error}=await this.db.rpc("list_v22_review_delivery_history",{p_user_id:userId,p_case_id:caseId,p_report_id:reportId});failure(error);
    if(!Array.isArray(data)||data.length>20||data.some((x,i)=>!uuid(x.id)||!Number.isSafeInteger(x.revision)||x.revision<1||!["draft","approved"].includes(x.status)||!Number.isFinite(Date.parse(x.created_at))||(i>0&&x.revision>=data[i-1].revision)))throw new ReviewDeliveryError("INVALID");
    return data as {id:string;revision:number;status:"draft"|"approved";created_at:string}[];
  }
  async list(userId:string){const {data,error}=await this.db.rpc("list_v22_completed_review_reports",{p_user_id:userId});failure(error);
    if(!Array.isArray(data))throw new ReviewDeliveryError("INVALID");return data.map(x=>capabilityWorkspaceItem(x,userId));}
}
