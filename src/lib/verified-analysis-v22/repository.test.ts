import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import prospect from "../report-v22/contracts/fixtures/prospect.json";
import { canonicalDigest } from "./digest";
import { SupabaseVerifiedAnalysisRepository } from "./repository";

vi.mock("server-only", () => ({}));
const userId = "00000000-0000-4000-8000-000000000001";
const caseId = prospect.identity.case_id;
const parentId = prospect.report_version.report_id;
const jobId = "33333333-3333-4333-8333-333333333333";
const latestId = "44444444-4444-4444-8444-444444444444";
const gscId = "55555555-5555-4555-8555-555555555555";
const ga4Id = "66666666-6666-4666-8666-666666666666";
const publicGbpId = "77777777-7777-4777-8777-777777777777";
const binding = { job_id: jobId, created: true, idempotent: false, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId, audit_credits: 3 };
const identity = { case_id: caseId, job_id: jobId, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId };
const parent = { id: parentId, user_id: userId, case_id: caseId, report_type: "prospect", parent_report_id: null, status: "paid_full", schema_version: "2.2.0", version_number: 1, report_v2_2: prospect };

function database(options: { latest?: Record<string, unknown>; parent?: Record<string, unknown> | null; owned?: boolean; rpcData?: unknown; rpcError?: unknown } = {}) {
  const rows: Record<string, Record<string, unknown>[]> = {
    client_cases: options.owned === false ? [] : [{ id: caseId, user_id: userId, status: "active", latest_report_id: options.latest?.id ?? parentId }],
    reports: [options.latest, options.parent === undefined ? parent : options.parent].filter((row): row is Record<string, unknown> => !!row),
  };
  const from = vi.fn((table: string) => {
    let filtered = rows[table] ?? [];
    const query = { select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => { filtered = filtered.filter((row) => row[key] === value); return query; }), maybeSingle: vi.fn(async () => ({ data: filtered[0] ?? null, error: null })) };
    return query;
  });
  const rpc = vi.fn(() => ({ single: async () => ({ data: options.rpcData === undefined ? binding : options.rpcData, error: options.rpcError ?? null }) }));
  return { db: { from, rpc } as unknown as SupabaseClient, from, rpc };
}

describe("Verified service-role repository", () => {
  it("hashes the complete stored Prospect and passes only server-resolved inputs to the RPC", async () => {
    const { db, rpc, from } = database();
    const result = await new SupabaseVerifiedAnalysisRepository(db).start(userId, caseId, jobId, "verified-attempt-1", null);
    expect(rpc).toHaveBeenCalledWith("start_v22_verified_analysis", { p_user_id: userId, p_case_id: caseId, p_job_id: jobId, p_idempotency_key: "verified-attempt-1", p_parent_payload_checksum: canonicalDigest(prospect), p_previous_job_id: null });
    expect(result).toEqual({ binding, request: { schema_version: "v22_verified_task_request_v1", case_id: caseId, parent_report_id: parentId, gsc_snapshot_id: gscId, ga4_snapshot_id: ga4Id, public_gbp_snapshot_id: publicGbpId, input_checksum: canonicalDigest(identity) } });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["client_cases", "reports"]);
  });

  it("follows latest Verified's parent to the original Prospect", async () => {
    const { db, rpc } = database({ latest: { ...parent, id: latestId, report_type: "verified_execution", parent_report_id: parentId } });
    await new SupabaseVerifiedAnalysisRepository(db).start(userId, caseId, jobId, "verified-attempt-1", latestId);
    expect(rpc).toHaveBeenCalledWith("start_v22_verified_analysis", expect.objectContaining({ p_parent_payload_checksum: canonicalDigest(prospect), p_previous_job_id: latestId }));
  });

  it("uses the RPC binding even when it differs from the preflight report", async () => {
    const { db } = database({ rpcData: { ...binding, parent_report_id: latestId } });
    const result = await new SupabaseVerifiedAnalysisRepository(db).start(userId, caseId, jobId, "verified-attempt-1");
    expect(result.request.parent_report_id).toBe(latestId);
    expect(result.request.input_checksum).toBe(canonicalDigest({ ...identity, parent_report_id: latestId }));
  });

  it("does not allow extra caller parent/snapshot arguments to change the binding", async () => {
    const { db, rpc } = database();
    const repo = new SupabaseVerifiedAnalysisRepository(db);
    // Simulate untyped caller input; the public API has no parent/snapshot parameters.
    const result = await Reflect.apply(repo.start, repo, [userId, caseId, jobId, "verified-attempt-1", null, { parent_report_id: latestId, gsc_snapshot_id: latestId }]);
    expect(result.request.parent_report_id).toBe(parentId);
    expect(result.request.gsc_snapshot_id).toBe(gscId);
    expect(rpc.mock.calls[0]).not.toContain(latestId);
  });

  it("keeps the checksum identical when replay metadata and account balance change", async () => {
    const fresh = await new SupabaseVerifiedAnalysisRepository(database().db).start(userId, caseId, jobId, "verified-attempt-1");
    const replay = await new SupabaseVerifiedAnalysisRepository(database({ rpcData: { ...binding, created: false, idempotent: true, audit_credits: 0 } }).db).start(userId, caseId, jobId, "verified-attempt-1");
    expect(replay.request).toEqual(fresh.request);
    expect(replay.binding.idempotent).toBe(true);
  });

  it.each([
    { owned: false }, { parent: null }, { parent: { ...parent, user_id: latestId } },
    { parent: { ...parent, case_id: latestId } }, { parent: { ...parent, status: "preview" } },
    { parent: { ...parent, report_type: "verified_execution", parent_report_id: parentId } },
    { parent: { ...parent, report_v2_2: {} } },
    { parent: { ...parent, report_v2_2: { ...prospect, identity: { ...prospect.identity, case_id: latestId } } } },
    { parent: { ...parent, version_number: 2 } },
    { latest: { ...parent, id: latestId, user_id: latestId, report_type: "verified_execution", parent_report_id: parentId } },
  ])("rejects unowned or invalid parent reports before debit: %s", async (options) => {
    const { db, rpc } = database(options);
    await expect(new SupabaseVerifiedAnalysisRepository(db).start(userId, caseId, jobId, "verified-attempt-1")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([null, {}, [], { ...binding, job_id: latestId }, { ...binding, created: "true" }, { ...binding, idempotent: true }, { ...binding, gsc_snapshot_id: "browser-value" }, { ...binding, audit_credits: -1 }, { ...binding, audit_credits: 1.5 }, { ...binding, public_gbp_snapshot_id: null }])("rejects malformed RPC contracts: %s", async (rpcData) => {
    await expect(new SupabaseVerifiedAnalysisRepository(database({ rpcData }).db).start(userId, caseId, jobId, "verified-attempt-1")).rejects.toThrow();
  });

  it("propagates RPC eligibility failure as a safe error", async () => {
    await expect(new SupabaseVerifiedAnalysisRepository(database({ rpcError: { message: "secret database diagnostic" } }).db).start(userId, caseId, jobId, "verified-attempt-1")).rejects.toThrow("The Verified analysis could not be started.");
  });
});
