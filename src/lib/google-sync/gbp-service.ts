import type { SupabaseClient } from "@supabase/supabase-js";

const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

export const GBP_SYNC_MESSAGES: Record<string, string> = {
  SYNC_DISABLED: "Business Profile synchronization is not available yet.",
  SYNC_FORBIDDEN: "This Case or Business Profile location is not available to you.",
  SYNC_BINDING_CHANGED: "The Case or Business Profile location changed. Refresh and confirm its identity again.",
  SYNC_INVALID_REQUEST: "Please submit a valid Business Profile sync request.",
  SYNC_ALREADY_RUNNING: "A sync is already in progress for this Business Profile location. Refresh its status.",
  SYNC_STORAGE_UNAVAILABLE: "Business Profile sync status could not be saved or loaded. Please try again.",
};

export class GbpSyncRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(GBP_SYNC_MESSAGES[code]);
  }
}

function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0060") throw new GbpSyncRequestError("SYNC_ALREADY_RUNNING", 409);
  throw new GbpSyncRequestError(
    error.code === "42501" ? "SYNC_FORBIDDEN" : error.code === "40001" ? "SYNC_BINDING_CHANGED" : "SYNC_STORAGE_UNAVAILABLE",
    error.code === "42501" ? 403 : error.code === "40001" ? 409 : 503,
  );
}

const JOB_FIELDS = "id,status,attempt_count,error_code,created_at,completed_at,snapshot_id";

export function createGbpSyncService(db: SupabaseClient, now = () => new Date()) {
  async function owned(userId: string, caseId: string, bindingId: string) {
    const caseResult = await db.from("client_cases").select("id").eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    check(caseResult.error);
    if (!caseResult.data) throw new GbpSyncRequestError("SYNC_FORBIDDEN", 403);

    const bindingResult = await db.from("case_source_bindings").select("id,connection_id,identity_match_status,confirmed_at").eq("id", bindingId)
      .eq("case_id", caseId).eq("source_type", "gbp").eq("is_active", true).maybeSingle();
    check(bindingResult.error);
    if (!bindingResult.data) throw new GbpSyncRequestError("SYNC_FORBIDDEN", 403);

    const connectionResult = await db.from("google_connections").select("id,granted_scopes,status").eq("id", bindingResult.data.connection_id)
      .eq("user_id", userId).eq("status", "active").maybeSingle();
    check(connectionResult.error);
    const scopes = connectionResult.data?.granted_scopes;
    if (!connectionResult.data || !Array.isArray(scopes) || !scopes.includes(GBP_SCOPE)) {
      throw new GbpSyncRequestError("SYNC_FORBIDDEN", 403);
    }
    return bindingResult.data;
  }

  return {
    async request(userId: string, caseId: string, bindingId: string, requestKey: string) {
      const binding = await owned(userId, caseId, bindingId);
      if (binding.identity_match_status !== "matched" || !binding.confirmed_at) {
        throw new GbpSyncRequestError("SYNC_BINDING_CHANGED", 409);
      }
      const { data, error } = await db.rpc("request_v22_gbp_sync", {
        p_user_id: userId,
        p_case_id: caseId,
        p_binding_id: bindingId,
        p_request_key: requestKey,
      }).single();
      check(error);
      if (!data) throw new GbpSyncRequestError("SYNC_STORAGE_UNAVAILABLE", 503);
      const job = data as { id: string; status: string };
      return { job_id: job.id, status: job.status };
    },

    async status(userId: string, caseId: string, bindingId: string) {
      const binding = await owned(userId, caseId, bindingId);
      const [jobs, snapshots] = await Promise.all([
        db.from("google_sync_jobs").select(JOB_FIELDS).eq("user_id", userId).eq("case_id", caseId).eq("binding_id", bindingId)
          .eq("source_type", "gbp").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("data_snapshots").select("id,health_status,health_reasons,fetched_at,expires_at,raw_content_deleted_at,coverage_start,coverage_end")
          .eq("case_id", caseId).eq("binding_id", bindingId).eq("source_type", "gbp").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      check(jobs.error);
      check(snapshots.error);
      const snapshot = snapshots.data;
      return {
        job: jobs.data,
        snapshot: snapshot ? {
          ...snapshot,
          content_available: !snapshot.raw_content_deleted_at && (!snapshot.expires_at || new Date(snapshot.expires_at) > now()),
          effective_health_status: binding.identity_match_status !== "matched" ? "not_checked"
            : snapshot.raw_content_deleted_at || (snapshot.expires_at && new Date(snapshot.expires_at) <= now()) ? "expired"
              : snapshot.health_status,
        } : null,
      };
    },
  };
}

export type GbpSyncService = ReturnType<typeof createGbpSyncService>;
