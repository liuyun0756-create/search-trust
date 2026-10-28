import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFirstServiceEntryHandlers } from "./entry-handler";
import { parseEntryCommand } from "./entry-contract";

const id = randomUUID(),
  owner = randomUUID(),
  ctx = { params: Promise.resolve({ id }) };
const body = () => ({
  action: "start",
  workflowId: randomUUID(),
  discoveryId: randomUUID(),
  operationId: randomUUID(),
  gscSnapshotId: randomUUID(),
  ga4SnapshotId: randomUUID(),
  scopeHash: "sha256:" + "a".repeat(64),
  acceptedCredit: true,
  queries: ["repair", "repair local", "repair service"],
  websites: [],
});
function setup() {
  const repo = {
    read: vi.fn().mockResolvedValue({ caseId: id }),
    execute: vi.fn().mockResolvedValue({ caseId: id }),
  };
  const deps = {
    intakeEnabled: vi.fn(() => true),
    enabled: vi.fn(() => true),
    user: vi.fn(async () => ({ userId: owner })),
    repository: vi.fn(() => repo),
  };
  return { ...createFirstServiceEntryHandlers(deps), deps, repo };
}
function post(value: unknown = body(), origin = "http://localhost:3100") {
  return new NextRequest(
    `http://localhost:3100/api/v2/cases/${id}/first-service`,
    {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
}
describe("first-service entry HTTP boundary", () => {
  it("fails closed without touching auth or storage", async () => {
    const f = setup();
    f.deps.enabled.mockReturnValue(false);
    expect((await f.POST(post(), ctx)).status).toBe(404);
    expect(f.deps.user).not.toHaveBeenCalled();
  });
  it("authenticates before read or write", async () => {
    const f = setup();
    f.deps.user.mockResolvedValue(null as never);
    expect((await f.POST(post(), ctx)).status).toBe(401);
    expect(f.deps.repository).not.toHaveBeenCalled();
  });
  it("reads owner state without executing an operation and disables caching", async () => {
    const f = setup();
    const res = await f.GET(
      new NextRequest(`http://localhost:3100/api/v2/cases/${id}/first-service`),
      ctx,
    );
    expect(f.repo.read).toHaveBeenCalledWith(owner, id);
    expect(f.repo.execute).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin writes", async () => {
    const f = setup();
    expect(
      (await f.POST(post(body(), "https://other.example"), ctx)).status,
    ).toBe(403);
    expect(f.repo.execute).not.toHaveBeenCalled();
  });
  it("preserves loopback Host without accepting different browser origins", async () => {
    const f = setup();
    for (const origin of ["http://127.0.0.1:3100", "http://localhost:3100"]) {
      const req = new NextRequest(
        `http://127.0.0.1:3100/api/v2/cases/${id}/first-service`,
        {
          method: "POST",
          headers: {
            host: "127.0.0.1:3100",
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify(body()),
        },
      );
      expect((await f.POST(req, ctx)).status).toBe(
        origin.includes("127.0.0.1") ? 200 : 403,
      );
    }
  });
  it.each(["acceptedCredit", "extra", "identity", "queries"])(
    "rejects invalid %s before storage",
    async (field) => {
      const f = setup(),
        b = body();
      const changed =
        field === "acceptedCredit"
          ? { ...b, acceptedCredit: false }
          : field === "extra"
            ? { ...b, result: {} }
            : field === "identity"
              ? { ...b, workflowId: "bad" }
              : { ...b, queries: ["same", "same", "same"] };
      expect((await f.POST(post(changed), ctx)).status).toBe(400);
      expect(f.repo.execute).not.toHaveBeenCalled();
    },
  );
  it("limits streamed request size", async () => {
    const f = setup();
    expect((await f.POST(post({ value: "x".repeat(13000) }), ctx)).status).toBe(
      413,
    );
    expect(f.repo.execute).not.toHaveBeenCalled();
  });
  it("uses authenticated identity, not a body user", async () => {
    const f = setup(),
      b = body();
    expect((await f.POST(post(b), ctx)).status).toBe(200);
    expect(f.repo.execute).toHaveBeenCalledWith(owner, id, b);
  });
  it.each([
    "CONFLICT",
    "BUDGET_EXHAUSTED",
    "INSUFFICIENT_CREDITS",
    "NOT_READY",
    "UNAVAILABLE",
  ])("returns safe %s errors without retry or refund", async (code) => {
    const f = setup();
    f.repo.execute.mockRejectedValue({ code, message: "private secret" });
    const res = await f.POST(post(), ctx);
    expect(res.status).toBe(code === "UNAVAILABLE" ? 503 : 409);
    expect(await res.text()).not.toContain("private secret");
    expect(f.repo.execute).toHaveBeenCalledOnce();
  });
  it("rejects unsafe or duplicate supplemental domains", () => {
    for (const websites of [
      ["javascript:alert(1)"],
      ["https://a:b@example.com/"],
      ["https://x.example/", "https://www.x.example/other"],
    ])
      expect(
        parseEntryCommand({ ...body(), action: "supplement", websites }),
      ).toBeNull();
  });
});

describe("paused first-service intake", () => {
  it("retains reads and exact committed workflow recovery without execute", async () => {
    const f = setup(),
      b = body();
    f.deps.intakeEnabled.mockReturnValue(false);
    f.repo.read.mockResolvedValue({
      caseId: id,
      workflow: { id: b.workflowId },
    });
    expect((await f.POST(post(b), ctx)).status).toBe(200);
    expect(f.repo.execute).not.toHaveBeenCalled();
    expect(f.repo.read).toHaveBeenCalledWith(owner, id);
    expect(
      (await f.GET(new NextRequest(`http://localhost:3100/api/test`), ctx))
        .status,
    ).toBe(200);
  });
  it("blocks a new workflow while paused", async () => {
    const f = setup();
    f.deps.intakeEnabled.mockReturnValue(false);
    f.repo.read.mockResolvedValue({ caseId: id, workflow: null });
    const r = await f.POST(post(), ctx);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({
      error: { code: "V22_PUBLIC_ENTRY_PAUSED" },
    });
    expect(f.repo.execute).not.toHaveBeenCalled();
  });
  it("allows continuation of existing paid work and leaves unknown reads unresolved", async () => {
    const f = setup();
    f.deps.intakeEnabled.mockReturnValue(false);
    expect(
      (await f.POST(post({ ...body(), action: "refresh" }), ctx)).status,
    ).toBe(200);
    expect(f.repo.execute).toHaveBeenCalledOnce();
    f.repo.read.mockRejectedValue(Error("lost state"));
    const r = await f.POST(post(), ctx);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("lost state");
    expect(f.repo.execute).toHaveBeenCalledOnce();
  });
});
