import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StartV22VerifiedAnalysisArgs } from "@/types/database";
import { validateReportV22 } from "../report-v22/validate";
import { isRecord, isUuid, parseVerifiedStartBinding, type VerifiedStartBinding, type VerifiedTaskRequest } from "./contracts";
import { canonicalDigest } from "./digest";

export interface VerifiedAnalysisStart {
  binding: VerifiedStartBinding;
  request: VerifiedTaskRequest;
}

export interface VerifiedAnalysisRepository {
  start(userId: string, caseId: string, jobId: string, idempotencyKey: string, previousJobId?: string | null): Promise<VerifiedAnalysisStart>;
}

export class VerifiedAnalysisPersistenceError extends Error {
  constructor() {
    super("The Verified analysis could not be started.");
    this.name = "VerifiedAnalysisPersistenceError";
  }
}

export class VerifiedAnalysisContractError extends Error {
  constructor() {
    super("The Verified analysis service returned an invalid binding.");
    this.name = "VerifiedAnalysisContractError";
  }
}

const REPORT_FIELDS = "id,user_id,case_id,report_type,parent_report_id,status,schema_version,version_number,report_v2_2";

/** Construct only with the service-role client: start RPC is unavailable to browser roles. */
export class SupabaseVerifiedAnalysisRepository implements VerifiedAnalysisRepository {
  constructor(private readonly db: SupabaseClient) {}

  private async ownedReport(userId: string, caseId: string, reportId: string) {
    const { data, error } = await this.db.from("reports").select(REPORT_FIELDS)
      .eq("id", reportId).eq("user_id", userId).eq("case_id", caseId).maybeSingle();
    if (error || !isRecord(data) || data.id !== reportId || data.user_id !== userId || data.case_id !== caseId) throw new VerifiedAnalysisPersistenceError();
    return data;
  }

  async start(userId: string, caseId: string, jobId: string, idempotencyKey: string, previousJobId: string | null = null): Promise<VerifiedAnalysisStart> {
    const { data: ownedCase, error: caseError } = await this.db.from("client_cases")
      .select("id,user_id,status,latest_report_id").eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (caseError || !isRecord(ownedCase) || ownedCase.id !== caseId || ownedCase.user_id !== userId || ownedCase.status !== "active" || !isUuid(ownedCase.latest_report_id)) throw new VerifiedAnalysisPersistenceError();
    const latest = await this.ownedReport(userId, caseId, ownedCase.latest_report_id);
    let parent = latest;
    if (latest.report_type === "verified_execution") {
      if (!isUuid(latest.parent_report_id)) throw new VerifiedAnalysisPersistenceError();
      parent = await this.ownedReport(userId, caseId, latest.parent_report_id);
    }
    if (parent.report_type !== "prospect" || parent.parent_report_id !== null || parent.status !== "paid_full" || parent.schema_version !== "2.2.0") throw new VerifiedAnalysisPersistenceError();
    const parsed = validateReportV22(parent.report_v2_2);
    if (!parsed.ok || parsed.report.identity.case_id !== caseId
      || parsed.report.report_version.report_id !== parent.id
      || parsed.report.report_version.report_type !== "prospect"
      || parsed.report.report_version.parent_report_id !== null
      || parsed.report.report_version.schema_version !== "2.2.0"
      || parsed.report.report_version.version_number !== parent.version_number) throw new VerifiedAnalysisPersistenceError();

    const { data, error } = await this.db.rpc("start_v22_verified_analysis", {
      p_user_id: userId, p_case_id: caseId, p_job_id: jobId, p_idempotency_key: idempotencyKey,
      p_parent_payload_checksum: canonicalDigest(parent.report_v2_2), p_previous_job_id: previousJobId,
      p_expected_parent_report_id: parsed.report.report_version.report_id,
    } satisfies StartV22VerifiedAnalysisArgs).single();
    if (error) throw new VerifiedAnalysisPersistenceError();
    const binding = parseVerifiedStartBinding(data);
    if (!binding || binding.job_id !== jobId || binding.parent_report_id !== parent.id) throw new VerifiedAnalysisContractError();

    // Exact checksum input: Case + RPC job/parent/GSC/GA4/public-GBP IDs below.
    // Exclude created/idempotent/audit_credits: they can change on an identical replay.
    const identity = {
      case_id: caseId, job_id: binding.job_id, parent_report_id: binding.parent_report_id,
      gsc_snapshot_id: binding.gsc_snapshot_id, ga4_snapshot_id: binding.ga4_snapshot_id,
      public_gbp_snapshot_id: binding.public_gbp_snapshot_id,
    };
    return {
      binding,
      request: {
        schema_version: "v22_verified_task_request_v1", case_id: caseId,
        parent_report_id: binding.parent_report_id, gsc_snapshot_id: binding.gsc_snapshot_id,
        ga4_snapshot_id: binding.ga4_snapshot_id, public_gbp_snapshot_id: binding.public_gbp_snapshot_id,
        input_checksum: canonicalDigest(identity),
      },
    };
  }
}
