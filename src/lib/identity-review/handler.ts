import {boundedJson} from '../review-decisions/json';
import {uuid as isUuid} from '../implementation-records/contracts';
import {validCommand,validResponse} from './contracts';
type Deps={enabled():boolean;user():Promise<{userId:string}|null>;config():{baseUrl:string;token:string}|null;fetch?:typeof fetch};
export function createIdentityReviewHandler(deps:Deps){
 return async function POST(r:Request,ctx:{params:Promise<{id:string;reportId:string}>}){
  const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow',Vary:'Cookie'}});
  if(!deps.enabled())return reply({code:'NOT_FOUND'},404);
  const user=await deps.user();if(!user)return reply({code:'UNAUTHORIZED'},401);
  const {id,reportId}=await ctx.params;if(!isUuid(id)||!isUuid(reportId))return reply({code:'INVALID'},400);
  const url=new URL(r.url),host=r.headers.get('host');
  if(host&&/[\s/\\?#@]/.test(host))return reply({code:'FORBIDDEN'},403);
  const origin=host?new URL(`${url.protocol}//${host}`).origin:url.origin;
  if(r.headers.get('origin')!==origin||r.headers.get('sec-fetch-site')==='cross-site')return reply({code:'FORBIDDEN'},403);
  if(url.search||r.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return reply({code:'INVALID'},400);
  let command:Record<string,unknown>;
  try{const raw=await boundedJson(r,8192);if(!validCommand(raw))throw Error();command=raw;}catch{return reply({code:'INVALID'},400);}
  try{
   const conf=deps.config();if(!conf||!/^[\x21-\x7e]+$/.test(conf.token))throw Error();
   const base=new URL(conf.baseUrl);if(base.username||base.password||base.search||base.hash||!(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw Error();
   const response=await (deps.fetch??fetch)(`${base.href.replace(/\/$/,'')}/api/v2/identity-review`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${conf.token}`},body:JSON.stringify({...command,user_id:user.userId,case_id:id,report_id:reportId}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000)});
   const value=await boundedJson(response,response.ok?3_000_000:2048);
   if(!response.ok){if([400,404,409,413].includes(response.status))return reply({code:response.status===409?'CONFLICT':response.status===404?'UNAVAILABLE':'INVALID'},response.status);throw Error();}
   if(!validResponse(value,command.operation as string,user.userId,id,reportId))throw Error();
   return reply(value);
  }catch{return reply({code:'UNAVAILABLE'},503);}
 };
}
