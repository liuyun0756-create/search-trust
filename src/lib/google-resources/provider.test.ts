import { describe, expect, it, vi } from "vitest";
import { GoogleResourceHttpProvider } from "./provider";

function fixture(responses: unknown[]) {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(responses.shift()));
  return { fetcher, provider: new GoogleResourceHttpProvider(fetcher) };
}
describe("Google resource discovery", () => {
  it("lists only accessible GSC resources and exposes no provider extras", async () => {
    const { provider, fetcher } = fixture([{ access_token: "fake-secret", siteEntry: [
      { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
      { siteUrl: "https://example.com/blog/", permissionLevel: "siteRestrictedUser" },
      { siteUrl: "https://unverified.example", permissionLevel: "siteUnverifiedUser" },
    ] }]);
    const result = await provider.list("fake-token", { source: "gsc" });
    expect(result.resources).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("fake-secret");
    expect(fetcher.mock.calls[0]).toEqual(["https://www.googleapis.com/webmasters/v3/sites", expect.objectContaining({
      method: "GET", redirect: "error", cache: "no-store", headers: { authorization: "Bearer fake-token" },
    })]);
  });
  it("supports property-only GA permissions, account clues and pagination", async () => {
    const { provider } = fixture([{ accountSummaries: [{ account: "accounts/1", displayName: "Agency", propertySummaries: [
      { property: "properties/2", displayName: "Client" },
    ] }], nextPageToken: "next" }]);
    const result = await provider.list("fake", { source: "ga4" });
    expect(result.next_page_token).toBe("next");
    expect(result.resources[0]).toMatchObject({ id: "properties/2", account_name: "Agency", parent: "accounts/1", selectable: true });
  });
  it("verifies the property account and reads all web-stream pages, without URL query secrets", async () => {
    const { provider } = fixture([
      { name: "properties/2", account: "accounts/1", displayName: "Client" },
      { dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://example.com/?secret=fake" } }], nextPageToken: "p2" },
      { dataStreams: [{ type: "ANDROID_APP_DATA_STREAM" }, { type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://shop.example.com/" } }] },
    ]);
    const result = await provider.verify("fake", { source: "ga4", parent: "accounts/1", resourceId: "properties/2" });
    expect(result.website_urls).toEqual(["https://example.com/", "https://shop.example.com/"]);
  });
  it("rejects another property's parent", async () => {
    const { provider, fetcher } = fixture([{ name: "properties/2", account: "accounts/9" }]);
    await expect(provider.verify("fake", { source: "ga4", parent: "accounts/1", resourceId: "properties/2" })).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("lists GBP accounts then verifies a location on a later page", async () => {
    const { provider, fetcher } = fixture([
      { accounts: [{ name: "accounts/1", accountName: "My businesses" }] },
      { locations: [], nextPageToken: "more" },
      { locations: [{ name: "locations/3", title: "Plumbing", websiteUri: "https://example.com/", storefrontAddress: {
        addressLines: ["1 Main Street"], locality: "Boston", regionCode: "US",
      }, serviceArea: { places: { placeInfos: [{ placeName: "Boston" }] } } }] },
    ]);
    expect((await provider.list("fake", { source: "gbp" })).resources[0].selectable).toBe(false);
    const result = await provider.verify("fake", { source: "gbp", parent: "accounts/1", resourceId: "locations/3" });
    expect(result.address).toBe("1 Main Street, Boston, US");
    expect(result.service_areas).toEqual(["Boston"]);
    expect(String(fetcher.mock.calls[2]?.[0])).toContain("pageToken=more");
  });
  it("distinguishes a valid empty list from a provider error", async () => {
    const { provider } = fixture([{}]);
    expect(await provider.list("fake", { source: "gsc" })).toEqual({ resources: [], next_page_token: null });
    const denied = new GoogleResourceHttpProvider(vi.fn(async () => new Response("fake-secret", { status: 403 })));
    await expect(denied.list("fake", { source: "gbp" })).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
  });
  it.each(["accounts/1/../../evil", "https://evil.example", "accounts/1?x=2"])("rejects untrusted parent %s before HTTP", async parent => {
    const { provider, fetcher } = fixture([]);
    await expect(provider.list("fake", { source: "gbp", parent })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds repeated pagination instead of treating a truncated list as not found", async () => {
    const { provider } = fixture([{ locations: [], nextPageToken: "repeat" }, { locations: [], nextPageToken: "repeat" }]);
    await expect(provider.verify("fake", { source: "gbp", parent: "accounts/1", resourceId: "locations/3" })).rejects.toMatchObject({ code: "DISCOVERY_LIMIT" });
  });
  it("normalizes transport errors without returning secrets", async () => {
    const provider = new GoogleResourceHttpProvider(vi.fn(async () => { throw new Error("Bearer fake-secret timeout"); }));
    await expect(provider.list("fake", { source: "gsc" })).rejects.toMatchObject({ message: "Google resources could not be loaded. Please try again." });
  });
});
