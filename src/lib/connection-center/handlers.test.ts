import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createConnectionCenterHandlers } from "./handlers";
import { ConnectionCenterError, type ConnectionCenterService } from "./service";

const id = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };

function setup(options: { enabled?: boolean; user?: boolean } = {}) {
  const get = vi.fn(async () => ({ schema_version: "connection_center_v1" }));
  const createService = vi.fn(() => ({ get } as unknown as ConnectionCenterService));
  const handlers = createConnectionCenterHandlers({
    enabled: () => options.enabled ?? true,
    getCurrentUser: async () => options.user === false ? null : { userId: id },
    createService,
  });
  return { handlers, createService, get };
}

describe("private Connection Center handler", () => {
  it("conceals the route while Google connections are disabled", async () => {
    const value = setup({ enabled: false });
    const response = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center`), context);
    expect(response.status).toBe(404);
    expect(value.createService).not.toHaveBeenCalled();
  });

  it("requires login before constructing a service", async () => {
    const value = setup({ user: false });
    const response = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center`), context);
    expect(response.status).toBe(401);
    expect(value.createService).not.toHaveBeenCalled();
  });

  it("rejects invalid Case IDs and unexpected query input", async () => {
    const value = setup();
    const invalid = await value.handlers.GET(new NextRequest("https://example.test/api/v2/cases/nope/connection-center"), { params: Promise.resolve({ id: "nope" }) });
    const query = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center?raw=true`), context);
    expect(invalid.status).toBe(400);
    expect(query.status).toBe(400);
    expect(value.createService).not.toHaveBeenCalled();
  });

  it("returns the safe projection without caching", async () => {
    const value = setup();
    const response = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center`), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ schema_version: "connection_center_v1" });
    expect(value.get).toHaveBeenCalledWith(id, id);
  });

  it("does not expose unknown failures", async () => {
    const value = setup();
    value.get.mockRejectedValueOnce(new Error("select secret_table using private credential"));
    const response = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center`), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret_table");
  });

  it("preserves fixed service errors", async () => {
    const value = setup();
    value.get.mockRejectedValueOnce(new ConnectionCenterError("CONNECTION_CENTER_BUSY", 409));
    const response = await value.handlers.GET(new NextRequest(`https://example.test/api/v2/cases/${id}/connection-center`), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "CONNECTION_CENTER_BUSY", message: expect.any(String) } });
  });
});
