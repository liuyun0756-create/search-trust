import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDiscoveryRequest, parseDiscoveryStatusResponse } from "../preflight-v22/validate";
import { isRecord, isUuid } from "../verified-analysis-v22/contracts";
import { FirstServiceStartError } from "./first-service";

export interface FirstServiceDiscoveryIdentity {
  userId: string;
  caseId: string;
  workflowId: string;
  discoveryJobId: string;
}
export interface FirstServiceDiscoveryStart extends FirstServiceDiscoveryIdentity {
  idempotencyKey: string;
  request: unknown;
  gscSnapshotId: string;
  ga4SnapshotId: string;
}
export interface FirstServiceDiscoveryReceipt {
  schema_version: "v22_first_service_discovery_v1";
  user_id: string;
  case_id: string;
  workflow_id: string;
  discovery_job_id: string;
  current_discovery_job_id?: string;
  idempotency_key: string;
  charge_state: "reserved" | "consumed" | "compensated";
  analysis_job_id: string | null;
  phase: "discovering" | "needs_competitors" | "awaiting_confirmation" | "analyzing" | "completed" | "failed";
  awaiting_confirmation: boolean;
  idempotent: boolean;
  credit_balance: number;
  created_at: string;
  deadline_at: string;
}
function identityValid(input: FirstServiceDiscoveryIdentity) {
  return [input.userId,input.caseId,input.workflowId,input.discoveryJobId].every(isUuid)
    && input.workflowId !== input.discoveryJobId;
}
function persistenceError(error: { code?: string; message?: string }): never {
  throw new FirstServiceStartError(error.code === "40001" ? "FIRST_SERVICE_CONFLICT"
    : error.message === "INSUFFICIENT_CREDITS" ? "INSUFFICIENT_CREDITS" : "FIRST_SERVICE_UNAVAILABLE");
}

/** Internal persistence seam, not a public API. Outcome must come from our backend,
 * never a browser. Resume through the current-state receipt after a continuation. */
export class FirstServiceDiscoveryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async reserve(input: FirstServiceDiscoveryStart): Promise<FirstServiceDiscoveryReceipt> {
    const parsed = parseDiscoveryRequest(input.request);
    if (!identityValid(input) || ![input.gscSnapshotId,input.ga4SnapshotId].every(isUuid)
      || input.gscSnapshotId === input.ga4SnapshotId || !/^[A-Za-z0-9._:-]{8,200}$/.test(input.idempotencyKey)
      || !parsed.ok || parsed.value.case_id !== input.caseId || !parsed.value.business_identity.public_gbp_url
      || parsed.value.queries.some(query => query.length > 300)
      || (parsed.value.search_device ?? "mobile") !== "mobile" || (parsed.value.search_language ?? "en") !== "en"
      || (parsed.value.supplemental_website_urls?.length ?? 0) !== 0) {
      throw new FirstServiceStartError("FIRST_SERVICE_INVALID");
    }
    // Transport ambiguity must recover using this same workflow and exact request.
    const {data,error} = await this.db.rpc("reserve_v22_first_service_discovery", {
      p_user_id:input.userId,p_case_id:input.caseId,p_workflow_id:input.workflowId,p_discovery_job_id:input.discoveryJobId,
      p_idempotency_key:input.idempotencyKey,p_request:parsed.value,
      p_gsc_snapshot_id:input.gscSnapshotId,p_ga4_snapshot_id:input.ga4SnapshotId,
    });
    if (error) persistenceError(error);
    if (!isRecord(data) || data.schema_version !== "v22_first_service_discovery_v1"
      || data.user_id !== input.userId || data.case_id !== input.caseId || data.workflow_id !== input.workflowId
      || data.discovery_job_id !== input.discoveryJobId || data.idempotency_key !== input.idempotencyKey
      || (data.current_discovery_job_id !== undefined && (!isUuid(data.current_discovery_job_id) || data.current_discovery_job_id === input.workflowId))
      || !["reserved","consumed","compensated"].includes(data.charge_state as string)
      || (data.analysis_job_id !== null && data.analysis_job_id !== input.workflowId)
      || !["discovering","needs_competitors","awaiting_confirmation","analyzing","completed","failed"].includes(data.phase as string)
      || (data.charge_state === "compensated" ? data.phase !== "failed"
        : data.charge_state === "consumed" ? data.phase !== "completed"
          : data.analysis_job_id !== null ? data.phase !== "analyzing"
            : !["discovering","needs_competitors","awaiting_confirmation"].includes(data.phase as string))
      || typeof data.awaiting_confirmation !== "boolean" || typeof data.idempotent !== "boolean"
      || data.awaiting_confirmation !== (data.phase === "awaiting_confirmation")
      || (data.awaiting_confirmation && (data.charge_state !== "reserved" || data.analysis_job_id !== null))
      || (data.charge_state === "consumed" && data.analysis_job_id === null)
      || !Number.isSafeInteger(data.credit_balance) || (data.credit_balance as number) < 0
      || typeof data.created_at !== "string" || typeof data.deadline_at !== "string"
      || !Number.isFinite(Date.parse(data.created_at)) || !Number.isFinite(Date.parse(data.deadline_at))
      || Date.parse(data.deadline_at) <= Date.parse(data.created_at)) {
      throw new FirstServiceStartError("FIRST_SERVICE_UNAVAILABLE");
    }
    return {
      schema_version:"v22_first_service_discovery_v1",user_id:input.userId,case_id:input.caseId,
      workflow_id:input.workflowId,discovery_job_id:input.discoveryJobId,idempotency_key:input.idempotencyKey,
      ...(data.current_discovery_job_id !== undefined ? {current_discovery_job_id:data.current_discovery_job_id as string} : {}),
      charge_state:data.charge_state as FirstServiceDiscoveryReceipt["charge_state"],analysis_job_id:data.analysis_job_id,
      phase:data.phase as FirstServiceDiscoveryReceipt["phase"],
      awaiting_confirmation:data.awaiting_confirmation,idempotent:data.idempotent,credit_balance:data.credit_balance as number,
      created_at:data.created_at,deadline_at:data.deadline_at,
    };
  }

  async recordBackendOutcome(input: FirstServiceDiscoveryIdentity, status: unknown): Promise<"pending" | "recorded" | "failed"> {
    const parsed = parseDiscoveryStatusResponse(status);
    if (!identityValid(input) || !parsed.ok || parsed.value.discovery_job_id !== input.discoveryJobId
      || (parsed.value.result && (parsed.value.result.case_id !== input.caseId || parsed.value.result.discovery_id !== input.discoveryJobId))) {
      throw new FirstServiceStartError("FIRST_SERVICE_INVALID");
    }
    if (parsed.value.status !== "succeeded" && parsed.value.status !== "failed") return "pending";
    const common = {p_user_id:input.userId,p_case_id:input.caseId,p_workflow_id:input.workflowId};
    const {error} = parsed.value.status === "succeeded"
      ? await this.db.rpc("record_v22_first_service_discovery", {...common,p_result:parsed.value.result})
      : await this.db.rpc("fail_v22_first_service_discovery", {...common,p_discovery_job_id:input.discoveryJobId,p_reason:"DISCOVERY_FAILED"});
    if (error) persistenceError(error);
    return parsed.value.status === "succeeded" ? "recorded" : "failed";
  }
}
