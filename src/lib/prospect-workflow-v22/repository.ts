import "server-only";

import {canonicalJsonText} from "../verified-analysis-v22/digest";
import type {KeywordScope} from "../target-keywords/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseProspectWorkflowReservation, parseProspectWorkflowRecovery, type ProspectWorkflowReservation } from "./contracts";

export interface ProspectWorkflowRepository {
  reserve(input: {
    userId: string;
    caseId: string;
    workflowId: string;
    discoveryJobId: string;
    idempotencyKey: string;
    taskIdempotencyKey: string;
    keywords?:{queries:string[];planningRevision:number;scope:KeywordScope};
  }): Promise<ProspectWorkflowReservation>;
  canResumeLegacy?(userId:string,caseId:string,workflowId:string):Promise<boolean>;
  ownsDiscovery(userId: string, discoveryJobId: string): Promise<boolean>;
}

export class ProspectWorkflowPersistenceError extends Error {
  constructor(public readonly code = "PROSPECT_WORKFLOW_PERSISTENCE_FAILED") {
    super(code);
    this.name = "ProspectWorkflowPersistenceError";
  }
}

export class SupabaseProspectWorkflowRepository implements ProspectWorkflowRepository {
  constructor(private readonly db: SupabaseClient) {}

  async recover(userId: string, workflowId: string) {
    const { data, error } = await this.db.from("workflow_charges")
      .select("id,case_id,discovery_job_id,analysis_job_id,state")
      .eq("id", workflowId).eq("user_id", userId).eq("workflow_kind", "prospect").maybeSingle();
    if (error) throw new ProspectWorkflowPersistenceError();
    if (!data) return null;
    const parsed = parseProspectWorkflowRecovery({ ...data, workflow_id: data.id });
    if (!parsed) throw new ProspectWorkflowPersistenceError();
    return parsed;
  }

  async reserve(input: {
    userId: string;
    caseId: string;
    workflowId: string;
    discoveryJobId: string;
    idempotencyKey: string;
    taskIdempotencyKey: string;
    keywords?:{queries:string[];planningRevision:number;scope:KeywordScope};
  }): Promise<ProspectWorkflowReservation> {
    const { data, error } = await this.db.rpc(input.keywords?"start_v22_prospect_discovery_with_keywords":"start_v22_prospect_discovery", {
      p_user_id: input.userId,
      p_case_id: input.caseId,
      p_workflow_id: input.workflowId,
      p_discovery_job_id: input.discoveryJobId,
      p_workflow_idempotency_key: input.idempotencyKey,
      p_task_idempotency_key: input.taskIdempotencyKey,
      ...(input.keywords?{p_planning_revision:input.keywords.planningRevision,p_queries_canonical:canonicalJsonText(input.keywords.queries),p_keyword_scope:input.keywords.scope}:{}),
    }).single();
    const parsed = parseProspectWorkflowReservation(data);
    if (error || !parsed) {
      const code = error?.message?.includes("INSUFFICIENT_CREDITS")
        ? "INSUFFICIENT_CREDITS"
        : error?.message?.includes("PLANNING_SETTINGS_CONFLICT")?"PLANNING_SETTINGS_CONFLICT"
        : error?.message?.includes("TARGET_KEYWORDS")?"TARGET_KEYWORDS_DISCOVERY_CONFLICT":"PROSPECT_WORKFLOW_PERSISTENCE_FAILED";
      throw new ProspectWorkflowPersistenceError(code);
    }
    return parsed;
  }

  async canResumeLegacy(userId:string,caseId:string,workflowId:string):Promise<boolean>{
    const saved=await this.recover(userId,workflowId);
    if(!saved||saved.case_id!==caseId||saved.state!=="reserved"||saved.analysis_job_id)return false;
    const {data,error}=await this.db.from("prospect_target_keyword_bindings").select("discovery_job_id").eq("workflow_id",workflowId).limit(1);
    if(error)throw new ProspectWorkflowPersistenceError();
    return Array.isArray(data)&&data.length===0;
  }

  async ownsDiscovery(userId: string, discoveryJobId: string): Promise<boolean> {
    const { data: task, error: taskError } = await this.db.from("prospect_discovery_tasks")
      .select("workflow_charge_id").eq("discovery_job_id", discoveryJobId).maybeSingle();
    if (taskError) throw new ProspectWorkflowPersistenceError();
    if (!task) return false;
    const { data, error } = await this.db.from("workflow_charges").select("id")
      .eq("id", task.workflow_charge_id).eq("user_id", userId)
      .eq("workflow_kind", "prospect").maybeSingle();
    if (error) throw new ProspectWorkflowPersistenceError();
    return Boolean(data);
  }
}
