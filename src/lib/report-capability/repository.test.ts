import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import sample from "./contracts/fixtures/first_service-0.json";
import afterAcquisition from "./contracts/fixtures/after_acquisition-1.json";
import prospect from "./contracts/fixtures/acquisition-1.json";
import { validateCapabilityReport } from "./validate";
import { CapabilityRepository } from "./repository";
import { canonicalDigest, canonicalJsonText } from "../verified-analysis-v22/digest";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { buildApprovedCapabilityDelivery } from "./delivery";
vi.mock("server-only", () => ({}));

const input = () => structuredClone(sample).input_manifest;
const client = (result: { data: unknown; error: { code: string } | null }) => {
  const rpc = vi.fn(() => ({ single: async () => result }));
  return { rpc, repository: new CapabilityRepository({ rpc } as unknown as SupabaseClient) };
};

describe("P1 capability server boundary", () => {
  it("saves a complete revision through the completed entitlement RPC, validating its persisted identity",async()=>{
    const {report,saved}=generatedDelivery("service-first.json"),m=report.input_manifest;
    const rpc=vi.fn(()=>({single:async()=>({data:saved,error:null})}));
    const repo=new CapabilityRepository({rpc} as unknown as SupabaseClient);
    expect(await repo.saveRevision(m.user_id,m.case_id,report,saved.content)).toEqual(saved);
    expect(rpc).toHaveBeenCalledWith("save_v22_completed_report_revision",{p_user_id:m.user_id,p_case_id:m.case_id,p_report_id:report.id,p_content:saved.content});
    saved.approved_at=null;
    await expect(repo.saveRevision(m.user_id,m.case_id,report,saved.content)).rejects.toMatchObject({code:"CAPABILITY_UNAVAILABLE"});
  });
  it("loads owner-only completed workspace metadata, rejecting corrupt rows instead of hiding them",async()=>{
    const {report}=generatedDelivery("service-first.json"),m=report.input_manifest;
    const row={id:report.id,user_id:m.user_id,case_id:m.case_id,business_name:"Clinic",site_url:m.business.site_url,
      market:m.business.target_market,service:m.business.primary_service,report_type:report.report_type,version:report.version,
      generated_at:report.generated_at,delivery_revision:0,delivery_status:"original"};
    const rpc=vi.fn().mockResolvedValueOnce({data:[row],error:null}).mockResolvedValueOnce({data:[{...row,user_id:"someone-else"}],error:null});
    const repo=new CapabilityRepository({rpc} as unknown as SupabaseClient);
    expect(await repo.listCompletedReports(m.user_id)).toMatchObject([{reportId:report.id,caseId:m.case_id,deliveryStatus:"original"}]);
    expect(rpc).toHaveBeenCalledWith("list_v22_completed_capability_reports",{p_user_id:m.user_id});
    await expect(repo.listCompletedReports(m.user_id)).rejects.toMatchObject({code:"CAPABILITY_INVALID"});
  });
  it("reads completed entitlement through its dedicated gate and never falls back to a candidate", async () => {
    const { report } = generatedDelivery("service-first.json");
    const m = report.input_manifest;
    const maybeSingle = vi.fn().mockResolvedValueOnce({ data: { id: report.id, user_id: m.user_id, case_id: m.case_id,
      schema_version: "2.2.2", payload_checksum: canonicalDigest(report), payload: report }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const rpc = vi.fn(() => ({ maybeSingle }));
    const from = vi.fn();
    const repository = new CapabilityRepository({ rpc, from } as unknown as SupabaseClient);
    expect(await repository.loadCompletedReport(m.user_id, m.case_id, report.id)).toEqual(report);
    expect(rpc).toHaveBeenCalledWith("get_v22_completed_capability_report", { p_user_id: m.user_id, p_case_id: m.case_id, p_report_id: report.id });
    expect(await repository.loadCompletedReport(m.user_id, m.case_id, report.id)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["id", "user_id", "case_id", "schema_version", "payload_checksum", "payload"])("rejects a corrupt completed %s response", async (field) => {
    const { report } = generatedDelivery("service-first.json"), m = report.input_manifest;
    const row = { id: report.id, user_id: m.user_id, case_id: m.case_id, schema_version: "2.2.2", payload_checksum: canonicalDigest(report), payload: report };
    const rpc = vi.fn(() => ({ maybeSingle: async () => ({ data: { ...row, [field]: "incorrect" }, error: null }) }));
    const repository = new CapabilityRepository({ rpc } as unknown as SupabaseClient);
    await expect(repository.loadCompletedReport(m.user_id, m.case_id, report.id)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
  });
  it("rejects malformed entitlement identifiers before storage and hides database diagnostics", async () => {
    const { report } = generatedDelivery("service-first.json"), m = report.input_manifest;
    const rpc = vi.fn(() => ({ maybeSingle: async () => ({ data: null, error: { code: "XX000", message: "private" } }) }));
    const repository = new CapabilityRepository({ rpc } as unknown as SupabaseClient);
    await expect(repository.loadCompletedReport("another-user", m.case_id, report.id)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    expect(rpc).not.toHaveBeenCalled();
    await expect(repository.loadCompletedReport(m.user_id, m.case_id, report.id)).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });
  it.each(["uncompleted", "missing-revision", "draft", "approved", "pinned"])("gates approved delivery for %s without a candidate or approval fallback", async (state) => {
    const { report, saved, delivery } = generatedDelivery("service-first.json"), m = report.input_manifest;
    const rpc = vi.fn(() => ({ maybeSingle: async () => ({ data: state === "uncompleted" ? null : {
      id: report.id, user_id: m.user_id, case_id: m.case_id, schema_version: "2.2.2", payload_checksum: canonicalDigest(report), payload: report,
    }, error: null }) }));
    const revision = structuredClone(saved);
    if (state === "draft") { revision.status = revision.content.status = "draft"; revision.approved_at = null; }
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => ({ data: state === "missing-revision" ? null : revision, error: null })) };
    for (const method of [query.select, query.eq, query.order, query.limit]) method.mockReturnValue(query);
    const from = vi.fn(() => query);
    const repository = new CapabilityRepository({ rpc, from } as unknown as SupabaseClient);
    const operation = repository.loadApprovedDelivery(m.user_id, m.case_id, report.id, state === "pinned" ? saved.id : undefined);
    if (state === "draft") await expect(operation).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    else if (state === "approved" || state === "pinned") expect(await operation).toEqual(delivery);
    else expect(await operation).toBeNull();
    if (state === "uncompleted") expect(from).not.toHaveBeenCalled();
    else expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    if (state === "pinned") { expect(query.eq).toHaveBeenCalledWith("id", saved.id); expect(query.order).not.toHaveBeenCalled(); }
  });
  it("freezes only authenticated-owner input, passing exact canonical checksum bytes", async () => {
    const manifest = input();
    const f = client({ data: { payload: manifest }, error: null });
    expect(await f.repository.freezeInput(manifest.user_id, manifest.case_id, manifest.job_id, manifest)).toEqual(manifest);
    const { input_checksum, ...content } = manifest;
    expect(f.rpc.mock.calls[0]).toEqual(["freeze_v22_analysis_manifest", {
      p_user_id: manifest.user_id, p_case_id: manifest.case_id, p_job_id: manifest.job_id,
      p_manifest: manifest, p_canonical_content: canonicalJsonText(content), p_previous_canonical: null,
    }]);
    expect(input_checksum).toBe(canonicalDigest(content));
  });
  it("rejects a different user or altered digest before making a database call", async () => {
    const m = input(); const f = client({ data: null, error: null });
    await expect(f.repository.freezeInput("another-user", m.case_id, m.job_id, m)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    await expect(f.repository.freezeInput(m.user_id, m.case_id, m.job_id, { ...m, ruleset_version: "changed" })).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects a changed response basis and returns a safe conflict for stale writes", async () => {
    const m = input(); const changed = input(); changed.ruleset_version = "other";
    const f = client({ data: { payload: changed }, error: null });
    await expect(f.repository.freezeInput(m.user_id, m.case_id, m.job_id, m)).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    const conflict = client({ data: null, error: { code: "40001" } });
    await expect(conflict.repository.freezeInput(m.user_id, m.case_id, m.job_id, m)).rejects.toMatchObject({ code: "CAPABILITY_CONFLICT" });
  });
  it("does not persist a report for a different owner", async () => {
    const f = client({ data: null, error: null });
    await expect(f.repository.storeReport("another-user", sample.input_manifest.case_id, sample)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([false, true])("checks the actual previous payload before storing a change badge (parent exists=%s)", async (exists) => {
    const checked = validateCapabilityReport(structuredClone(afterAcquisition));
    if (!checked.ok) throw new Error("Invalid contract fixture");
    const report = checked.report;
    report.id = "00000000-0000-0000-0000-000000000088";
    report.input_manifest.job_id = report.id;
    report.input_manifest.previous_report!.report_id = prospect.id;
    report.input_manifest.previous_report!.payload_checksum = canonicalDigest(prospect);
    report.findings[0].judgment = "The intended enquiry route has been clarified.";
    report.changes = [{ finding_id: report.findings[0].id, previous_fingerprint: canonicalDigest(prospect.findings[0]),
      current_fingerprint: canonicalDigest(report.findings[0]), reason: "The stated judgment changed." }];
    const { input_checksum: _old, ...content } = report.input_manifest;
    report.input_manifest.input_checksum = canonicalDigest(content);
    const rpc = vi.fn(() => ({ single: async () => ({ data: { payload: report }, error: null }) }));
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: async () => ({
      data: exists ? { id: prospect.id, user_id: prospect.input_manifest.user_id, case_id: prospect.input_manifest.case_id, payload: prospect } : null, error: null,
    }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const repository = new CapabilityRepository({ rpc, from: () => query } as unknown as SupabaseClient);
    const operation = repository.storeReport(report.input_manifest.user_id, report.input_manifest.case_id, report);
    if (exists) expect(await operation).toEqual(report);
    else { await expect(operation).rejects.toMatchObject({ code: "CAPABILITY_INVALID" }); expect(rpc).not.toHaveBeenCalled(); }
  });
  it("reads the latest draft without treating it as approved and retrieves an exact older pinned revision", async () => {
    const { report, saved } = generatedDelivery("service-first.json");
    const draft = structuredClone(saved); draft.id = "00000000-0000-0000-0000-000000008888";
    draft.status = draft.content.status = "draft"; draft.revision = 2; draft.content.expected_revision = 1; draft.approved_at = null;
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query); query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValueOnce({ data: draft, error: null }).mockResolvedValueOnce({ data: saved, error: null }).mockResolvedValueOnce({ data: null, error: null });
    const repository = new CapabilityRepository({ from: () => query } as unknown as SupabaseClient);
    const user = report.input_manifest.user_id, caseId = report.input_manifest.case_id;
    const latest = await repository.loadRevision(user, caseId, report);
    expect(latest?.status).toBe("draft");
    expect(() => buildApprovedCapabilityDelivery(report, latest!)).toThrow();
    expect(query.order).toHaveBeenCalledWith("revision", { ascending: false });
    expect(query.eq.mock.calls).toContainEqual(["user_id", user]); expect(query.eq.mock.calls).toContainEqual(["case_id", caseId]);
    query.order.mockClear();
    const pinned = await repository.loadRevision(user, caseId, report, saved.id);
    expect(buildApprovedCapabilityDelivery(report, pinned!).revision).toBe(1);
    expect(query.eq.mock.calls).toContainEqual(["id", saved.id]);
    expect(query.order).not.toHaveBeenCalled();
    expect(await repository.loadRevision(user, caseId, report, saved.id)).toBeNull();
  });
  it("rejects unowned revision requests and invalid rows without a fallback to another version", async () => {
    const { report, saved } = generatedDelivery("service-first.json");
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { ...saved, user_id: "another-owner" }, error: null })) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query); query.limit.mockReturnValue(query);
    const from = vi.fn(() => query), repository = new CapabilityRepository({ from } as unknown as SupabaseClient);
    const m = report.input_manifest;
    await expect(repository.loadRevision("another-owner", m.case_id, report)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    await expect(repository.loadRevision(m.user_id, m.case_id, report, "arbitrary")).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    expect(from).not.toHaveBeenCalled();
    await expect(repository.loadRevision(m.user_id, m.case_id, report, saved.id)).rejects.toMatchObject({ code: "CAPABILITY_INVALID" });
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
