import { NextResponse } from "next/server";
import { CapabilityPersistenceError,type CapabilityRepository } from "./repository";
import type { CapabilityShareService } from "./shares";
import { ReportShareNeedsReviewError,ReportShareNotFoundError } from "../report-shares/service";
import { buildReportShareUrl } from "../report-shares/tokens";
import { buildApprovedCapabilityDelivery,type ApprovedCapabilityDelivery } from "./delivery";
import { parsePdfBranding,type EffectiveBranding } from "../report-pdf/branding";

export const DELIVERY_HEADERS={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive"};
type Context={params:Promise<{id:string;reportId:string;shareId?:string}>};
type Dependencies={
  getCurrentUser():Promise<{userId:string}|null>;isEnabled():boolean;
  reports():Pick<CapabilityRepository,"loadCompletedReport"|"loadRevision">;
  shares():Pick<CapabilityShareService,"list"|"create"|"revoke">;
  pdf(delivery:ApprovedCapabilityDelivery,branding?:EffectiveBranding):Promise<Response>;
};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:DELIVERY_HEADERS});
const failure=(status:number,error:string)=>json({error},status);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
async function readBody(request:Request) {
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json") throw new Error("INVALID_BODY");
  const reader=request.body?.getReader();if(!reader) throw new Error("INVALID_BODY");
  const chunks:Uint8Array[]=[];let total=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1_600_000){await reader.cancel();throw new Error("INVALID_BODY");}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const value:unknown=JSON.parse(new TextDecoder().decode(bytes));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("INVALID_BODY");
  return value as Record<string,unknown>;
}
export function createCapabilityDeliveryHandlers(deps:Dependencies) {
  async function handle(request:Request,context:Context,operation:"list"|"share"|"revoke"|"pdf") {
    try {
      const user=await deps.getCurrentUser();if(!user)return failure(401,"Sign in to continue.");
      if(!deps.isEnabled())return failure(404,"Report not found.");
      const {id:caseId,reportId,shareId}=await context.params;
      if(![caseId,reportId,...(operation==="revoke"?[shareId??""]:[])].every(id=>uuid.test(id)))return failure(404,"Report not found.");
      if(operation!=="list") {
        const origin=request.headers.get("origin");
        if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")return failure(403,"This request is not allowed.");
      }
      if(operation==="list")return json({shares:await deps.shares().list(user.userId,caseId,reportId)});
      if(operation==="revoke"){await deps.shares().revoke(user.userId,caseId,reportId,shareId!);return json({revoked:true});}
      let body:Record<string,unknown>;
      try {body=await readBody(request);}catch{return failure(400,"Invalid delivery request.");}
      if(Object.keys(body).some(key=>!(operation==="pdf"?["expectedRevision","branding"]:["expectedRevision"]).includes(key))
        || !Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1)return failure(400,"Select an approved revision first.");
      if(operation==="share") {
        const share=await deps.shares().create(user.userId,caseId,reportId,Number(body.expectedRevision));
        return json({id:share.id,revisionId:share.revision_id,expiresAt:share.expires_at,url:buildReportShareUrl(new URL(request.url).origin,share.token)},201);
      }
      let branding:EffectiveBranding|undefined;
      try{branding=parsePdfBranding(body.branding);}catch{return failure(400,"Logo must be a PNG or JPEG image upload.");}
      const reports=deps.reports(),report=await reports.loadCompletedReport(user.userId,caseId,reportId);
      if(!report)throw new ReportShareNotFoundError();
      const saved=await reports.loadRevision(user.userId,caseId,report);
      if(!saved||saved.status!=="approved")throw new ReportShareNeedsReviewError();
      if(saved.revision!==body.expectedRevision)throw new CapabilityPersistenceError("CAPABILITY_CONFLICT");
      return await deps.pdf(buildApprovedCapabilityDelivery(report,saved),branding);
    } catch(error) {
      if(error instanceof ReportShareNotFoundError)return failure(404,"Report not found.");
      if(error instanceof ReportShareNeedsReviewError)return failure(409,"Approve the latest saved report before delivery.");
      if(error instanceof CapabilityPersistenceError && error.code==="CAPABILITY_CONFLICT")return failure(409,"The approved version changed. Refresh and review it before delivery.");
      if(error instanceof Error && error.message==="CAPABILITY_PDF_UNSUPPORTED_TEXT")return failure(422,"Some characters are not supported by the PDF font. Your approved report is unchanged; use the online report or contact support.");
      return failure(503,"Unable to prepare this delivery. Please retry.");
    }
  }
  return {list:(r:Request,c:Context)=>handle(r,c,"list"),create:(r:Request,c:Context)=>handle(r,c,"share"),
    revoke:(r:Request,c:Context)=>handle(r,c,"revoke"),pdf:(r:Request,c:Context)=>handle(r,c,"pdf")};
}
