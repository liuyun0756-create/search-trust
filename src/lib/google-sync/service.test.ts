import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSyncService } from "./service";
function setup(outcomes: unknown[]) {
  let sequential = 0;
  const fetcher = vi.fn<typeof fetch>(async url => Response.json(outcomes[String(url).includes("/data_snapshots?") ? 3
    : String(url).includes("/google_sync_jobs?") ? 2 : sequential++]));
  const db = createClient("https://test.supabase.co", "fake-service", { global: { fetch: fetcher }, auth: { persistSession: false } });
  return { fetcher, service: createSyncService(db, () => new Date("2026-09-06T00:00:00Z")) };
}
describe("Case-owned GSC sync storage", () => {
  it("checks ownership before any job or binding access", async () => {
    const f = setup([null]);
    await expect(f.service.request("user", "case", "binding", "key")).rejects.toMatchObject({ code: "SYNC_FORBIDDEN" });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(String(f.fetcher.mock.calls[0][0])).toContain("user_id=eq.user");
  });
  it("requests one composite result from the idempotent SQL function", async () => {
    const f = setup([{ id: "case" }, { id: "binding" }, { id: "job", status: "queued", connection_id: "private" }]);
    expect(await f.service.request("user", "case", "binding", "key")).toEqual({ job_id: "job", status: "queued" });
    const call = f.fetcher.mock.calls[2];
    expect(String(call[0])).toContain("request_v22_gsc_sync");
    expect(new Headers(call[1]?.headers).get("accept")).toBe("application/vnd.pgrst.object+json");
    expect(JSON.parse(String(call[1]?.body))).toEqual({ p_user_id: "user", p_case_id: "case", p_binding_id: "binding", p_request_key: "key" });
  });
  it.each([["matched", "2026-09-01T00:00:00Z", "expired"], ["needs_confirmation", "2026-09-10T00:00:00Z", "not_checked"],
    ["matched", "2026-09-10T00:00:00Z", "healthy"]])("evaluates freshness and identity without mutating the immutable snapshot", async (identity, expires, expected) => {
    const f = setup([{ id: "case" }, { id: "binding", identity_match_status: identity }, null, { id: "snapshot", health_status: "healthy", expires_at: expires }]);
    expect((await f.service.status("user", "case", "binding")).snapshot?.effective_health_status).toBe(expected);
    expect(f.fetcher.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true);
    expect(f.fetcher.mock.calls.some(call => String(call[0]).includes("normalized_payload"))).toBe(false);
  });
});
