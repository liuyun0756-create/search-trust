import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { GoogleConnectionRecord } from "../google-connections/contracts";
import type { CaseSourceBinding } from "@/types/database";
import { createResourceService, SupabaseResourceRepository, type ResourceRepository } from "./service";
import { ResourceError, type GoogleResource, type ResourceSelection } from "./contracts";

const resource: GoogleResource = { id: "sc-domain:example.com", name: "Server name", source: "gsc", kind: "site", parent: null,
  account_name: null, website_urls: ["sc-domain:example.com"], address: null, service_areas: [], permission: "siteOwner", selectable: true };
const input: ResourceSelection = { connection_id: "connection", source: "gsc", resource_id: resource.id, parent: null, expected_binding_id: null };
function setup() {
  const repository: ResourceRepository = { caseOwned: vi.fn(async () => true), listBindings: vi.fn(async () => []),
    bind: vi.fn(async () => ({ id: "binding" }) as CaseSourceBinding), disconnect: vi.fn(async () => {}) };
  const connections = { findConnectionById: vi.fn(async () => ({ id: "connection" }) as GoogleConnectionRecord | null) };
  const tokens = { getAccessToken: vi.fn(async () => ({ accessToken: "fake-secret", expiresAt: "later", grantedScopes: [] })) };
  const provider = { list: vi.fn(async () => ({ resources: [resource], next_page_token: null })), verify: vi.fn(async () => resource) };
  return { repository, connections, tokens, provider, service: createResourceService({ repository, connections, tokens, provider }) };
}
describe("resource authorization and binding", () => {
  it("requests a single composite RPC result and sends only server-derived metadata", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ id: "binding" }));
    const db = createClient("https://example.supabase.co", "fake-service-key", { global: { fetch: fetcher }, auth: { persistSession: false } });
    const repo = new SupabaseResourceRepository(db);
    expect(await repo.bind("user", "case", input, resource)).toEqual({ id: "binding" });
    const init = fetcher.mock.calls[0][1]!;
    expect(new Headers(init.headers).get("accept")).toBe("application/vnd.pgrst.object+json");
    expect(JSON.parse(String(init.body))).toMatchObject({ p_resource_name: "Server name", p_expected_binding_id: null });
    expect(String(init.body)).not.toContain("website_urls");
  });
  it("rejects another user's Case before token access", async () => {
    const f = setup(); vi.mocked(f.repository.caseOwned).mockResolvedValue(false);
    await expect(f.service.discover("user", "case", "connection", { source: "gsc" }, "request")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.tokens.getAccessToken).not.toHaveBeenCalled();
  });
  it("rejects another Google account before decrypting tokens", async () => {
    const f = setup(); f.connections.findConnectionById.mockResolvedValue(null);
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.tokens.getAccessToken).not.toHaveBeenCalled();
  });
  it("re-verifies on save and uses the provider's resource name", async () => {
    const f = setup();
    expect(await f.service.bind("user", "case", input, "request")).toEqual({ binding_id: "binding" });
    expect(f.provider.verify).toHaveBeenCalledWith("fake-secret", { source: "gsc", parent: null, resourceId: resource.id });
    expect(f.repository.bind).toHaveBeenCalledWith("user", "case", input, resource);
  });
  it("never persists a disappeared or forged resource", async () => {
    const f = setup(); f.provider.verify.mockResolvedValue({ ...resource, id: "forged" });
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    expect(f.repository.bind).not.toHaveBeenCalled();
  });
  it("surfaces concurrent binding changes without retrying over a newer selection", async () => {
    const f = setup(); vi.mocked(f.repository.bind).mockRejectedValue(new ResourceError("BINDING_CHANGED", 409));
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "BINDING_CHANGED" });
    expect(f.repository.bind).toHaveBeenCalledTimes(1);
  });
  it("projects only safe binding fields", async () => {
    const f = setup(); vi.mocked(f.repository.listBindings).mockResolvedValue([{ id: "b", identity_match_evidence: { secret: "fake-secret" } } as unknown as CaseSourceBinding]);
    expect(JSON.stringify(await f.service.bindings("user", "case"))).not.toContain("fake-secret");
  });
  it("disconnects only the explicit owned binding ID", async () => {
    const f = setup(); await f.service.disconnect("user", "case", "old-binding");
    expect(f.repository.disconnect).toHaveBeenCalledWith("user", "case", "old-binding");
  });
});
