import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { signCallbackBody } from "./callback-signature";
import type { JobCallbackEvent } from "./callback-contract";
import { createJobEventHandler } from "./handlers";
import type { JobEventRepository } from "./repository";

const secret = "callback-secret";
const now = 1787817600;
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

function request(payload: unknown = event, overrides: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  return new NextRequest("http://localhost/api/internal/v2/job-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-searchtrust-signature-version": "v1",
      "x-searchtrust-timestamp": String(now),
      "x-searchtrust-event-id": event.event_id,
      "x-searchtrust-signature": signCallbackBody(secret, now, body, "v1"),
      ...overrides,
    },
    body,
  });
}

function repositoryWith(result: Awaited<ReturnType<JobEventRepository["apply"]>>): JobEventRepository {
  return { apply: vi.fn(async () => result) };
}

describe("v2.2 job callback handler", () => {
  it("rejects invalid signatures before constructing a repository", async () => {
    const createRepository = vi.fn(() => repositoryWith({
      found: true, applied: true, terminalEffectsApplied: false, stateRevision: 2,
    }));
    const handler = createJobEventHandler({
      getSecret: () => secret,
      nowSeconds: () => now,
      createRepository,
      runTerminalEffects: async () => undefined,
    });

    const response = await handler.POST(request(event, { "x-searchtrust-signature": `sha256=${"0".repeat(64)}` }));

    expect(response.status).toBe(401);
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown jobs and ignores duplicate or stale revisions", async () => {
    const unknownHandler = createJobEventHandler({
      getSecret: () => secret,
      nowSeconds: () => now,
      createRepository: () => repositoryWith({
        found: false, applied: false, terminalEffectsApplied: false, stateRevision: 0,
      }),
      runTerminalEffects: async () => undefined,
    });
    expect((await unknownHandler.POST(request())).status).toBe(404);

    const effects = vi.fn(async () => undefined);
    const duplicateHandler = createJobEventHandler({
      getSecret: () => secret,
      nowSeconds: () => now,
      createRepository: () => repositoryWith({
        found: true, applied: false, terminalEffectsApplied: false, stateRevision: 4,
      }),
      runTerminalEffects: effects,
    });
    const duplicate = await duplicateHandler.POST(request());
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ applied: false, idempotent: true, state_revision: 4 });
    expect(effects).not.toHaveBeenCalled();
  });

  it("runs the terminal extension only when the database atomically claims it", async () => {
    const terminal = {
      ...event,
      event_id: `${event.job_id}:3`,
      revision: 3,
      status: "failed" as const,
      stage: "failed" as const,
      completed_at: "2026-08-27T08:02:00Z",
      error: {
        error_code: "JOB_RETRY_EXHAUSTED",
        user_message: "Please retry later.",
        retryable: true,
        stage: "failed" as const,
        diagnostic_id: "77777777-7777-4777-8777-777777777777",
      },
    };
    const effects = vi.fn(async () => undefined);
    const handler = createJobEventHandler({
      getSecret: () => secret,
      nowSeconds: () => now,
      createRepository: () => repositoryWith({
        found: true, applied: true, terminalEffectsApplied: true, stateRevision: 3,
      }),
      runTerminalEffects: effects,
    });

    const response = await handler.POST(request(terminal, {
      "x-searchtrust-event-id": terminal.event_id,
      "x-searchtrust-signature": signCallbackBody(secret, now, JSON.stringify(terminal), "v1"),
    }));

    expect(response.status).toBe(200);
    expect(effects).toHaveBeenCalledTimes(1);
    expect(effects).toHaveBeenCalledWith(terminal);
  });
});

