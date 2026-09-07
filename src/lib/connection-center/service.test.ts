import { describe, expect, it, vi } from "vitest";

import type { ConnectionCenterRead, ConnectionCenterRepository } from "./repository";
import { ConnectionCenterRepositoryError } from "./repository";
import { ConnectionCenterError, createConnectionCenterService } from "./service";

const userId = "00000000-0000-4000-8000-000000000001";
const caseId = "00000000-0000-4000-8000-000000000002";

function read(): ConnectionCenterRead {
  return {
    data: {
      case: { id: caseId, business_name: "Example", site_url: "https://example.test/", updated_at: "2026-09-07T10:00:00Z", latest_report_id: null, public_gbp_url: null },
      parent_report: null,
      connections: [],
      bindings: [],
      jobs: [],
      snapshots: [],
    },
    revision: { case_updated_at: "2026-09-07T10:00:00Z", binding_signature: "" },
  };
}

function service(repository: ConnectionCenterRepository) {
  return createConnectionCenterService({
    repository,
    flags: { gsc_sync_enabled: true, ga4_sync_enabled: true, official_gbp_sync_enabled: false, verified_generation_enabled: false },
    now: () => new Date("2026-09-07T12:00:00Z"),
  });
}

describe("Connection Center service", () => {
  it("returns a projected response only after the frozen revision is still current", async () => {
    const repository = { read: vi.fn(async () => read()), isCurrent: vi.fn(async () => true) };
    const result = await service(repository).get(userId, caseId);
    expect(result.schema_version).toBe("connection_center_v1");
    expect(result.coverage.verified_core_ready).toBe(false);
    expect(repository.isCurrent).toHaveBeenCalledWith(userId, caseId, read().revision);
  });

  it("rereads once when a Case or binding changes concurrently", async () => {
    const repository = { read: vi.fn(async () => read()), isCurrent: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };
    await service(repository).get(userId, caseId);
    expect(repository.read).toHaveBeenCalledTimes(2);
    expect(repository.isCurrent).toHaveBeenCalledTimes(2);
  });

  it("fails safely when the revision changes twice", async () => {
    const repository = { read: vi.fn(async () => read()), isCurrent: vi.fn(async () => false) };
    await expect(service(repository).get(userId, caseId)).rejects.toMatchObject({ code: "CONNECTION_CENTER_BUSY", status: 409 });
  });

  it("conceals a missing, archived or cross-user Case", async () => {
    const repository = { read: vi.fn(async () => null), isCurrent: vi.fn() };
    await expect(service(repository as unknown as ConnectionCenterRepository).get(userId, caseId))
      .rejects.toMatchObject({ code: "CONNECTION_CENTER_NOT_FOUND", status: 404 });
  });

  it("maps storage and unknown failures to a fixed browser-safe error", async () => {
    for (const error of [new ConnectionCenterRepositoryError(), new Error("private database detail")]) {
      const repository = { read: vi.fn(async () => { throw error; }), isCurrent: vi.fn() };
      await expect(service(repository as unknown as ConnectionCenterRepository).get(userId, caseId))
        .rejects.toEqual(expect.objectContaining<Partial<ConnectionCenterError>>({ code: "CONNECTION_CENTER_STORAGE_UNAVAILABLE", status: 503 }));
    }
  });
});
