import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord, isUuid } from "../verified-analysis-v22/contracts";

/** Trusted-server seam only. Not exposed until collection/queue/UI are connected. */
export interface FirstServiceStart {
  userId: string;
  caseId: string;
  jobId: string;
  idempotencyKey: string;
  businessVersionId: string;
  gscSnapshotId: string;
  ga4SnapshotId: string;
}
export interface FirstServiceReceipt {
  schema_version: "v22_first_service_preparation_v1";
  mode: "first_service";
  user_id: string;
  case_id: string;
  job_id: string;
  idempotency_key: string;
  business_version_id: string;
  gsc_snapshot_id: string;
  ga4_snapshot_id: string;
  idempotent: boolean;
  credit_balance: number;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  deadline_at: string;
}
export class FirstServiceStartError extends Error {
  constructor(public readonly code: "FIRST_SERVICE_INVALID" | "FIRST_SERVICE_CONFLICT" | "FIRST_SERVICE_UNAVAILABLE" | "INSUFFICIENT_CREDITS") {
    super(code === "INSUFFICIENT_CREDITS" ? "One credit is required to start this analysis."
      : code === "FIRST_SERVICE_CONFLICT" ? "This request changed. Reload the current workflow before continuing."
        : "The first service analysis could not be started.");
  }
}

export class FirstServiceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async start(input: FirstServiceStart): Promise<FirstServiceReceipt> {
    const { userId, caseId, jobId, idempotencyKey, businessVersionId, gscSnapshotId, ga4SnapshotId } = input;
    if (![userId, caseId, jobId, businessVersionId, gscSnapshotId, ga4SnapshotId].every(isUuid)
      || !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey) || gscSnapshotId === ga4SnapshotId) {
      throw new FirstServiceStartError("FIRST_SERVICE_INVALID");
    }
    // Do not retry with a new key on transport failure: SQL may have committed.
    const { data, error } = await this.db.rpc("start_v22_first_service_preparation", {
      p_user_id: userId, p_case_id: caseId, p_job_id: jobId, p_idempotency_key: idempotencyKey,
      p_business_version_id: businessVersionId, p_gsc_snapshot_id: gscSnapshotId, p_ga4_snapshot_id: ga4SnapshotId,
    });
    if (error) throw new FirstServiceStartError(error.code === "40001" ? "FIRST_SERVICE_CONFLICT"
      : error.message === "INSUFFICIENT_CREDITS" ? "INSUFFICIENT_CREDITS" : "FIRST_SERVICE_UNAVAILABLE");
    if (!isRecord(data) || data.schema_version !== "v22_first_service_preparation_v1" || data.mode !== "first_service"
      || data.user_id !== userId || data.case_id !== caseId || data.job_id !== jobId || data.idempotency_key !== idempotencyKey
      || data.business_version_id !== businessVersionId || data.gsc_snapshot_id !== gscSnapshotId || data.ga4_snapshot_id !== ga4SnapshotId
      || typeof data.idempotent !== "boolean" || !Number.isSafeInteger(data.credit_balance) || (data.credit_balance as number) < 0
      || !["queued", "running", "succeeded", "failed"].includes(data.status as string)
      || typeof data.created_at !== "string" || typeof data.deadline_at !== "string"
      || !Number.isFinite(Date.parse(data.created_at)) || !Number.isFinite(Date.parse(data.deadline_at))
      || Date.parse(data.deadline_at) <= Date.parse(data.created_at)) {
      throw new FirstServiceStartError("FIRST_SERVICE_UNAVAILABLE");
    }
    // Explicit projection keeps future private SQL fields outside downstream responses.
    return {
      schema_version: "v22_first_service_preparation_v1", mode: "first_service",
      user_id: userId, case_id: caseId, job_id: jobId, idempotency_key: idempotencyKey,
      business_version_id: businessVersionId, gsc_snapshot_id: gscSnapshotId, ga4_snapshot_id: ga4SnapshotId,
      idempotent: data.idempotent, credit_balance: data.credit_balance as number,
      status: data.status as FirstServiceReceipt["status"], created_at: data.created_at, deadline_at: data.deadline_at,
    };
  }
}
