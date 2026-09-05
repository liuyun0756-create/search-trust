import { describe, expect, it } from "vitest";
import { assessIdentity, caseIdentityClues, type CaseIdentity } from "./identity";
import type { GoogleResource } from "./contracts";

const identity: CaseIdentity = { site_url: "https://example.com/", business_name: "Example Plumbing", operating_model: "storefront",
  business_identity: { primary_location: { country_code: "US", city: "Boston", postal_code: "02108", display_name: "Boston, MA" } },
  target_market: {}, updated_at: "2026-09-05T00:00:00.000Z" };
const base: GoogleResource = { id: "sc-domain:example.com", name: identity.business_name, source: "gsc", kind: "site", parent: null,
  account_name: null, website_urls: [], address: null, service_areas: [], permission: null, selectable: true };
const gbp: GoogleResource = { ...base, id: "locations/1", kind: "location", source: "gbp", parent: "accounts/1", website_urls: [identity.site_url],
  location_address: { country_code: "US", city: "Boston", postal_code: "02108" } };

describe("conservative Google identity matching", () => {
  it.each(["sc-domain:example.com", "https://EXAMPLE.com/", "https://example.com:443/?not=identity#x"])("high confidence exact GSC scope %s", id => {
    expect(assessIdentity(identity, { ...base, id })).toMatchObject({ status: "matched", confidence: "high" });
  });
  it("normalizes IDN hosts", () => {
    expect(assessIdentity({ ...identity, site_url: "https://例子.中国/" }, { ...base, id: "sc-domain:xn--fsqu00a.xn--fiqs8s" }).status).toBe("matched");
  });
  it.each(["sc-domain:evil-example.com", "sc-domain:example.com.evil.test", "sc-domain:ample.com", "https://evil.test/"])("rejects unrelated GSC scope %s", id => {
    expect(assessIdentity(identity, { ...base, id }).status).toBe("mismatch");
  });
  it.each(["sc-domain:com", "sc-domain:example.com/path", "sc-domain:example.com@evil.test", "not a url"])("never auto-confirms malformed property %s", id => {
    expect(assessIdentity(identity, { ...base, id })).toMatchObject({ status: "needs_confirmation", confidence: "low" });
  });
  it("reviews parent domain scope and never uses a bare suffix match", () => {
    expect(assessIdentity({ ...identity, site_url: "https://shop.example.com/" }, base)).toMatchObject({ status: "needs_confirmation", reasons: ["DOMAIN_BROADER"] });
    expect(assessIdentity({ ...identity, site_url: "https://notexample.com/" }, base).status).toBe("mismatch");
    expect(assessIdentity({ ...identity, site_url: "https://example.com/locations/boston" }, base).status).toBe("needs_confirmation");
  });
  it.each(["http://example.com/", "https://www.example.com/", "https://example.com:8443/", "https://example.com/shop/"])("reviews scope variants %s", id => {
    expect(assessIdentity(identity, { ...base, id }).status).toBe("needs_confirmation");
  });
  it.each(["https://example.com/shopping", "https://example.com/shopper", "https://example.com/Shop", "https://example.com/other"])("uses case-sensitive path boundaries %s", id => {
    expect(assessIdentity({ ...identity, site_url: "https://example.com/shop" }, { ...base, id }).status).toBe("mismatch");
  });
  it("reviews both broader and narrower URL-prefix scopes", () => {
    expect(assessIdentity({ ...identity, site_url: "https://example.com/shop/a" }, { ...base, id: "https://example.com/shop/" }).status).toBe("needs_confirmation");
  });
  it("never treats both missing websites as a match", () => {
    expect(assessIdentity({ ...identity, site_url: "" }, { ...gbp, website_urls: [] })).toMatchObject({ status: "needs_confirmation", confidence: "low" });
  });
  const ga = { ...base, source: "ga4" as const, kind: "property" as const, id: "properties/1" };
  it("confirms complete consistent GA4 web-stream evidence", () => {
    expect(assessIdentity(identity, { ...ga, website_urls: [identity.site_url, "https://example.com:443/"] }).status).toBe("matched");
  });
  it("never confirms a property with another website mixed in", () => {
    expect(assessIdentity(identity, { ...ga, website_urls: [identity.site_url, "https://another.test/"] })).toMatchObject({ status: "needs_confirmation", confidence: "medium", reasons: ["STREAMS_MIXED"] });
  });
  it("rejects complete GA4 evidence for another site", () => {
    expect(assessIdentity(identity, { ...ga, website_urls: ["https://another.test/"] }).status).toBe("mismatch");
  });
  it.each([{ website_urls: [] }, { website_urls: [""] }, { website_urls: ["https://user:pass@example.com/"] }])("does not match missing GA URLs %j", ({ website_urls }) => {
    expect(assessIdentity(identity, { ...ga, website_urls })).toMatchObject({ status: "needs_confirmation", confidence: "low" });
  });
  it("retains unknown streams even when one URL matches", () => {
    expect(assessIdentity(identity, { ...ga, website_urls: [identity.site_url], website_evidence_incomplete: true }).status).toBe("needs_confirmation");
    expect(assessIdentity(identity, { ...ga, website_urls: [identity.site_url, ""] }).status).toBe("needs_confirmation");
  });
  it("requires branch review for brand homepage even with matching name and postcode", () => {
    expect(assessIdentity(identity, gbp)).toMatchObject({ status: "needs_confirmation", confidence: "medium", reasons: expect.arrayContaining(["BRANCH_REVIEW"]) });
  });
  it("only auto-confirms GBP when branch URL, name, and location all agree", () => {
    const branch = { ...identity, site_url: "https://example.com/locations/boston" };
    expect(assessIdentity(branch, { ...gbp, website_urls: [branch.site_url], name: " EXAMPLE  Plumbing " })).toMatchObject({ status: "matched", confidence: "high", reasons: expect.arrayContaining(["BRANCH_EXACT"]) });
  });
  it.each([{ website_urls: [] }, { name: "Another Brand" }, { location_address: { country_code: "US", city: "Boston", postal_code: null } }])("requires review when GBP has missing or different clues %j", change => {
    const branch = { ...identity, site_url: "https://example.com/locations/boston" };
    expect(assessIdentity(branch, { ...gbp, website_urls: [branch.site_url], ...change }).status).toBe("needs_confirmation");
  });
  it("blocks a conflicting country or unrelated GBP website", () => {
    expect(assessIdentity(identity, { ...gbp, location_address: { country_code: "CA", city: "Boston", postal_code: "02108" } }).status).toBe("mismatch");
    expect(assessIdentity(identity, { ...gbp, website_urls: ["https://unrelated.test/"] }).status).toBe("mismatch");
  });
  it("uses service-area names as clues, never as automatic coverage proof", () => {
    const sab = { ...identity, operating_model: "service_area" as const };
    expect(assessIdentity(sab, { ...gbp, service_areas: ["Boston"] })).toMatchObject({ status: "needs_confirmation", reasons: expect.arrayContaining(["SERVICE_AREA_MATCH"]) });
    expect(assessIdentity(sab, { ...gbp, service_areas: ["Bostonshire"] }).reasons).toContain("SERVICE_AREA_REVIEW");
    expect(assessIdentity(sab, { ...gbp, service_areas: [] }).reasons).toContain("SERVICE_AREA_REVIEW");
  });
  it("exposes only comparison clues, not arbitrary Case JSON", () => {
    const clues = caseIdentityClues({ ...identity, business_identity: { secret: "fake-secret", primary_location: {} } });
    expect(JSON.stringify(clues)).not.toContain("fake-secret");
    expect(clues.location).toBeNull();
  });
});
