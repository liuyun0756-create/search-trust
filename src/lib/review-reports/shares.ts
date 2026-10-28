import "server-only";
import { ReviewDeliveryRepository,ReviewDeliveryError } from "./repository";
import { projectReviewDelivery } from "./projection";
import { createReportShareToken,hashReportShareToken,isReportShareToken } from "../report-shares/tokens";
import { ReportShareNotFoundError,ReportShareNeedsReviewError } from "../report-shares/service";
import { uuid } from "./delivery";

export type ReviewShareInfo={id:string;revision_id:string;created_at:string;expires_at:string;revoked_at:string|null};
type ShareRow=ReviewShareInfo&{user_id:string;case_id:string;report_id:string;token_hash:string};
function info(v:unknown):ReviewShareInfo{const s=v as ReviewShareInfo;
  if(!s||!uuid(s.id)||!uuid(s.revision_id)||!Number.isFinite(Date.parse(s.created_at))||!Number.isFinite(Date.parse(s.expires_at))
    ||Date.parse(s.expires_at)<=Date.parse(s.created_at)||(s.revoked_at!==null&&!Number.isFinite(Date.parse(s.revoked_at))))throw new ReviewDeliveryError("INVALID");
  return {id:s.id,revision_id:s.revision_id,created_at:s.created_at,expires_at:s.expires_at,revoked_at:s.revoked_at};}
export class ReviewShareService {
  constructor(private readonly reports:ReviewDeliveryRepository,private readonly token=createReportShareToken){}
  async create(user:string,caseId:string,reportId:string,expected:number){
    const r=await this.reports.report(user,caseId,reportId);if(!r)throw new ReportShareNotFoundError();
    const s=await this.reports.revision(user,caseId,r);if(!s||s.status!=="approved")throw new ReportShareNeedsReviewError();
    if(s.revision!==expected)throw new ReviewDeliveryError("CONFLICT");
    const token=this.token();if(!isReportShareToken(token))throw new ReviewDeliveryError("INVALID");const hash=hashReportShareToken(token);
    const {data,error}=await this.reports.db.rpc("create_v22_capability_share",{p_user_id:user,p_case_id:caseId,p_report_id:reportId,p_revision_id:s.id,p_token_hash:hash}).single<ShareRow>();
    if(error)throw new ReviewDeliveryError(error.code==="40001"?"CONFLICT":"UNAVAILABLE");
    if(!data||data.user_id!==user||data.case_id!==caseId||data.report_id!==reportId||data.revision_id!==s.id||data.token_hash!==hash)throw new ReviewDeliveryError("INVALID");
    return {...info(data),token};
  }
  async list(user:string,caseId:string,reportId:string){
    if(!await this.reports.report(user,caseId,reportId))throw new ReportShareNotFoundError();
    const {data,error}=await this.reports.db.rpc("list_v22_capability_shares",{p_user_id:user,p_case_id:caseId,p_report_id:reportId});
    if(error||!Array.isArray(data))throw new ReviewDeliveryError("UNAVAILABLE");return data.map(info);
  }
  async revoke(user:string,caseId:string,reportId:string,id:string){
    if(!await this.reports.report(user,caseId,reportId))throw new ReportShareNotFoundError();
    const {data,error}=await this.reports.db.rpc("revoke_v22_capability_share",{p_user_id:user,p_case_id:caseId,p_report_id:reportId,p_share_id:id});
    if(error||data!==true)throw new ReportShareNotFoundError();
  }
  async resolve(token:string){
    if(!isReportShareToken(token))throw new ReportShareNotFoundError();const hash=hashReportShareToken(token);
    const {data,error}=await this.reports.db.rpc("resolve_v22_capability_share",{p_token_hash:hash}).maybeSingle<ShareRow>();
    if(error)throw new ReviewDeliveryError("UNAVAILABLE");
    if(!data||data.token_hash!==hash||data.revoked_at!==null||Date.parse(data.expires_at)<=Date.now())throw new ReportShareNotFoundError();
    const share=info(data),r=await this.reports.report(data.user_id,data.case_id,data.report_id);if(!r)throw new ReportShareNotFoundError();
    const s=await this.reports.revision(data.user_id,data.case_id,r,data.revision_id);if(!s||s.status!=="approved")throw new ReportShareNotFoundError();
    return {delivery:projectReviewDelivery(r,s),share};
  }
}
