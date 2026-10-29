import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createProspectRecoveryHandler } from "./recovery";
import { parseProspectWorkflowRecovery } from "./contracts";

const workflowId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";
const row = { workflow_id: workflowId, case_id: "22222222-2222-4222-8222-222222222222", discovery_job_id: "44444444-4444-4444-8444-444444444444", analysis_job_id: null, state: "reserved" as const };
const request = new NextRequest(`http://localhost/api/v2/prospect-workflows/${workflowId}`);
const context = { params: Promise.resolve({ id: workflowId }) };

describe("read-only prospect recovery", () => {
  it("returns the owned workflow's actual Case, without a reservation or provider call", async () => {
    const findWorkflow = vi.fn(async () => row);
    const handler = createProspectRecoveryHandler({ getCurrentUser: async () => ({ userId }), findWorkflow });
    const response = await handler(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(findWorkflow).toHaveBeenCalledExactlyOnceWith(userId, workflowId);
    expect(await response.json()).toEqual(row);
  });
  it("does not look up a workflow without authentication", async () => {
    const findWorkflow = vi.fn();
    const response = await createProspectRecoveryHandler({ getCurrentUser: async () => null, findWorkflow })(request, context);
    expect(response.status).toBe(401);
    expect(findWorkflow).not.toHaveBeenCalled();
  });
  it("hides workflows not owned by the caller", async () => {
    const response = await createProspectRecoveryHandler({ getCurrentUser: async () => ({ userId }), findWorkflow: async () => null })(request, context);
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty("case_id");
  });
  it("rejects an invalid ID before reading storage", async () => {
    const findWorkflow = vi.fn();
    const response = await createProspectRecoveryHandler({ getCurrentUser: async () => ({ userId }), findWorkflow })(request, { params: Promise.resolve({ id: "bad" }) });
    expect(response.status).toBe(400);
    expect(findWorkflow).not.toHaveBeenCalled();
  });
  it("fails closed when storage is unavailable or returns another workflow", async () => {
    for (const findWorkflow of [async () => { throw new Error("private storage detail"); }, async () => ({ ...row, workflow_id: row.case_id })]) {
      const response = await createProspectRecoveryHandler({ getCurrentUser: async () => ({ userId }), findWorkflow })(request, context);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private storage detail");
    }
  });
  it("requires valid case and task bindings and preserves terminal states", () => {
    expect(parseProspectWorkflowRecovery({ ...row, case_id: null })).toBeNull();
    expect(parseProspectWorkflowRecovery({ ...row, analysis_job_id: "bad" })).toBeNull();
    expect(parseProspectWorkflowRecovery({ ...row, state: "consumed", analysis_job_id: row.discovery_job_id })?.state).toBe("consumed");
    expect(parseProspectWorkflowRecovery({ ...row, state: "compensated" })?.state).toBe("compensated");
  });
});
