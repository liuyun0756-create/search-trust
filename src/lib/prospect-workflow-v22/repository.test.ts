import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { SupabaseProspectWorkflowRepository } from "./repository";

const workflow = { id: "33333333-3333-4333-8333-333333333333", user_id: "owner", workflow_kind: "prospect", case_id: "22222222-2222-4222-8222-222222222222", discovery_job_id: "44444444-4444-4444-8444-444444444444", analysis_job_id: null, state: "reserved" };

function database(row = workflow) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return query; }),
    maybeSingle: vi.fn(async () => ({ data: Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value) ? row : null, error: null })),
  };
  const from = vi.fn(() => query);
  return { db: { from } as unknown as SupabaseClient, from, query };
}

describe("prospect workflow recovery ownership", () => {
  it("returns the owned prospect binding and excludes private columns", async () => {
    const { db, from, query } = database();
    const recovered = await new SupabaseProspectWorkflowRepository(db).recover("owner", workflow.id);
    expect(from).toHaveBeenCalledWith("workflow_charges");
    expect(query.select).toHaveBeenCalledWith("id,case_id,discovery_job_id,analysis_job_id,state");
    expect(recovered).toMatchObject({ workflow_id: workflow.id, case_id: workflow.case_id });
    expect(recovered).not.toHaveProperty("user_id");
  });
  it("does not expose another owner's binding or a different workflow kind", async () => {
    expect(await new SupabaseProspectWorkflowRepository(database().db).recover("someone-else", workflow.id)).toBeNull();
    expect(await new SupabaseProspectWorkflowRepository(database({ ...workflow, workflow_kind: "review" }).db).recover("owner", workflow.id)).toBeNull();
  });
});
