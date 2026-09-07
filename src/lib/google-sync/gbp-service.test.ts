import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createGbpSyncService } from "./gbp-service";

const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

function setup(outcomes: unknown[]) {
  let sequential = 0;
  const fetcher = vi.fn<typeof fetch>(async url => {
    const value = String(url);
    const index = value.includes("/data_snapshots?") ? 4 : value.includes("/google_sync_jobs?") ? 3 : sequential++;
    return Response.json(outcomes[index]);
  });
  const db = createClient("https://test.supabase.co", "fake-service", {
    global: { fetch: fetcher }, auth: { persistSession: false },
  });
  return { fetcher, service: createGbpSyncService(db, () => new Date("2026-09-07T00:00:00Z")) };
}

const caseRow = { id: "case" };
const binding = { id: "binding", connection_id: "connection", identity_match_status: "matched", confirmed_at: "2026-09-01T00:00:00Z" };
const connection = { id: "connection", status: "active", granted_scopes: [GBP_SCOPE] };

describe("Case-owned GBP sync storage", () => {
  it("checks Case ownership before binding, connection or job access", async () => {
    const value = setup([null]);
    await expect(value.service.request("user", "case", "binding", "key")).rejects.toMatchObject({ code: "SYNC_FORBIDDEN" });
    expect(value.fetcher).toHaveBeenCalledTimes(1);
  });

  it("requires the exact read-only Business Profile scope before requesting SQL work", async () => {
    const value = setup([caseRow, binding, { ...connection, granted_scopes: ["openid"] }]);
    await expect(value.service.request("user", "case", "binding", "key")).rejects.toMatchObject({ code: "SYNC_FORBIDDEN" });
    expect(value.fetcher).toHaveBeenCalledTimes(3);
  });

  it("requires a currently confirmed identity before creating a sync job", async () => {
    const value = setup([caseRow, { ...binding, identity_match_status: "needs_confirmation", confirmed_at: null }, connection]);
    await expect(value.service.request("user", "case", "binding", "key")).rejects.toMatchObject({ code: "SYNC_BINDING_CHANGED" });
    expect(value.fetcher).toHaveBeenCalledTimes(3);
  });

  it("requests one idempotent GBP job without accepting a client resource or date range", async () => {
    const value = setup([caseRow, binding, connection, { id: "job", status: "queued" }]);
    expect(await value.service.request("user", "case", "binding", "key")).toEqual({ job_id: "job", status: "queued" });
    const call = value.fetcher.mock.calls[3];
    expect(String(call[0])).toContain("request_v22_gbp_sync");
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      p_user_id: "user", p_case_id: "case", p_binding_id: "binding", p_request_key: "key",
    });
  });

  it.each([
    ["matched", null, "2026-09-01T00:00:00Z", "expired", false],
    ["needs_confirmation", null, "2026-09-10T00:00:00Z", "not_checked", true],
    ["matched", "2026-09-06T00:00:00Z", "2026-09-10T00:00:00Z", "expired", false],
    ["matched", null, "2026-09-10T00:00:00Z", "healthy", true],
  ])("evaluates identity and Content expiry without loading either payload", async (identity, deleted, expires, expected, available) => {
    const value = setup([caseRow, { ...binding, identity_match_status: identity }, connection, null,
      { id: "snapshot", health_status: "healthy", raw_content_deleted_at: deleted, expires_at: expires }]);
    const snapshot = (await value.service.status("user", "case", "binding")).snapshot;
    expect(snapshot?.effective_health_status).toBe(expected);
    expect(snapshot?.content_available).toBe(available);
    expect(value.fetcher.mock.calls.some(call => String(call[0]).includes("normalized_payload"))).toBe(false);
    expect(value.fetcher.mock.calls.some(call => String(call[0]).includes("raw_payload"))).toBe(false);
    expect(value.fetcher.mock.calls.some(call => String(call[0]).includes("source_type=eq.gbp"))).toBe(true);
  });
});
