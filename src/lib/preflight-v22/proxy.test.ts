import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createDiscoveryStatusProxy, createDiscoverySubmitProxy, createPreflightProxy } from "./proxy";

const uuid = "11111111-1111-4111-8111-111111111111";
const market = { display_name: "Austin, TX, US", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const business = { business_name: "Acme Plumbing", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "hybrid", primary_location: market, public_gbp_url: null };

const dependencies = (fetcher: typeof fetch) => ({
  getConfig: () => ({ baseUrl: "https://internal.example", token: "server-secret" }),
  fetcher,
  timeoutMs: 1000,
});

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe("v2.2 same-origin proxy", () => {
  it("fails closed when the upstream service is not configured", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createPreflightProxy({ getConfig: () => null, fetcher });
    const response = await handler(request("/api/v2/preflight", { method: "POST", body: JSON.stringify({ site_url: "https://example.com" }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "V22_PREFLIGHT_NOT_CONFIGURED", message: "The v2.2 preflight service is not configured." } });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("adds internal auth server-side without returning it to the browser", async () => {
    const upstream = { preflight_id: uuid, normalized_site_url: "https://example.com/", identity_candidates: [], service_candidates: [], market_candidates: [], competitor_candidates: [], module_availability: [{ module_key: "site_inventory", available: true, reason: "Available." }], data_gaps: [], estimated_duration_bucket: "under_5_minutes", coverage_summary: "Ready." };
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(upstream));
    const response = await createPreflightProxy(dependencies(fetcher))(
      request("/api/v2/preflight", { method: "POST", headers: { authorization: "Bearer browser-secret" }, body: JSON.stringify({ site_url: "https://example.com" }) }),
    );
    expect(response.status).toBe(200);
    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer server-secret");
    const payload = await response.json();
    expect(payload).toEqual(upstream);
    expect(JSON.stringify(payload)).not.toContain("server-secret");
  });

  it("rejects extra request fields before making an upstream call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await createPreflightProxy(dependencies(fetcher))(
      request("/api/v2/preflight", { method: "POST", body: JSON.stringify({ site_url: "https://example.com", user_id: uuid }) }),
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards only validated discovery identifiers and payload", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ discovery_job_id: uuid, status: "queued", estimated_seconds: 120 }, { status: 202 }));
    const body = { case_id: uuid, business_identity: business, primary_service: "Plumbing", target_market: market, queries: ["plumber", "emergency plumber", "local plumber"] };
    const response = await createDiscoverySubmitProxy(dependencies(fetcher))(
      request("/api/v2/competitors/discover", { method: "POST", headers: { "x-searchtrust-discovery-job-id": uuid, "idempotency-key": `discover:${uuid}` }, body: JSON.stringify(body) }),
    );
    expect(response.status).toBe(202);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://internal.example/api/v2/competitors/discover");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-searchtrust-discovery-job-id")).toBe(uuid);
    expect(headers.get("idempotency-key")).toBe(`discover:${uuid}`);
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it("maps upstream auth failures without leaking arbitrary details", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ detail: { code: "INTERNAL_AUTH_FAILED", message: "secret=server-secret" }, trace: "private" }, { status: 401 }));
    const handler = createDiscoveryStatusProxy(dependencies(fetcher));
    const response = await handler(request(`/api/v2/competitors/tasks/${uuid}`), { params: Promise.resolve({ id: uuid }) });
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toEqual({ error: { code: "V22_SERVICE_UNAVAILABLE", message: "The analysis service is temporarily unavailable." } });
    expect(JSON.stringify(payload)).not.toContain("server-secret");
    expect(JSON.stringify(payload)).not.toContain("trace");
  });
});
