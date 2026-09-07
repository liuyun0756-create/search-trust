import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createGa4SyncHandlers } from "./ga4-handlers";

const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
function setup(enabled = true, signedIn = true) {
  const service = { request: vi.fn(async () => ({ job_id: id, status: "queued" })), status: vi.fn(async () => ({ job: null, snapshot: null })) };
  const factory = vi.fn(() => service);
  return { service, factory, handlers: createGa4SyncHandlers({ enabled: () => enabled,
    user: async () => signedIn ? { userId: id } : null, service: factory }) };
}
function request(body: object, origin = "https://example.test") {
  return new NextRequest("https://example.test/api", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
}
const input = { binding_id: id, request_key: id, confirm_sync: true };

describe("private GA4 sync requests", () => {
  it.each([[false, true, 503], [true, false, 401]])("blocks disabled or unauthenticated requests", async (enabled, user, status) => {
    const f = setup(Boolean(enabled), Boolean(user));
    expect((await f.handlers.POST(request(input), context)).status).toBe(status);
    expect(f.factory).not.toHaveBeenCalled();
  });
  it("requires explicit intent and valid request/binding identifiers", async () => {
    for (const bad of [{ ...input, confirm_sync: false }, { ...input, binding_id: "bad" }, { ...input, request_key: "bad" }]) {
      const f = setup(); expect((await f.handlers.POST(request(bad), context)).status).toBe(400);
      expect(f.service.request).not.toHaveBeenCalled();
    }
  });
  it("rejects CSRF and oversized payloads", async () => {
    const f = setup();
    expect((await f.handlers.POST(request(input, "https://evil.test"), context)).status).toBe(403);
    expect((await f.handlers.POST(request({ ...input, extra: "x".repeat(1024) }), context)).status).toBe(400);
  });
  it("passes only Case intent and never client credentials, hosts or health claims", async () => {
    const f = setup();
    const response = await f.handlers.POST(request({ ...input, access_token: "fake-secret", user_id: "forged",
      host_filter: ["other.test"], resource_id: "properties/9", health_status: "healthy" }), context);
    expect(response.status).toBe(202);
    expect(f.service.request).toHaveBeenCalledWith(id, id, id, id);
    expect(JSON.stringify(await response.json())).not.toContain("fake-secret");
  });
  it("GET only reads status and unexpected failures are generic", async () => {
    const f = setup();
    expect(await (await f.handlers.GET(new NextRequest(`https://example.test/api?binding_id=${id}`), context)).json()).toEqual({ job: null, snapshot: null });
    expect(f.service.request).not.toHaveBeenCalled();
    f.service.request.mockRejectedValue(new Error("Bearer fake-secret"));
    const response = await f.handlers.POST(request(input), context);
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("fake-secret");
  });
});
