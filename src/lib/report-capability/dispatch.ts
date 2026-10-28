import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCapabilityDispatch } from "./runtime";
import { CapabilityPersistenceError } from "./repository";

export async function loadOwnedCapabilityDispatch(
  db: SupabaseClient, userId: string, caseId: string, jobId: string, idempotencyKey: string,
) {
  const { data, error } = await db.rpc("get_v22_capability_dispatch", {
    p_user_id: userId, p_case_id: caseId, p_job_id: jobId, p_idempotency_key: idempotencyKey,
  });
  if (error || !validateCapabilityDispatch(data) || data.user_id !== userId || data.case_id !== caseId
    || data.job_id !== jobId || data.idempotency_key !== idempotencyKey) {
    throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
  }
  return data;
}
