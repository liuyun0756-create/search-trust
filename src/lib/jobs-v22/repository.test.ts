import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { JobCallbackEvent } from "./callback-contract";
import { SupabaseJobEventRepository } from "./repository";

const event: JobCallbackEvent = {
  event_id: "55555555-5555-4555-8555-555555555555:2",
  job_id: "55555555-5555-4555-8555-555555555555",
  case_id: "11111111-1111-4111-8111-111111111111",
  revision: 2,
  status: "running",
  stage: "collecting_site",
  progress: 10,
  message: "Running",
  attempt_count: 1,
  heartbeat_at: "2026-08-27T08:01:00Z",
  completed_at: null,
  error: null,
  cost_counters: {},
  occurred_at: "2026-08-27T08:01:00Z",
};

describe("Supabase job event repository", () => {
  it("uses the atomic database function and maps its result", async () => {
    const calls: unknown[][] = [];
    const supabase = {
      rpc(name: string, args: unknown) {
        calls.push([name, args]);
        return {
          single: async () => ({
            data: {
              found: true,
              applied: true,
              terminal_effects_applied: false,
              state_revision: 2,
            },
            error: null,
          }),
        };
      },
    };
    const repository = new SupabaseJobEventRepository(supabase as unknown as SupabaseClient);

    const result = await repository.apply(event);

    expect(result).toEqual({
      found: true,
      applied: true,
      terminalEffectsApplied: false,
      stateRevision: 2,
    });
    expect(calls[0][0]).toBe("apply_analysis_job_event");
    expect(calls[0][1]).toMatchObject({
      p_job_id: event.job_id,
      p_case_id: event.case_id,
      p_revision: 2,
      p_status: "running",
    });
  });
});

