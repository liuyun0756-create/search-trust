import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createProspectWorkflowHandlers } from "./handlers";
import { ProspectWorkflowPersistenceError, type ProspectWorkflowRepository } from "./repository";

const userId = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const workflowId = "33333333-3333-4333-8333-333333333333";
const discoveryJobId = "44444444-4444-4444-8444-444444444444";
const market = { display_name: "Austin, TX", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const requestBody = {
  case_id: caseId,
  business_identity: { business_name: "Acme", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "storefront", primary_location: market, public_gbp_url: null },
  primary_service: "Plumbing",
  target_market: market,
  queries: ["plumber Austin", "best plumber Austin", "plumber near me"],
  search_language: "en",
  search_device: "mobile",
  supplemental_website_urls: [],
};

function request() {
  return new NextRequest(`http://localhost/api/v2/cases/${caseId}/prospect-workflow`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-searchtrust-workflow-id": workflowId,
      "x-searchtrust-workflow-idempotency-key": `prospect:${caseId}:${workflowId}`,
      "x-searchtrust-discovery-job-id": discoveryJobId,
      "idempotency-key": `discover:${caseId}:${discoveryJobId}`,
    },
    body: JSON.stringify(requestBody),
  });
}

function dependencies(repository: ProspectWorkflowRepository, submitDiscovery = vi.fn(async () => Response.json({ status: "queued" }, { status: 202 }))) {
  return {
    getCurrentUser: async () => ({ userId }),
    createRepository: () => repository,
    submitDiscovery,
    getDiscovery: vi.fn(async () => Response.json({})),
    retryDiscovery: vi.fn(async () => Response.json({})),
  };
}

describe("charged Prospect workflow boundary", () => {
  it("reserves before forwarding discovery and returns the resulting balance", async () => {
    const reserve = vi.fn(async () => ({
      workflow_id: workflowId,
      discovery_job_id: discoveryJobId,
      charge_state: "reserved" as const,
      created: true,
      idempotent: false,
      credit_balance: 4,
    }));
    const submitDiscovery = vi.fn(async () => Response.json({ status: "queued" }, { status: 202 }));
    const response = await createProspectWorkflowHandlers(dependencies({ reserve, ownsDiscovery: vi.fn() }, submitDiscovery)).POST(
      request(), { params: Promise.resolve({ id: caseId }) },
    );

    expect(response.status).toBe(202);
    expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(submitDiscovery.mock.invocationCallOrder[0]);
    expect(response.headers.get("x-searchtrust-credit-balance")).toBe("4");
  });

  it("never calls a provider when the account has no credit", async () => {
    const reserve = vi.fn(async () => { throw new ProspectWorkflowPersistenceError("INSUFFICIENT_CREDITS"); });
    const submitDiscovery = vi.fn();
    const response = await createProspectWorkflowHandlers(dependencies({ reserve, ownsDiscovery: vi.fn() }, submitDiscovery)).POST(
      request(), { params: Promise.resolve({ id: caseId }) },
    );

    expect(response.status).toBe(409);
    expect(submitDiscovery).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INSUFFICIENT_CREDITS" } });
  });

  it("hides a discovery task that is not owned by the signed-in user", async () => {
    const repository = { reserve: vi.fn(), ownsDiscovery: vi.fn(async () => false) };
    const handlers = createProspectWorkflowHandlers(dependencies(repository));
    const response = await handlers.GET(new NextRequest(`http://localhost/tasks/${discoveryJobId}`), {
      params: Promise.resolve({ id: discoveryJobId }),
    });
    expect(response.status).toBe(404);
  });
});
