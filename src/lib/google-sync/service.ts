import type { SupabaseClient } from "@supabase/supabase-js";

export const SYNC_MESSAGES: Record<string, string> = {
  SYNC_DISABLED: "GSC synchronization is not available yet.",
  SYNC_FORBIDDEN: "This Case or resource is not available to you.",
  SYNC_BINDING_CHANGED: "The Case or resource changed. Refresh and confirm its identity again.",
  SYNC_INVALID_REQUEST: "Please submit a valid GSC sync request.",
  SYNC_ALREADY_RUNNING: "A sync is already in progress for this resource. Refresh its status.",
  SYNC_STORAGE_UNAVAILABLE: "Sync status could not be saved or loaded. Please try again.",
};
export class SyncRequestError extends Error {
  constructor(readonly code: string, readonly status: number) { super(SYNC_MESSAGES[code]); }
}
function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0060") throw new SyncRequestError("SYNC_ALREADY_RUNNING", 409);
  throw new SyncRequestError(error.code === "42501" ? "SYNC_FORBIDDEN" : error.code === "40001" ? "SYNC_BINDING_CHANGED" : "SYNC_STORAGE_UNAVAILABLE",
    error.code === "42501" ? 403 : error.code === "40001" ? 409 : 503);
}
const JOB_FIELDS = "id,status,attempt_count,error_code,created_at,completed_at,snapshot_id";
export function createSyncService(db: SupabaseClient, now = () => new Date()) {
  async function owned(userId: string, caseId: string, bindingId: string) {
    const c = await db.from("client_cases").select("id").eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    check(c.error);
    if (!c.data) throw new SyncRequestError("SYNC_FORBIDDEN", 403);
    const b = await db.from("case_source_bindings").select("id,identity_match_status").eq("id", bindingId).eq("case_id", caseId).eq("source_type", "gsc").eq("is_active", true).maybeSingle();
    check(b.error);
    if (!b.data) throw new SyncRequestError("SYNC_FORBIDDEN", 403);
    return b.data;
  }
  return {
    async request(userId: string, caseId: string, bindingId: string, requestKey: string) {
      await owned(userId, caseId, bindingId);
      const { data, error } = await db.rpc("request_v22_gsc_sync", { p_user_id: userId, p_case_id: caseId, p_binding_id: bindingId, p_request_key: requestKey }).single();
      check(error);
      if (!data) throw new SyncRequestError("SYNC_STORAGE_UNAVAILABLE", 503);
      const job = data as { id: string; status: string };
      return { job_id: job.id, status: job.status };
    },
    async status(userId: string, caseId: string, bindingId: string) {
      const binding = await owned(userId, caseId, bindingId);
      const [jobs, snapshots] = await Promise.all([
        db.from("google_sync_jobs").select(JOB_FIELDS).eq("user_id", userId).eq("case_id", caseId).eq("binding_id", bindingId)
          .eq("source_type", "gsc").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("data_snapshots").select("id,health_status,health_reasons,fetched_at,expires_at,coverage_start,coverage_end")
          .eq("case_id", caseId).eq("binding_id", bindingId).eq("source_type", "gsc").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      check(jobs.error); check(snapshots.error);
      const snapshot = snapshots.data;
      return { job: jobs.data, snapshot: snapshot ? { ...snapshot,
        effective_health_status: binding.identity_match_status !== "matched" ? "not_checked"
          : snapshot.expires_at && new Date(snapshot.expires_at) <= now() ? "expired" : snapshot.health_status } : null };
    },
  };
}
export type SyncService = ReturnType<typeof createSyncService>;
