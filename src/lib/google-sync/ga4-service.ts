import type { SupabaseClient } from "@supabase/supabase-js";
import { ga4HostsForCase } from "./ga4-hosts";

export const GA4_SYNC_MESSAGES: Record<string, string> = {
  SYNC_DISABLED: "Google Analytics synchronization is not available yet.",
  SYNC_FORBIDDEN: "This Case or Analytics resource is not available to you.",
  SYNC_BINDING_CHANGED: "The Case or Analytics property changed. Refresh and confirm its identity again.",
  SYNC_INVALID_REQUEST: "Please submit a valid Google Analytics sync request.",
  SYNC_ALREADY_RUNNING: "A sync is already in progress for this Analytics property. Refresh its status.",
  SYNC_STORAGE_UNAVAILABLE: "Analytics sync status could not be saved or loaded. Please try again.",
};
export class Ga4SyncRequestError extends Error {
  constructor(readonly code: string, readonly status: number) { super(GA4_SYNC_MESSAGES[code]); }
}
function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0060") throw new Ga4SyncRequestError("SYNC_ALREADY_RUNNING", 409);
  throw new Ga4SyncRequestError(error.code === "42501" ? "SYNC_FORBIDDEN" : error.code === "40001" ? "SYNC_BINDING_CHANGED" : "SYNC_STORAGE_UNAVAILABLE",
    error.code === "42501" ? 403 : error.code === "40001" ? 409 : 503);
}
const JOB_FIELDS = "id,status,attempt_count,error_code,created_at,completed_at,snapshot_id";
export function createGa4SyncService(db: SupabaseClient, now = () => new Date()) {
  async function owned(userId: string, caseId: string, bindingId: string) {
    const c = await db.from("client_cases").select("id,site_url,normalized_domain").eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    check(c.error);
    if (!c.data) throw new Ga4SyncRequestError("SYNC_FORBIDDEN", 403);
    const b = await db.from("case_source_bindings").select("id,identity_match_status").eq("id", bindingId).eq("case_id", caseId).eq("source_type", "ga4").eq("is_active", true).maybeSingle();
    check(b.error);
    if (!b.data) throw new Ga4SyncRequestError("SYNC_FORBIDDEN", 403);
    return { binding: b.data, hosts: ga4HostsForCase(c.data.site_url, c.data.normalized_domain) };
  }
  return {
    async request(userId: string, caseId: string, bindingId: string, requestKey: string) {
      const { hosts } = await owned(userId, caseId, bindingId);
      const { data, error } = await db.rpc("request_v22_ga4_sync", { p_user_id: userId, p_case_id: caseId,
        p_binding_id: bindingId, p_request_key: requestKey, p_filter_hosts: hosts }).single();
      check(error);
      if (!data) throw new Ga4SyncRequestError("SYNC_STORAGE_UNAVAILABLE", 503);
      const job = data as { id: string; status: string };
      return { job_id: job.id, status: job.status };
    },
    async status(userId: string, caseId: string, bindingId: string) {
      const { binding } = await owned(userId, caseId, bindingId);
      const [jobs, snapshots] = await Promise.all([
        db.from("google_sync_jobs").select(JOB_FIELDS).eq("user_id", userId).eq("case_id", caseId).eq("binding_id", bindingId)
          .eq("source_type", "ga4").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("data_snapshots").select("id,health_status,health_reasons,fetched_at,expires_at,coverage_start,coverage_end")
          .eq("case_id", caseId).eq("binding_id", bindingId).eq("source_type", "ga4").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      check(jobs.error); check(snapshots.error);
      const snapshot = snapshots.data;
      return { job: jobs.data, snapshot: snapshot ? { ...snapshot,
        effective_health_status: binding.identity_match_status !== "matched" ? "not_checked"
          : snapshot.expires_at && new Date(snapshot.expires_at) <= now() ? "expired" : snapshot.health_status } : null };
    },
  };
}
export type Ga4SyncService = ReturnType<typeof createGa4SyncService>;
