import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { CaseListQuery, CaseLocation } from "./contracts";
import { CaseApiError } from "./errors";
import { parseCreateCaseInput, parseUpdateCaseInput } from "./normalize";
import {
  CasePersistenceError,
  SupabaseCaseRepository,
  type CaseKeyIdentity,
  type CaseListResult,
  type CaseRecord,
  type CaseRepository,
  type CreateCaseRecord,
  type UpdateCaseRecord,
} from "./repository";
import { createCaseService } from "./service";

// Use the real migrated SQL function even in the in-memory service tests.
let db: PGlite;
let keyRepository: SupabaseCaseRepository;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  keyRepository = new SupabaseCaseRepository({
    rpc: async (name: string, args: { location: unknown }) => {
      expect(name).toBe("v22_case_location_key");
      const result = await db.query<{ key: string }>("select public.v22_case_location_key($1::jsonb) key", [JSON.stringify(args.location)]);
      return { data: result.rows[0].key, error: null };
    },
  } as unknown as SupabaseClient);
}, 30_000);
afterAll(async () => { await db?.close(); });

const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";

function createRequest(city: string, latitude: number, longitude: number) {
  return {
    site_url: "https://www.example.com/",
    business_name: "Example Dental",
    operating_model: "storefront",
    primary_service: "Emergency dentist",
    primary_location: {
      display_name: `${city}, TX`,
      country_code: "US",
      region: "Texas",
      city,
      postal_code: null,
      latitude,
      longitude,
    },
    target_market: {
      display_name: `${city}, TX`,
      country_code: "US",
      region: "Texas",
      city,
    },
    public_gbp_url: null,
  };
}

class InMemoryCaseRepository implements CaseRepository {
  private records: CaseRecord[] = [];

  computeLocationKey(identity: CaseKeyIdentity, target: CaseLocation) {
    return keyRepository.computeLocationKey(identity, target);
  }
  private idCounter = 10;

  private nextId() {
    const suffix = String(this.idCounter++).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }

  private duplicateFor(record: Pick<CaseRecord, "user_id" | "normalized_domain" | "location_key">, exclude?: string) {
    return this.records.find((candidate) =>
      candidate.id !== exclude &&
      candidate.user_id === record.user_id &&
      candidate.normalized_domain === record.normalized_domain &&
      candidate.location_key === record.location_key,
    );
  }

  async create(input: CreateCaseRecord): Promise<CaseRecord> {
    const now = new Date().toISOString();
    const locationKey = await this.computeLocationKey(input.business_identity, input.target_market);
    if (this.duplicateFor({ ...input, location_key: locationKey })) {
      throw new CasePersistenceError("duplicate", "23505");
    }
    const record: CaseRecord = {
      ...input,
      id: input.id ?? this.nextId(),
      status: "active",
      latest_report_id: null,
      latest_verified_report_id: null,
      location_key: locationKey,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    this.records.push(record);
    return structuredClone(record);
  }

  async findById(userId: string, caseId: string): Promise<CaseRecord | null> {
    return structuredClone(this.records.find((record) => record.user_id === userId && record.id === caseId) ?? null);
  }

  async findDuplicate(
    userId: string,
    normalizedDomain: string,
    locationKey: string,
    excludeCaseId?: string,
  ): Promise<CaseRecord | null> {
    return structuredClone(this.records.find((record) =>
      record.user_id === userId &&
      record.normalized_domain === normalizedDomain &&
      record.location_key === locationKey &&
      record.id !== excludeCaseId,
    ) ?? null);
  }

  async list(userId: string, query: CaseListQuery): Promise<CaseListResult> {
    const matching = this.records
      .filter((record) => record.user_id === userId && (query.status === "all" || record.status === query.status))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id));
    return {
      items: structuredClone(matching.slice(query.offset, query.offset + query.limit)),
      total: matching.length,
    };
  }

  async updateActive(userId: string, caseId: string, input: UpdateCaseRecord): Promise<CaseRecord | null> {
    const index = this.records.findIndex((record) =>
      record.user_id === userId && record.id === caseId && record.status === "active",
    );
    if (index < 0) return null;
    const current = this.records[index];
    const locationKey = await this.computeLocationKey(
      input.business_identity ?? current.business_identity, input.target_market ?? current.target_market,
    );
    const updated: CaseRecord = {
      ...current,
      ...input,
      location_key: locationKey,
      updated_at: new Date(Date.now() + 1).toISOString(),
    };
    if (this.duplicateFor(updated, current.id)) throw new CasePersistenceError("duplicate", "23505");
    this.records[index] = updated;
    return structuredClone(updated);
  }

  async archiveActive(userId: string, caseId: string, archivedAt: string): Promise<CaseRecord | null> {
    const index = this.records.findIndex((record) =>
      record.user_id === userId && record.id === caseId && record.status === "active",
    );
    if (index < 0) return null;
    this.records[index] = {
      ...this.records[index],
      status: "archived",
      archived_at: archivedAt,
      updated_at: archivedAt,
    };
    return structuredClone(this.records[index]);
  }

  async restoreArchived(userId: string, caseId: string): Promise<CaseRecord | null> {
    const index = this.records.findIndex((record) =>
      record.user_id === userId && record.id === caseId && record.status === "archived",
    );
    if (index < 0) return null;
    this.records[index] = {
      ...this.records[index],
      status: "active",
      archived_at: null,
      updated_at: new Date(Date.now() + 1).toISOString(),
    };
    return structuredClone(this.records[index]);
  }
}

