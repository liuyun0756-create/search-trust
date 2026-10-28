import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CapabilityRepository, CapabilityPersistenceError } from "./repository";
import { createReportShareToken,hashReportShareToken,isReportShareToken } from "../report-shares/tokens";
import { ReportShareNeedsReviewError,ReportShareNotFoundError } from "../report-shares/service";

export type CapabilityShareInfo = {id:string;revision_id:string;created_at:string;expires_at:string;revoked_at:string|null};
type ShareRow = CapabilityShareInfo & {user_id:string;case_id:string;report_id:string;token_hash:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function check(error:{code?:string}|null) {
  if(error) throw new CapabilityPersistenceError(error.code==="40001"?"CAPABILITY_CONFLICT":"CAPABILITY_UNAVAILABLE");
}
function info(row:unknown):CapabilityShareInfo {
  const s=row as CapabilityShareInfo;
  if(!s || !uuid.test(s.id) || !uuid.test(s.revision_id) || typeof s.created_at!=="string" || typeof s.expires_at!=="string" || !Number.isFinite(Date.parse(s.created_at))
    || !Number.isFinite(Date.parse(s.expires_at)) || Date.parse(s.expires_at)<=Date.parse(s.created_at)
    || (s.revoked_at!==null && (typeof s.revoked_at!=="string" || !Number.isFinite(Date.parse(s.revoked_at))))) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
  return {id:s.id,revision_id:s.revision_id,created_at:s.created_at,expires_at:s.expires_at,revoked_at:s.revoked_at};
}
export class CapabilityShareService {
  constructor(private readonly db:SupabaseClient,private readonly reports=new CapabilityRepository(db),private readonly token=createReportShareToken){}
  async create(userId:string,caseId:string,reportId:string,expectedRevision:number) {
    const report=await this.reports.loadCompletedReport(userId,caseId,reportId);
    if(!report) throw new ReportShareNotFoundError();
    const saved=await this.reports.loadRevision(userId,caseId,report);
    if(!saved || saved.status!=="approved") throw new ReportShareNeedsReviewError();
    if(saved.revision!==expectedRevision) throw new CapabilityPersistenceError("CAPABILITY_CONFLICT");
    const token=this.token();if(!isReportShareToken(token)) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    const {data,error}=await this.db.rpc("create_v22_capability_share",{p_user_id:userId,p_case_id:caseId,p_report_id:reportId,p_revision_id:saved.id,p_token_hash:hashReportShareToken(token)}).single<ShareRow>();
    check(error);
    if(!data || data.user_id!==userId || data.case_id!==caseId || data.report_id!==reportId || data.revision_id!==saved.id
      || data.token_hash!==hashReportShareToken(token) || data.revoked_at!==null) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return {...info(data),token};
  }
  async list(userId:string,caseId:string,reportId:string) {
    if(!await this.reports.loadCompletedReport(userId,caseId,reportId)) throw new ReportShareNotFoundError();
    const {data,error}=await this.db.rpc("list_v22_capability_shares",{p_user_id:userId,p_case_id:caseId,p_report_id:reportId});check(error);
    if(!Array.isArray(data)) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return data.map(info);
  }
  async revoke(userId:string,caseId:string,reportId:string,shareId:string) {
    if(![userId,caseId,reportId,shareId].every(id=>uuid.test(id))) throw new ReportShareNotFoundError();
    const {data,error}=await this.db.rpc("revoke_v22_capability_share",{p_user_id:userId,p_case_id:caseId,p_report_id:reportId,p_share_id:shareId});check(error);
    if(data!==true) throw new ReportShareNotFoundError();
  }
  async resolve(token:string) {
    if(!isReportShareToken(token)) throw new ReportShareNotFoundError();
    const hash=hashReportShareToken(token);
    const {data,error}=await this.db.rpc("resolve_v22_capability_share",{p_token_hash:hash}).maybeSingle<ShareRow>();check(error);
    if(!data || data.token_hash!==hash || data.revoked_at!==null || Date.parse(data.expires_at)<=Date.now()) throw new ReportShareNotFoundError();
    const share=info(data);
    // The pinned revision ID is taken only from the server's share record.
    let delivery;
    try{delivery=await this.reports.loadApprovedDelivery(data.user_id,data.case_id,data.report_id,data.revision_id);}
    catch(error){if(error instanceof CapabilityPersistenceError&&error.code==="CAPABILITY_INVALID")throw new ReportShareNotFoundError();throw error;}
    if(!delivery || delivery.revisionId!==data.revision_id) throw new ReportShareNotFoundError();
    return {delivery,share};
  }
}
