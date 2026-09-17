import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseProspectWorkflowReservation, type ProspectWorkflowReservation } from "./contracts";

export interface ProspectWorkflowRepository {
  reserve(input: {
    userId: string;
    caseId: string;
    workflowId: string;
    discoveryJobId: string;
    idempotencyKey: string;
    taskIdempotencyKey: string;
  }): Promise<ProspectWorkflowReservation>;
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

  async reserve(input: {
    userId: string;
    caseId: string;
    workflowId: string;
    discoveryJobId: string;
    idempotencyKey: string;
    taskIdempotencyKey: string;
  }): Promise<ProspectWorkflowReservation> {
    const { data, error } = await this.db.rpc("start_v22_prospect_discovery", {
      p_user_id: input.userId,
      p_case_id: input.caseId,
      p_workflow_id: input.workflowId,
      p_discovery_job_id: input.discoveryJobId,
      p_workflow_idempotency_key: input.idempotencyKey,
      p_task_idempotency_key: input.taskIdempotencyKey,
    }).single();
    const parsed = parseProspectWorkflowReservation(data);
    if (error || !parsed) {
      const code = error?.message?.includes("INSUFFICIENT_CREDITS")
        ? "INSUFFICIENT_CREDITS"
        : "PROSPECT_WORKFLOW_PERSISTENCE_FAILED";
      throw new ProspectWorkflowPersistenceError(code);
    }
    return parsed;
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
