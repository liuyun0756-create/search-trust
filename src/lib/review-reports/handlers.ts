import {NextResponse} from "next/server";
import {ReviewDeliveryRepository,ReviewDeliveryError} from "./repository";
import {ReviewShareService} from "./shares";
import {validSaveRequest,uuid} from "./delivery";
import {projectReviewDelivery} from "./projection";
import {strictJson} from "../review-decisions/json";
import {parsePdfBranding} from "../report-pdf/branding";
import {ReportShareNotFoundError,ReportShareNeedsReviewError} from "../report-shares/service";
import {buildReportShareUrl} from "../report-shares/tokens";
import {REVIEW_HEADERS,reviewPdfResponse} from "./pdf";
type Context={params:Promise<{id:string;reportId:string;shareId?:string}>};
type Deps={getCurrentUser():Promise<{userId:string}|null>;isEnabled():boolean;repository():ReviewDeliveryRepository;shares():ReviewShareService;pdf:typeof reviewPdfResponse};
export function reviewRequestOrigin(request:Request){
  const internal=new URL(request.url),host=request.headers.get("host");
  if(!host)return internal.origin;
  if(/[\s/\\?#@]/.test(host))throw Error("INVALID_HOST");
  // Next may use its internal listening hostname in Request.url. The browser's
  // Host is the request target; never accept an arbitrary forwarded host.
  return new URL(`${internal.protocol}//${host}`).origin;
}
export async function readReviewBody(request:Request,limit:number){
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")throw Error("INVALID");
  const reader=request.body?.getReader();if(!reader)throw Error("INVALID");let length=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Error("INVALID");}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length;}
  const body=strictJson(new TextDecoder("utf-8",{fatal:true}).decode(bytes));if(!body||typeof body!=="object"||Array.isArray(body))throw Error("INVALID");return body as Record<string,unknown>;
}
export function createReviewDeliveryHandlers(deps:Deps){
  const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:REVIEW_HEADERS});
  async function run(request:Request,context:Context,op:"save"|"list"|"create"|"revoke"|"pdf"){
    try{
      const user=await deps.getCurrentUser();if(!user)return json({error:"Sign in to continue."},401);
      if(!deps.isEnabled())return json({error:"Report not found."},404);
      const {id:caseId,reportId,shareId}=await context.params;
      if(![caseId,reportId,...(op==="revoke"?[shareId]:[])].every(uuid))return json({error:"Report not found."},404);
      let origin:string;try{origin=reviewRequestOrigin(request);}catch{return json({error:"Request not allowed."},403);}
      if(op!=="list"&&((request.headers.get("origin")&&request.headers.get("origin")!==origin)||request.headers.get("sec-fetch-site")==="cross-site"))return json({error:"Request not allowed."},403);
      if(op==="list")return json({shares:await deps.shares().list(user.userId,caseId,reportId)});
      if(op==="revoke"){await deps.shares().revoke(user.userId,caseId,reportId,shareId!);return json({revoked:true});}
      let b:Record<string,unknown>;try{b=await readReviewBody(request,op==="pdf"?1600000:100000);}catch{return json({error:"Invalid delivery request."},400);}
      const repo=deps.repository(),r=await repo.report(user.userId,caseId,reportId);if(!r)return json({error:"Report not found."},404);
      if(op==="save"){
        if(!validSaveRequest(b,r))return json({error:"Check the delivery fields and confirm your review before approval."},400);
        return json({saved:await repo.save(user.userId,caseId,r,b)});
      }
      if(Object.keys(b).some(k=>!(op==="pdf"?["expectedRevision","branding"]:["expectedRevision"]).includes(k))||!Number.isSafeInteger(b.expectedRevision)||Number(b.expectedRevision)<1)return json({error:"Select an approved revision."},400);
      if(op==="create"){const s=await deps.shares().create(user.userId,caseId,reportId,Number(b.expectedRevision));return json({id:s.id,url:buildReportShareUrl(origin,s.token),revisionId:s.revision_id,expiresAt:s.expires_at},201);}
      const s=await repo.revision(user.userId,caseId,r);if(!s||s.status!=="approved")throw new ReportShareNeedsReviewError();
      if(s.revision!==b.expectedRevision)throw new ReviewDeliveryError("CONFLICT");
      let brand;try{brand=parsePdfBranding(b.branding);}catch{return json({error:"Choose a PNG or JPEG logo."},400);}
      return await deps.pdf(projectReviewDelivery(r,s),brand);
    }catch(e){
      if(e instanceof ReportShareNotFoundError)return json({error:"Report not found."},404);
      if(e instanceof ReportShareNeedsReviewError)return json({error:"Approve the latest saved revision first."},409);
      if(e instanceof ReviewDeliveryError&&e.code==="CONFLICT")return json({error:"A newer revision was saved. Keep your edits and reload the latest version."},409);
      if(e instanceof Error&&e.message==="CAPABILITY_PDF_UNSUPPORTED_TEXT")return json({error:"Some characters are unsupported by the PDF font. Your approved online report remains available."},422);
      return json({error:"The operation could not be verified. Retry the same request."},503);
    }
  }
  return {save:(r:Request,c:Context)=>run(r,c,"save"),list:(r:Request,c:Context)=>run(r,c,"list"),create:(r:Request,c:Context)=>run(r,c,"create"),revoke:(r:Request,c:Context)=>run(r,c,"revoke"),pdf:(r:Request,c:Context)=>run(r,c,"pdf")};
}