async function expectApiError(operation: Promise<unknown>, code: string) {
  try {
    await operation;
    throw new Error("Expected CaseApiError.");
  } catch (error) {
    expect(error).toBeInstanceOf(CaseApiError);
    expect((error as CaseApiError).code).toBe(code);
    return error as CaseApiError;
  }
}

describe("Case service", () => {
  it("persists the authenticated Case with the anonymous draft ID", async () => {
    const service = createCaseService(new InMemoryCaseRepository());
    const draftCaseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const input = parseCreateCaseInput({
      ...createRequest("Austin", 30.2672, -97.7431),
      draft_case_id: draftCaseId,
    });

    const created = await service.create(userA, input);

    expect(created.id).toBe(draftCaseId);
    expect(created).not.toHaveProperty("draft_case_id");
  });

  it("runs the complete create, read, update, archive, idempotent archive, and restore lifecycle", async () => {
    const service = createCaseService(new InMemoryCaseRepository());
    const created = await service.create(userA, parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431)));

    expect(created.status).toBe("active");
    expect(created).not.toHaveProperty("user_id");
    expect(created).not.toHaveProperty("location_key");
    expect((await service.list(userA, { status: "active", limit: 20, offset: 0 })).items)
      .toEqual([created]);
    expect(await service.get(userA, created.id)).toEqual(created);

    const updated = await service.update(userA, created.id, parseUpdateCaseInput({
      business_name: "Updated Dental",
      primary_service: "Cosmetic dentist",
    }));
    expect(updated.business_name).toBe("Updated Dental");
    expect(updated.business_identity.business_name).toBe("Updated Dental");
    expect(updated.primary_service).toBe("Cosmetic dentist");

    const archived = await service.archive(userA, created.id);
    expect(archived.status).toBe("archived");
    expect(archived.archived_at).not.toBeNull();
    const archivedAgain = await service.archive(userA, created.id);
    expect(archivedAgain.archived_at).toBe(archived.archived_at);

    await expectApiError(
      service.update(userA, created.id, parseUpdateCaseInput({ business_name: "Blocked" })),
      "CASE_ARCHIVED",
    );

    const restored = await service.update(userA, created.id, parseUpdateCaseInput({ status: "active" }));
    expect(restored.status).toBe("active");
    expect(restored.archived_at).toBeNull();
    await expectApiError(
      service.update(userA, created.id, parseUpdateCaseInput({ status: "active" })),
      "INVALID_REQUEST",
    );
  });

  it("rejects duplicate active and archived Locations but allows another Location and another user", async () => {
    const service = createCaseService(new InMemoryCaseRepository());
    const austinInput = parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431));
    const first = await service.create(userA, austinInput);

    const activeDuplicate = await expectApiError(service.create(userA, austinInput), "CASE_ALREADY_EXISTS");
    expect(activeDuplicate.duplicate).toEqual({ case_id: first.id, status: "active" });

    await service.archive(userA, first.id);
    const archivedDuplicate = await expectApiError(service.create(userA, austinInput), "CASE_ALREADY_EXISTS");
    expect(archivedDuplicate.duplicate).toEqual({ case_id: first.id, status: "archived" });

    const dallas = await service.create(
      userA,
      parseCreateCaseInput(createRequest("Dallas", 32.7767, -96.7970)),
    );
    expect(dallas.normalized_domain).toBe(first.normalized_domain);
    await expect(service.create(userB, austinInput)).resolves.toMatchObject({ status: "active" });
  });

  it("returns the same not-found result for every cross-user operation", async () => {
    const service = createCaseService(new InMemoryCaseRepository());
    const created = await service.create(userA, parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431)));

    await expectApiError(service.get(userB, created.id), "CASE_NOT_FOUND");
    await expectApiError(
      service.update(userB, created.id, parseUpdateCaseInput({ business_name: "Other" })),
      "CASE_NOT_FOUND",
    );
    await expectApiError(service.archive(userB, created.id), "CASE_NOT_FOUND");
  });

  it("rejects a Location update that would collide with another Case", async () => {
    const service = createCaseService(new InMemoryCaseRepository());
    const austin = await service.create(
      userA,
      parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431)),
    );
    const dallas = await service.create(
      userA,
      parseCreateCaseInput(createRequest("Dallas", 32.7767, -96.7970)),
    );

    const error = await expectApiError(service.update(userA, dallas.id, parseUpdateCaseInput({
      primary_location: createRequest("Austin", 30.2672, -97.7431).primary_location,
    })), "CASE_ALREADY_EXISTS");
    expect(error.duplicate?.case_id).toBe(austin.id);
  });

  it("maps a database 23505 race to the existing Case instead of a 500", async () => {
    const base = new InMemoryCaseRepository();
    const input = parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431));
    const existing = await base.create({
      user_id: userA,
      site_url: input.site_url,
      normalized_domain: input.normalized_domain,
      business_name: input.business_name,
      business_identity: input.business_identity,
      operating_model: input.operating_model,
      primary_service: input.primary_service,
      target_market: input.target_market,
    });
    let duplicateChecks = 0;
    const racingRepository: CaseRepository = {
      computeLocationKey: (identity, target) => base.computeLocationKey(identity, target),
      create: async () => { throw new CasePersistenceError("duplicate", "23505"); },
      findById: (owner, id) => base.findById(owner, id),
      findDuplicate: async (...args) => {
        duplicateChecks += 1;
        return duplicateChecks === 1 ? null : base.findDuplicate(...args);
      },
      list: (owner, query) => base.list(owner, query),
      updateActive: (owner, id, update) => base.updateActive(owner, id, update),
      archiveActive: (owner, id, at) => base.archiveActive(owner, id, at),
      restoreArchived: (owner, id) => base.restoreArchived(owner, id),
    };

    const error = await expectApiError(
      createCaseService(racingRepository).create(userA, input),
      "CASE_ALREADY_EXISTS",
    );
    expect(error.duplicate).toEqual({ case_id: existing.id, status: "active" });
  });
});


