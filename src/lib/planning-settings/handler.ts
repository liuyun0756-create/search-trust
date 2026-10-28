import {NextResponse} from "next/server";
import {isUuid} from "../verified-analysis-v22/contracts";
import {PlanningSettingsError,type PlanningSettingsRepository} from "./repository";
type Dependencies={enabled():boolean;user():Promise<{userId:string}|null>;repository():Pick<PlanningSettingsRepository,"read"|"save">};
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
const failure=(code:string,status:number)=>response({error:{code,message:code==="CONFLICT"?"Settings changed in another page. Reload and compare before continuing.":"Planning settings could not be confirmed. Your edits have been kept."}},status);
export function createPlanningSettingsHandlers(deps:Dependencies){
  const handle=async(request:Request,ctx:{params:Promise<{id:string}>})=>{
    if(!deps.enabled())return failure("NOT_FOUND",404);
    const user=await deps.user();if(!user)return failure("UNAUTHORIZED",401);
    const {id}=await ctx.params;if(!isUuid(id))return failure("NOT_FOUND",404);
    try{
      const repo=deps.repository();
      if(request.method==="GET")return response(await repo.read(user.userId,id));
      const url=new URL(request.url),host=request.headers.get("host"),origin=host?`${url.protocol}//${host}`:url.origin;
      if(request.headers.get("origin")!==origin||request.headers.get("sec-fetch-site")==="cross-site")return failure("FORBIDDEN",403);
      if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return failure("INVALID",415);
      const reader=request.body?.getReader();if(!reader)return failure("INVALID",400);
      let body:unknown;
      try{
        const chunks:Uint8Array[]=[];let size=0;
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>50000){await reader.cancel();return failure("TOO_LARGE",413);}chunks.push(value);}
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        body=JSON.parse(new TextDecoder().decode(bytes));
      }catch{return failure("INVALID",400);}finally{reader.releaseLock();}
      if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).sort().join()!=="expectedRevision,settings")return failure("INVALID",400);
      const b=body as {expectedRevision:number;settings:unknown};
      return response(await repo.save(user.userId,id,b.expectedRevision,b.settings));
    }catch(error){return error instanceof PlanningSettingsError?failure(error.code,error.code==="NOT_FOUND"?404:error.code==="CONFLICT"?409:error.code==="INVALID"?400:503):failure("UNAVAILABLE",503);}
  };
  return {GET:handle,PUT:handle};
}
