import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { GoogleConnectionRecord, GoogleOAuthSessionRecord } from "./contracts";
import { SupabaseGoogleConnectionRepository } from "./repository";

type FakeResult = { data: unknown; error: null };

class FakeQueryBuilder {
  readonly calls: Array<[string, ...unknown[]]> = [];
  constructor(private readonly result: FakeResult) {}
  insert(value: unknown) { this.calls.push(["insert", value]); return this; }
  upsert(value: unknown, options?: unknown) { this.calls.push(["upsert", value, options]); return this; }
  update(value: unknown) { this.calls.push(["update", value]); return this; }
  select(...args: unknown[]) { this.calls.push(["select", ...args]); return this; }
  eq(column: string, value: unknown) { this.calls.push(["eq", column, value]); return this; }
  neq(column: string, value: unknown) { this.calls.push(["neq", column, value]); return this; }
  is(column: string, value: unknown) { this.calls.push(["is", column, value]); return this; }
  gt(column: string, value: unknown) { this.calls.push(["gt", column, value]); return this; }
  not(column: string, operator: string, value: unknown) { this.calls.push(["not", column, operator, value]); return this; }
  in(column: string, value: unknown[]) { this.calls.push(["in", column, value]); return this; }
  or(value: string) { this.calls.push(["or", value]); return this; }
  order(column: string, options: unknown) { this.calls.push(["order", column, options]); return this; }
  single() { this.calls.push(["single"]); return this; }
  maybeSingle() { this.calls.push(["maybeSingle"]); return this; }
  then(resolve: (result: FakeResult) => unknown) { return Promise.resolve(resolve(this.result)); }
}

class FakeSupabase {
  readonly builders: FakeQueryBuilder[] = [];
  readonly tables: string[] = [];
  private readonly results: FakeResult[] = [];
  enqueue(data: unknown) { this.results.push({ data, error: null }); }
  from(table: string) {
    this.tables.push(table);
    const builder = new FakeQueryBuilder(this.results.shift() ?? { data: null, error: null });
    this.builders.push(builder);
    return builder;
  }
}

const userId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";
const now = "2026-09-05T12:00:00.000Z";
const connectionRow = {
  id: connectionId,
  user_id: userId,
  google_subject: "google-subject",
  account_email: "owner@example.com",
  account_display_name: "Owner",
  granted_scopes: ["openid", "email", "profile"],
  access_token_ciphertext: "\\x01",
  access_token_iv: `\\x${"02".repeat(12)}`,
  access_token_auth_tag: `\\x${"03".repeat(16)}`,
  refresh_token_ciphertext: "\\x04",
  refresh_token_iv: `\\x${"05".repeat(12)}`,
  refresh_token_auth_tag: `\\x${"06".repeat(16)}`,
  encryption_key_version: "v1",
  token_expires_at: "2026-09-05T13:00:00.000Z",
  refresh_lease_id: null,
  refresh_lease_expires_at: null,
  status: "active",
  last_error_code: null,
  connected_at: now,
  revoked_at: null,
  deleted_at: null,
  created_at: now,
  updated_at: now,
};

