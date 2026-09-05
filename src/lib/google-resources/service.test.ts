import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { GoogleConnectionRecord } from "../google-connections/contracts";
import type { CaseSourceBinding } from "@/types/database";
import { createResourceService, identityReviewToken, SupabaseResourceRepository, type ResourceRepository } from "./service";
import { ResourceError, type GoogleResource, type ResourceSelection } from "./contracts";
import { assessIdentity, type CaseIdentity } from "./identity";

const resource: GoogleResource = { id: "sc-domain:example.com", name: "Server name", source: "gsc", kind: "site", parent: null,
  account_name: null, website_urls: ["sc-domain:example.com"], address: null, service_areas: [], permission: "siteOwner", selectable: true };
const identity: CaseIdentity = { site_url: "https://example.com/", business_name: "Example", operating_model: "storefront", business_identity: {}, target_market: {}, updated_at: "2026-09-05T00:00:00Z" };
const input: ResourceSelection = { connection_id: "connection", source: "gsc", resource_id: resource.id, parent: null, expected_binding_id: null,
  identity_review_token: identityReviewToken(identity, resource) };
function setup() {
  const repository: ResourceRepository = { caseOwned: vi.fn(async () => true), listBindings: vi.fn(async () => []),
    caseIdentity: vi.fn(async () => identity),
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
    expect(await repo.bind("user", "case", input, resource, { assessment: assessIdentity(identity, resource), method: "automatic", caseUpdatedAt: identity.updated_at })).toEqual({ id: "binding" });
    const init = fetcher.mock.calls[0][1]!;
    expect(new Headers(init.headers).get("accept")).toBe("application/vnd.pgrst.object+json");
    expect(JSON.parse(String(init.body))).toMatchObject({ p_resource_name: "Server name", p_expected_binding_id: null, p_confirmation_method: "automatic", p_assessment: { status: "matched" } });
    expect(String(fetcher.mock.calls[0][0])).toContain("select_v22_matched_google_resource");
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
    expect(f.repository.bind).toHaveBeenCalledWith("user", "case", input, resource, {
      assessment: assessIdentity(identity, resource), method: "automatic", caseUpdatedAt: identity.updated_at,
    });
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
  it("includes server assessment and a review digest in the verified preview", async () => {
    const f = setup();
    const preview = await f.service.discover("user", "case", "connection", { source: "gsc" }, "request", resource.id);
    expect(preview.resources[0]).toMatchObject({ identity_assessment: { status: "matched" }, identity_review_token: input.identity_review_token });
    expect(preview).toMatchObject({ case_identity: { business_name: "Example" } });
    expect(JSON.stringify(preview)).not.toContain("fake-secret");
  });
  it("requires a separate explicit identity confirmation for medium or low evidence", async () => {
    const f = setup(); const current = { ...identity, site_url: "https://shop.example.com/" };
    vi.mocked(f.repository.caseIdentity).mockResolvedValue(current);
    const selection = { ...input, identity_review_token: identityReviewToken(current, resource) };
    await expect(f.service.bind("user", "case", selection, "request")).rejects.toMatchObject({ code: "IDENTITY_CONFIRMATION_REQUIRED" });
    expect(f.repository.bind).not.toHaveBeenCalled();
    await f.service.bind("user", "case", { ...selection, identity_confirmed: true }, "request");
    expect(f.repository.bind).toHaveBeenCalledWith("user", "case", expect.anything(), resource, expect.objectContaining({ method: "user_confirmed" }));
  });
  it("does not let explicit confirmation override a conflicting identity", async () => {
    const f = setup(); const current = { ...identity, site_url: "https://other.test/" };
    vi.mocked(f.repository.caseIdentity).mockResolvedValue(current);
    await expect(f.service.bind("user", "case", { ...input, identity_confirmed: true, identity_review_token: identityReviewToken(current, resource) }, "request"))
      .rejects.toMatchObject({ code: "IDENTITY_MISMATCH" });
    expect(f.repository.bind).not.toHaveBeenCalled();
  });
  it("requires another preview after a Case change, resource change, or missing digest", async () => {
    const f = setup();
    await expect(f.service.bind("user", "case", { ...input, identity_review_token: undefined }, "request")).rejects.toMatchObject({ code: "IDENTITY_CHANGED" });
    vi.mocked(f.repository.caseIdentity).mockResolvedValue({ ...identity, business_name: "New name" });
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "IDENTITY_CHANGED" });
    vi.mocked(f.repository.caseIdentity).mockResolvedValue(identity);
    f.provider.verify.mockResolvedValue({ ...resource, name: "Changed in Google" });
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "IDENTITY_CHANGED" });
    expect(f.repository.bind).not.toHaveBeenCalled();
  });
  it("rechecks the Case is still owned and active after the Google request", async () => {
    const f = setup(); vi.mocked(f.repository.caseIdentity).mockResolvedValue(null);
    await expect(f.service.bind("user", "case", input, "request")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.repository.bind).not.toHaveBeenCalled();
  });
});
