import type { SupabaseClient } from "@supabase/supabase-js";

export interface OwnedAnalysisJob {
  id: string;
  caseId: string;
  reportId: string | null;
}

export interface AnalysisRepository {
  start(userId: string, caseId: string, jobId: string, idempotencyKey: string): Promise<void>;
  getOwned(userId: string, jobId: string): Promise<OwnedAnalysisJob | null>;
}

export class AnalysisPersistenceError extends Error {
  constructor() {
    super("The analysis task could not be saved.");
    this.name = "AnalysisPersistenceError";
  }
}

export class SupabaseAnalysisRepository implements AnalysisRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async start(userId: string, caseId: string, jobId: string, idempotencyKey: string): Promise<void> {
    const { data, error } = await this.supabase.rpc("start_v22_prospect_analysis", {
      p_user_id: userId,
      p_case_id: caseId,
      p_job_id: jobId,
      p_idempotency_key: idempotencyKey,
    }).single();
    if (error || !data) throw new AnalysisPersistenceError();
  }

  async getOwned(userId: string, jobId: string): Promise<OwnedAnalysisJob | null> {
    const { data: job, error: jobError } = await this.supabase
      .from("analysis_jobs")
      .select("id,case_id,report_id")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) throw new AnalysisPersistenceError();
    if (!job) return null;
    const { data: ownedCase, error: caseError } = await this.supabase
      .from("client_cases")
      .select("id")
      .eq("id", job.case_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (caseError) throw new AnalysisPersistenceError();
    return ownedCase ? { id: job.id as string, caseId: job.case_id as string, reportId: job.report_id as string | null } : null;
  }
}
