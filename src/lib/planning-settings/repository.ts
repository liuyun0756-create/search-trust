import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {parsePlanningSettings,parsePlanningView,type PlanningSettingsView} from "./contracts";
import {canonicalDigest} from "../verified-analysis-v22/digest";
export class PlanningSettingsError extends Error {
  constructor(public code:"NOT_FOUND"|"CONFLICT"|"INVALID"|"UNAVAILABLE"){super(code);}
}
export class PlanningSettingsRepository {
  constructor(private db:SupabaseClient){}
  private checked(value:unknown,caseId:string):PlanningSettingsView {
    const view=parsePlanningView(value,caseId);if(!view)throw new PlanningSettingsError("UNAVAILABLE");return view;
  }
  private error(error:{code?:string;message?:string}|null){
    if(error)throw new PlanningSettingsError(error.message==="PLANNING_CASE_NOT_FOUND"?"NOT_FOUND":error.code==="40001"?"CONFLICT":error.message==="PLANNING_SETTINGS_INVALID"?"INVALID":"UNAVAILABLE");
  }
  async read(user:string,caseId:string){
    const {data,error}=await this.db.rpc("get_v22_case_planning_settings",{p_user_id:user,p_case_id:caseId});this.error(error);return this.checked(data,caseId);
  }
  async save(user:string,caseId:string,expectedRevision:number,value:unknown){
    const current=await this.read(user,caseId),settings=parsePlanningSettings(value,current.siteUrl);
    if(!settings||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new PlanningSettingsError("INVALID");
    const {data,error}=await this.db.rpc("save_v22_case_planning_settings",{p_user_id:user,p_case_id:caseId,p_expected_revision:expectedRevision,p_settings:settings});
    this.error(error);const view=this.checked(data,caseId);
    if(canonicalDigest(view.settings)!==canonicalDigest(settings)||![expectedRevision,expectedRevision+1].includes(view.revision))throw new PlanningSettingsError("UNAVAILABLE");
    return view;
  }
}
