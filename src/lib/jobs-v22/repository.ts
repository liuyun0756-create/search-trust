import type { SupabaseClient } from "@supabase/supabase-js";

import type { JobCallbackEvent } from "./callback-contract";

export interface ApplyJobEventResult {
  found: boolean;
  applied: boolean;
  terminalEffectsApplied: boolean;
  stateRevision: number;
}

export interface JobEventRepository {
  apply(event: JobCallbackEvent): Promise<ApplyJobEventResult>;
}

export class JobEventPersistenceError extends Error {
  constructor() {
    super("Unable to apply the job event.");
    this.name = "JobEventPersistenceError";
  }
}

type RpcRow = {
  found: boolean;
  applied: boolean;
  terminal_effects_applied: boolean;
  state_revision: number;
};

export class SupabaseJobEventRepository implements JobEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async apply(event: JobCallbackEvent): Promise<ApplyJobEventResult> {
    const { data, error } = await this.supabase.rpc("apply_analysis_job_event", {
      p_job_id: event.job_id,
      p_case_id: event.case_id,
      p_revision: event.revision,
      p_status: event.status,
      p_current_stage: event.stage,
      p_progress: event.progress,
      p_attempt_count: event.attempt_count,
      p_error_code: event.error?.error_code ?? null,
      p_user_message: event.error?.user_message ?? event.message,
      p_cost_counters: event.cost_counters,
      p_heartbeat_at: event.heartbeat_at,
      p_completed_at: event.completed_at,
    }).single<RpcRow>();
    if (error || !data) throw new JobEventPersistenceError();
    return {
      found: data.found,
      applied: data.applied,
      terminalEffectsApplied: data.terminal_effects_applied,
      stateRevision: Number(data.state_revision),
    };
  }
}

