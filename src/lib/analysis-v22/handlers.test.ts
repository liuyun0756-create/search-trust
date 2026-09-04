import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAnalysisStatusHandler, createAnalysisSubmitHandler } from "./handlers";
import type { AnalysisRepository } from "./repository";

const userId = "00000000-0000-4000-8000-000000000001";
const caseId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const discoveryId = "33333333-3333-4333-8333-333333333333";
const market = { display_name: "Austin, TX", country_code: "US", region: "TX", city: "Austin", postal_code: null, latitude: null, longitude: null };
const business = { business_name: "Acme Plumbing", site_url: "https://example.com/", normalized_domain: "example.com", operating_model: "hybrid", primary_location: market, public_gbp_url: null };
const body = {
  case_id: caseId,
  report_type: "prospect",
  business_identity: business,
  primary_service: "Plumbing",
  target_market: market,
  queries: ["plumber Austin", "best plumber Austin", "plumber near me"],
  competitors: [{ competitor_id: "cp_example", business_name: "Example", website_url: "https://competitor.example/", public_gbp_url: null, confirmation_source: "user" }],
  first_party_snapshots: [],
  parent_report: null,
};

function repository(): AnalysisRepository {
  return {
    start: vi.fn(async () => undefined),
    getOwned: vi.fn(async () => ({ id: jobId, caseId, reportId: null })),
  };
}

function deps(repo: AnalysisRepository, fetcher: typeof fetch, signedIn = true) {
  return {
    getCurrentUser: async () => signedIn ? { userId } : null,
    createRepository: () => repo,
    getConfig: () => ({ baseUrl: "https://internal.example", token: "server-secret" }),
    fetcher,
    timeoutMs: 1000,
  };
}

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe("v2.2 analysis handlers", () => {
  it("reserves the owned job before submitting the exact request with server-only auth", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ job_id: jobId, status: "queued", estimated_seconds: 600 }, { status: 202 }));
    const response = await createAnalysisSubmitHandler(deps(repo, fetcher))(
      request("/api/v2/analyze", {
        method: "POST",
        headers: { "x-searchtrust-job-id": jobId, "x-searchtrust-discovery-id": discoveryId, "idempotency-key": `analyze:${jobId}` },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(202);
    expect(repo.start).toHaveBeenCalledWith(userId, caseId, jobId, `analyze:${jobId}`);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://internal.example/api/v2/analyze");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer server-secret");
    expect(headers.get("x-searchtrust-discovery-id")).toBe(discoveryId);
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it("never reserves or forwards an unauthenticated request", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>();
    const response = await createAnalysisSubmitHandler(deps(repo, fetcher, false))(
      request("/api/v2/analyze", { method: "POST", body: JSON.stringify(body) }),
    );
    expect(response.status).toBe(401);
    expect(repo.start).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks local ownership before returning upstream task state", async () => {
    const repo = repository();
    repo.getOwned = vi.fn(async () => ({ id: jobId, caseId, reportId: null }));
    const timestamp = "2026-09-04T08:00:00Z";
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      job_id: jobId, status: "running", stage: "collecting_site", progress: 20,
      message: "Collecting site evidence.", report: null, error: null,
      created_at: timestamp, updated_at: timestamp,
    }));
    const response = await createAnalysisStatusHandler(deps(repo, fetcher))(
      request(`/api/v2/tasks/${jobId}`),
      { params: Promise.resolve({ id: jobId }) },
    );
    expect(response.status).toBe(200);
    expect(repo.getOwned).toHaveBeenCalledWith(userId, jobId);
    expect(await response.json()).toMatchObject({ job_id: jobId, progress: 20, database_report_id: null });
  });
});
