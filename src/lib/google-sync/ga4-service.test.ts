import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createGa4SyncService } from "./ga4-service";

function setup(outcomes: unknown[]) {
  let sequential = 0;
  const fetcher = vi.fn<typeof fetch>(async url => Response.json(outcomes[String(url).includes("/data_snapshots?") ? 3
    : String(url).includes("/google_sync_jobs?") ? 2 : sequential++]));
  const db = createClient("https://test.supabase.co", "fake-service", { global: { fetch: fetcher }, auth: { persistSession: false } });
  return { fetcher, service: createGa4SyncService(db, () => new Date("2026-09-07T00:00:00Z")) };
}
const caseRow = { id: "case", site_url: "https://www.example.co.uk/", normalized_domain: "example.co.uk" };

describe("Case-owned GA4 sync storage", () => {
  it("checks Case ownership before binding or job access", async () => {
    const f = setup([null]);
    await expect(f.service.request("user", "case", "binding", "key")).rejects.toMatchObject({ code: "SYNC_FORBIDDEN" });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it("derives the host scope server-side and requests one idempotent SQL result", async () => {
    const f = setup([caseRow, { id: "binding", identity_match_status: "matched" }, { id: "job", status: "queued", filter_hosts: ["forged"] }]);
    expect(await f.service.request("user", "case", "binding", "key")).toEqual({ job_id: "job", status: "queued" });
    const call = f.fetcher.mock.calls[2];
    expect(String(call[0])).toContain("request_v22_ga4_sync");
    expect(JSON.parse(String(call[1]?.body))).toEqual({ p_user_id: "user", p_case_id: "case", p_binding_id: "binding",
      p_request_key: "key", p_filter_hosts: ["example.co.uk", "www.example.co.uk"] });
  });
  it.each([
    ["matched", "2026-09-01T00:00:00Z", "expired"],
    ["needs_confirmation", "2026-09-10T00:00:00Z", "not_checked"],
    ["matched", "2026-09-10T00:00:00Z", "healthy"],
  ])("evaluates freshness and identity without loading immutable payloads", async (identity, expires, expected) => {
    const f = setup([caseRow, { id: "binding", identity_match_status: identity }, null,
      { id: "snapshot", health_status: "healthy", expires_at: expires }]);
    expect((await f.service.status("user", "case", "binding")).snapshot?.effective_health_status).toBe(expected);
    expect(f.fetcher.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true);
    expect(f.fetcher.mock.calls.some(call => String(call[0]).includes("normalized_payload"))).toBe(false);
    expect(f.fetcher.mock.calls.some(call => String(call[0]).includes("source_type=eq.ga4"))).toBe(true);
  });
});
