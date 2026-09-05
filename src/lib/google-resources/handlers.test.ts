import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createResourceHandlers } from "./handlers";
import type { ResourceService } from "./service";
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
function setup(user = true) {
  const service = { bindings: vi.fn(async () => []), discover: vi.fn(), bind: vi.fn(async () => ({ binding_id: id })), disconnect: vi.fn() };
  const factory = vi.fn(() => service as unknown as ResourceService);
  return { factory, service, handlers: createResourceHandlers({ getCurrentUser: async () => user ? { userId: id } : null, createService: factory }) };
}
describe("private Google resource handlers", () => {
  it("requires login before constructing a service", async () => {
    const f = setup(false);
    expect((await f.handlers.GET(new NextRequest(`https://example.test/api/${id}`), context)).status).toBe(401);
    expect(f.factory).not.toHaveBeenCalled();
  });
  it("does not cache Case resource metadata", async () => {
    const f = setup(); const result = await f.handlers.GET(new NextRequest(`https://example.test/api/${id}`), context);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({ bindings: [] });
  });
  it("requires explicit selection and expected revision", async () => {
    const f = setup(); const result = await f.handlers.POST(new NextRequest("https://example.test/api", { method: "POST", body: JSON.stringify({ source: "gsc", connection_id: id }) }), context);
    expect(result.status).toBe(400); expect(f.service.bind).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations", async () => {
    const f = setup(); const result = await f.handlers.DELETE(new NextRequest("https://example.test/api", { method: "DELETE", headers: { origin: "https://evil.test" }, body: JSON.stringify({ binding_id: id }) }), context);
    expect(result.status).toBe(403); expect(f.service.disconnect).not.toHaveBeenCalled();
  });
  it("strips client-provided names and evidence from binding requests", async () => {
    const f = setup();
    const result = await f.handlers.POST(new NextRequest("https://example.test/api", { method: "POST", body: JSON.stringify({
      source: "gsc", connection_id: id, resource_id: "sc-domain:example.com", parent: null,
      confirm_selection: true, expected_binding_id: null, name: "forged", identity_match_status: "matched",
    }) }), context);
    expect(result.status).toBe(200);
    expect(f.service.bind.mock.calls[0]).toEqual([id, id, { source: "gsc", connection_id: id, resource_id: "sc-domain:example.com", parent: null, expected_binding_id: null }, expect.any(String)]);
  });
});