it("uses database rounding for create and update at the All Star boundary", async () => {
  const base = new InMemoryCaseRepository();
  const service = createCaseService(base);
  const original = await service.create(userA, parseCreateCaseInput(createRequest("Fresno", 36.815198, -119.892131)));
  const boundary = parseCreateCaseInput(createRequest("Fresno", 36.8151976, -119.8921305));
  expect(await base.computeLocationKey(boundary.business_identity, boundary.target_market)).toBe("geo:36.815198:-119.892131");
  const duplicate = await expectApiError(service.create(userA, boundary), "CASE_ALREADY_EXISTS");
  expect(duplicate.duplicate?.case_id).toBe(original.id);
  const other = await service.create(userA, parseCreateCaseInput(createRequest("Other", 1, 2)));
  const updated = await expectApiError(service.update(userA, other.id, { primary_location: boundary.primary_location }), "CASE_ALREADY_EXISTS");
  expect(updated.duplicate?.case_id).toBe(original.id);
});

it("checks v2 target-market updates while v1 continues using primary_location", async () => {
  const base = new InMemoryCaseRepository();
  const service = createCaseService(base);
  const input = parseCreateCaseInput(createRequest("Fresno", 36.8151976, -119.8921305));
  const first = await service.create(userA, input);
  const secondInput = parseCreateCaseInput(createRequest("Other", 1, 2));
  const second = await service.create(userA, secondInput);
  // A v1 target-market edit does not change its primary-location key.
  await expect(service.update(userA, second.id, { target_market: input.primary_location })).resolves.toMatchObject({ id: second.id });
  // Model an identity already upgraded through the append-only identity-review path.
  const v2 = { ...secondInput.business_identity, schema_version: "business_identity_v2" };
  await base.updateActive(userA, second.id, { business_identity: v2, target_market: secondInput.primary_location });
  const error = await expectApiError(service.update(userA, second.id, { target_market: input.primary_location }), "CASE_ALREADY_EXISTS");
  expect(error.duplicate?.case_id).toBe(first.id);
});

it.each(["create", "update"] as const)("returns a safe 409 when %s hits 23505 and no duplicate row is visible", async operation => {
  const base = new InMemoryCaseRepository();
  const service = createCaseService(base);
  const input = parseCreateCaseInput(createRequest("Austin", 30.2672, -97.7431));
  const existing = await service.create(userA, input);
  vi.spyOn(base, "findDuplicate").mockResolvedValue(null);
  vi.spyOn(base, operation === "create" ? "create" : "updateActive").mockRejectedValue(
    new CasePersistenceError('duplicate key value violates unique constraint "uq_client_cases_user_domain_location" private@example.com', "23505"),
  );
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const error = await expectApiError(operation === "create" ? service.create(userA, input)
      : service.update(userA, existing.id, { target_market: input.target_market }), "CASE_CONFLICT");
    expect(error.status).toBe(409);
    expect(log.mock.calls).toEqual([["Case uniqueness conflict", { constraint: "uq_client_cases_user_domain_location" }]]);
    expect(error.message).not.toContain("private@example.com");
  } finally { log.mockRestore(); }
});
