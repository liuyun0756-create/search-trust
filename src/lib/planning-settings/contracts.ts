import {parseTargetKeywords,type TargetKeyword,type KeywordScope} from '../target-keywords/contracts';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../report-v22/contracts/api_v2.schema.json';
const isTargetMarket=new Ajv2020({strict:false}).compile({$ref:'#/$defs/TargetMarket',$defs:schema.$defs});
type PlanningBase = {
  priority:null|"service_visibility"|"contact_path"|"business_identity";
  target_pages:string[];
  execution_conditions:{capacity:"unknown"|"limited"|"available";publishing_access:"unknown"|"needs_approval"|"available"};
};
export type PlanningSettingsV1=PlanningBase&{schema_version:"v22_planning_settings_v1"};
export type PlanningSettingsV2=PlanningBase&{schema_version:"v22_planning_settings_v2";target_keywords:TargetKeyword[];
 keyword_scope:KeywordScope;keyword_confirmation:{confirmed_by:string;confirmed_at:string}|null};
export type PlanningSettings=PlanningSettingsV1|PlanningSettingsV2;
export type PlanningSettingsView = {caseId:string;siteUrl:string;revision:number;settings:PlanningSettings};
export const defaultPlanningSettings=():PlanningSettings=>({schema_version:"v22_planning_settings_v1",priority:null,target_pages:[],
  execution_conditions:{capacity:"unknown",publishing_access:"unknown"}});
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).sort().join()===expected.sort().join();
export function parsePlanningSettings(value:unknown,siteUrl:string):PlanningSettings|null {
  const v2=record(value)&&value.schema_version==="v22_planning_settings_v2";
  if(!record(value)||!keys(value,["schema_version","priority","target_pages","execution_conditions",...(v2?["target_keywords","keyword_scope","keyword_confirmation"]:[])])
    ||!["v22_planning_settings_v1","v22_planning_settings_v2"].includes(value.schema_version as string)||![null,"service_visibility","contact_path","business_identity"].includes(value.priority as string|null)
    ||!Array.isArray(value.target_pages)||value.target_pages.length>20||new Set(value.target_pages).size!==value.target_pages.length
    ||!record(value.execution_conditions)||!keys(value.execution_conditions,["capacity","publishing_access"])
    ||!["unknown","limited","available"].includes(value.execution_conditions.capacity as string)
    ||!["unknown","needs_approval","available"].includes(value.execution_conditions.publishing_access as string))return null;
  try{
    const host=new URL(siteUrl).hostname.toLowerCase().replace(/^www\./,"");
    for(const page of value.target_pages){
      if(typeof page!=="string"||page.length>2000||/\s/.test(page))return null;
      const u=new URL(page);
      if(!["http:","https:"].includes(u.protocol)||u.username||u.password||u.hash||u.toString()!==page
        ||u.hostname.toLowerCase().replace(/^www\./,"")!==host)return null;
    }
  }catch{return null;}
  if(v2){
    const items=parseTargetKeywords(value.target_keywords),scope=value.keyword_scope,confirmed=value.keyword_confirmation;
    if(!items||!record(scope)||!keys(scope,["primary_service","target_market"])||typeof scope.primary_service!=="string"||!scope.primary_service.trim()||scope.primary_service.length>200||!isTargetMarket(scope.target_market)
      ||(confirmed!==null&&(!record(confirmed)||!keys(confirmed,["confirmed_by","confirmed_at"])||typeof confirmed.confirmed_by!=="string"||!/^[-0-9a-f]{36}$/i.test(confirmed.confirmed_by)||typeof confirmed.confirmed_at!=="string"||!Number.isFinite(Date.parse(confirmed.confirmed_at)))))return null;
    return {...structuredClone(value),target_keywords:items} as PlanningSettings;
  }
  return structuredClone(value) as PlanningSettings;
}
export function parsePlanningView(value:unknown,caseId:string):PlanningSettingsView|null {
  if(!record(value)||!keys(value,["caseId","siteUrl","revision","settings"])||value.caseId!==caseId||typeof value.siteUrl!=="string"
    ||!Number.isSafeInteger(value.revision)||(value.revision as number)<0)return null;
  const settings=parsePlanningSettings(value.settings,value.siteUrl);
  return settings?{caseId,siteUrl:value.siteUrl,revision:value.revision as number,settings}:null;
}