describe("Supabase Google connection repository", () => {
  it("owner-scopes browser connection reads and safe clearing", async () => {
    const fake = new FakeSupabase();
    const repository = new SupabaseGoogleConnectionRepository(fake as unknown as SupabaseClient);
    fake.enqueue(connectionRow);
    await repository.findConnectionById(userId, connectionId);
    expect(fake.builders[0].calls).toContainEqual(["eq", "user_id", userId]);

    fake.enqueue([connectionRow]);
    await repository.listConnections(userId);
    expect(fake.builders[1].calls).toContainEqual(["eq", "user_id", userId]);

    fake.enqueue({ ...connectionRow, status: "revoked", access_token_ciphertext: null,
      access_token_iv: null, access_token_auth_tag: null, refresh_token_ciphertext: null,
      refresh_token_iv: null, refresh_token_auth_tag: null, encryption_key_version: null,
      token_expires_at: null, revoked_at: now });
    await repository.clearConnection({ connectionId, userId, status: "revoked", occurredAt: now });
    expect(fake.builders[2].calls).toContainEqual(["eq", "user_id", userId]);
    expect(fake.builders[2].calls).toContainEqual(["update", expect.objectContaining({
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      encryption_key_version: null,
    })]);
  });

  it("maps encrypted values to bytea without serializing plaintext", async () => {
    const fake = new FakeSupabase();
    const repository = new SupabaseGoogleConnectionRepository(fake as unknown as SupabaseClient);
    fake.enqueue(connectionRow);
    const result = await repository.saveAuthorizedConnection({
      id: connectionId,
      userId,
      googleSubject: "google-subject",
      accountEmail: "owner@example.com",
      accountDisplayName: "Owner",
      grantedScopes: ["openid", "email", "profile"],
      accessToken: {
        keyVersion: "v1", ciphertext: Buffer.from("cipher-access").toString("base64"),
        iv: Buffer.alloc(12, 1).toString("base64"), authTag: Buffer.alloc(16, 2).toString("base64"),
      },
      refreshToken: {
        keyVersion: "v1", ciphertext: Buffer.from("cipher-refresh").toString("base64"),
        iv: Buffer.alloc(12, 3).toString("base64"), authTag: Buffer.alloc(16, 4).toString("base64"),
      },
      tokenExpiresAt: "2026-09-05T13:00:00.000Z",
    });
    const upsert = fake.builders[0].calls.find((call) => call[0] === "upsert")!;
    const payload = upsert[1] as Record<string, unknown>;
    expect(payload.access_token_ciphertext).toBe(`\\x${Buffer.from("cipher-access").toString("hex")}`);
    expect(payload.refresh_token_ciphertext).toBe(`\\x${Buffer.from("cipher-refresh").toString("hex")}`);
    expect(JSON.stringify(payload)).not.toContain("access-token");
    expect(result.accessToken?.ciphertext).toBe(Buffer.from([1]).toString("base64"));
    expect(result.refreshToken?.ciphertext).toBe(Buffer.from([4]).toString("base64"));
  });

  it("atomically consumes sessions and claims only expired or empty refresh leases", async () => {
    const fake = new FakeSupabase();
    const repository = new SupabaseGoogleConnectionRepository(fake as unknown as SupabaseClient);
    const session: GoogleOAuthSessionRecord = {
      id: "33333333-3333-4333-8333-333333333333",
      userId,
      caseId: null,
      connectionId: null,
      stateDigest: Buffer.alloc(32, 7).toString("base64"),
      pkceVerifier: {
        keyVersion: "v1", ciphertext: Buffer.from("encrypted").toString("base64"),
        iv: Buffer.alloc(12, 8).toString("base64"), authTag: Buffer.alloc(16, 9).toString("base64"),
      },
      requestedSources: ["gsc"],
      requestedScopes: ["openid"],
      returnPath: "/cases",
      expiresAt: "2026-09-05T12:10:00.000Z",
      consumedAt: null,
      outcomeCode: null,
      createdAt: now,
    };
    fake.enqueue(null);
    await repository.createOAuthSession(session);
    expect(fake.tables[0]).toBe("google_oauth_sessions");
    const inserted = fake.builders[0].calls.find((call) => call[0] === "insert")?.[1];
    expect(JSON.stringify(inserted)).not.toContain("encrypted");

    fake.enqueue(null);
    await repository.consumeOAuthSession(session.id, userId, now, "PROCESSING");
    expect(fake.builders[1].calls).toContainEqual(["is", "consumed_at", null]);
    expect(fake.builders[1].calls).toContainEqual(["gt", "expires_at", now]);

    fake.enqueue({ id: connectionId });
    expect(await repository.acquireRefreshLease(
      connectionId,
      "44444444-4444-4444-8444-444444444444",
      now,
      "2026-09-05T12:00:30.000Z",
    )).toBe(true);
    expect(fake.builders[2].calls).toContainEqual([
      "or",
      `refresh_lease_id.is.null,refresh_lease_expires_at.lt.${now}`,
    ]);
  });

  it("never user-scopes the explicit internal lookup", async () => {
    const fake = new FakeSupabase();
    const repository = new SupabaseGoogleConnectionRepository(fake as unknown as SupabaseClient);
    fake.enqueue(connectionRow);
    const result: GoogleConnectionRecord | null = await repository.findConnectionByIdInternal(connectionId);
    expect(result?.id).toBe(connectionId);
    expect(fake.builders[0].calls.some((call) => call[1] === "user_id")).toBe(false);
  });
});
