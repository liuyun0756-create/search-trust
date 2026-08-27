import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { CaseApiError } from "./errors";
import { createCaseCollectionHandlers, createCaseItemHandlers } from "./handlers";
import { parseCreateCaseInput } from "./normalize";
import type { CaseResource, CaseService } from "./service";

const userId = "00000000-0000-4000-8000-000000000001";
const caseId = "00000000-0000-4000-8000-000000000101";

const createPayload = {
  site_url: "https://www.example.com/",
  business_name: "Example Dental",
  operating_model: "storefront",
  primary_service: "Emergency dentist",
  primary_location: {
    display_name: "Austin, TX",
    country_code: "US",
    region: "Texas",
    city: "Austin",
    latitude: 30.2672,
    longitude: -97.7431,
  },
  target_market: {
    display_name: "Austin, TX",
    country_code: "US",
  },
  public_gbp_url: null,
};

const normalized = parseCreateCaseInput(createPayload);
const resource: CaseResource = {
  id: caseId,
  site_url: normalized.site_url,
  normalized_domain: normalized.normalized_domain,
  business_name: normalized.business_name,
  business_identity: normalized.business_identity,
  operating_model: normalized.operating_model,
  primary_service: normalized.primary_service,
  target_market: normalized.target_market,
  status: "active",
  latest_report_id: null,
  archived_at: null,
  created_at: "2026-08-27T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
};

function serviceWith(overrides: Partial<CaseService> = {}): CaseService {
  return {
    create: async () => resource,
    list: async (_userId, query) => ({ items: [resource], total: 1, limit: query.limit, offset: query.offset }),
    get: async () => resource,
    update: async () => resource,
    archive: async () => ({ ...resource, status: "archived", archived_at: "2026-08-27T01:00:00.000Z" }),
    ...overrides,
  };
}

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

function context(id = caseId) {
  return { params: Promise.resolve({ id }) };
}

describe("Case Route Handlers", () => {
  it("returns 401 before constructing a service for all five operations", async () => {
    const createService = vi.fn(() => serviceWith());
    const dependencies = { getCurrentUser: async () => null, createService };
    const collection = createCaseCollectionHandlers(dependencies);
    const item = createCaseItemHandlers(dependencies);

    const responses = await Promise.all([
      collection.GET(request("/api/v2/cases")),
      collection.POST(request("/api/v2/cases", { method: "POST", body: JSON.stringify(createPayload) })),
      item.GET(request(`/api/v2/cases/${caseId}`), context()),
      item.PATCH(request(`/api/v2/cases/${caseId}`, { method: "PATCH", body: "{}" }), context()),
      item.DELETE(request(`/api/v2/cases/${caseId}`, { method: "DELETE" }), context()),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
    expect(await responses[0].json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication is required." },
    });
    expect(createService).not.toHaveBeenCalled();
  });

  it("creates and lists Cases with normalized input and pagination", async () => {
    const create = vi.fn<CaseService["create"]>(async () => resource);
    const list = vi.fn<CaseService["list"]>(async (_userId, query) => ({
      items: [resource], total: 1, limit: query.limit, offset: query.offset,
    }));
    const service = serviceWith({ create, list });
    const handlers = createCaseCollectionHandlers({
      getCurrentUser: async () => ({ userId }),
      createService: () => service,
    });

    const created = await handlers.POST(request("/api/v2/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...createPayload, business_name: "  Example   Dental  " }),
    }));
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual(resource);
    expect(create).toHaveBeenCalledWith(userId, expect.objectContaining({
      business_name: "Example Dental",
      normalized_domain: "example.com",
    }));

    const listed = await handlers.GET(request("/api/v2/cases?status=all&limit=10&offset=5"));
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ items: [resource], total: 1, limit: 10, offset: 5 });
    expect(list).toHaveBeenCalledWith(userId, { status: "all", limit: 10, offset: 5 });
  });

  it("rejects invalid JSON, unknown fields, invalid query, and invalid IDs", async () => {
    const service = serviceWith();
    const dependencies = {
      getCurrentUser: async () => ({ userId }),
      createService: () => service,
    };
    const collection = createCaseCollectionHandlers(dependencies);
    const item = createCaseItemHandlers(dependencies);

    const responses = await Promise.all([
      collection.POST(request("/api/v2/cases", { method: "POST", body: "{" })),
      collection.POST(request("/api/v2/cases", {
        method: "POST",
        body: JSON.stringify({ ...createPayload, user_id: userId }),
      })),
      collection.GET(request("/api/v2/cases?limit=0")),
      item.GET(request("/api/v2/cases/not-a-uuid"), context("not-a-uuid")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400]);
    for (const response of responses) {
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    }
  });

  it("maps cross-user not-found and duplicate errors without leaking persistence details", async () => {
    const notFoundService = serviceWith({
      get: async () => { throw CaseApiError.notFound(); },
      update: async () => { throw CaseApiError.notFound(); },
      archive: async () => { throw CaseApiError.notFound(); },
    });
    const notFoundHandlers = createCaseItemHandlers({
      getCurrentUser: async () => ({ userId }),
      createService: () => notFoundService,
    });

    const notFoundResponses = await Promise.all([
      notFoundHandlers.GET(request(`/api/v2/cases/${caseId}`), context()),
      notFoundHandlers.PATCH(request(`/api/v2/cases/${caseId}`, {
        method: "PATCH", body: JSON.stringify({ business_name: "Other" }),
      }), context()),
      notFoundHandlers.DELETE(request(`/api/v2/cases/${caseId}`, { method: "DELETE" }), context()),
    ]);
    expect(notFoundResponses.map((response) => response.status)).toEqual([404, 404, 404]);
    expect(await notFoundResponses[0].json()).toEqual({
      error: { code: "CASE_NOT_FOUND", message: "Case not found." },
    });

    const duplicateHandlers = createCaseCollectionHandlers({
      getCurrentUser: async () => ({ userId }),
      createService: () => serviceWith({
        create: async () => { throw CaseApiError.duplicate(caseId, "archived"); },
      }),
    });
    const duplicate = await duplicateHandlers.POST(request("/api/v2/cases", {
      method: "POST", body: JSON.stringify(createPayload),
    }));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({
      error: {
        code: "CASE_ALREADY_EXISTS",
        message: "A Case already exists for this website and Location.",
        case_id: caseId,
        status: "archived",
      },
    });
  });

  it("gets, updates, restores, and idempotently archives through item handlers", async () => {
    const get = vi.fn<CaseService["get"]>(async () => resource);
    const update = vi.fn<CaseService["update"]>(async () => resource);
    const archive = vi.fn<CaseService["archive"]>(async () => ({
      ...resource,
      status: "archived",
      archived_at: "2026-08-27T01:00:00.000Z",
    }));
    const handlers = createCaseItemHandlers({
      getCurrentUser: async () => ({ userId }),
      createService: () => serviceWith({ get, update, archive }),
    });

    expect((await handlers.GET(request(`/api/v2/cases/${caseId}`), context())).status).toBe(200);
    expect((await handlers.PATCH(request(`/api/v2/cases/${caseId}`, {
      method: "PATCH", body: JSON.stringify({ status: "active" }),
    }), context())).status).toBe(200);
    expect((await handlers.DELETE(request(`/api/v2/cases/${caseId}`, { method: "DELETE" }), context())).status)
      .toBe(200);

    expect(get).toHaveBeenCalledWith(userId, caseId);
    expect(update).toHaveBeenCalledWith(userId, caseId, { status: "active" });
    expect(archive).toHaveBeenCalledWith(userId, caseId);
  });
});
