import { describe, expect, it, vi } from "vitest";

import type { GoogleConnectionRecord } from "../google-connections/contracts";
import { TokenVault } from "../google-connections/token-vault";
import { createIdentityWebhookService, identityDigest } from "./service";

const oldKey = Buffer.alloc(32, 7).toString("base64");
const vault = TokenVault.fromBase64Keys("key-v1", { "key-v1": oldKey });

function connection(): GoogleConnectionRecord {
  const base = {
    id: "00000000-0000-4000-8000-000000000010",
    userId: "00000000-0000-4000-8000-000000000020",
  };
  return {
    ...base,
    googleSubject: "google-subject",
    accountEmail: null,
    accountDisplayName: null,
    grantedScopes: ["openid"],
    accessToken: vault.encrypt("synthetic-access-token", {
      recordType: "connection",
      userId: base.userId,
      recordId: base.id,
      secretKind: "access_token",
    }),
    refreshToken: vault.encrypt("synthetic-refresh-token", {
      recordType: "connection",
      userId: base.userId,
      recordId: base.id,
      secretKind: "refresh_token",
    }),
    tokenExpiresAt: "2026-09-11T00:00:00.000Z",
    refreshLeaseId: null,
    refreshLeaseExpiresAt: null,
    status: "deleting",
    lastErrorCode: "ACCOUNT_DELETION_PENDING",
    connectedAt: "2026-09-10T00:00:00.000Z",
    revokedAt: null,
    deletedAt: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  };
}

function setup(options: { userId?: string | null; revokeFails?: boolean; configured?: boolean } = {}) {
  const register = vi.fn(async () => "created" as const);
  const prepareDeletion = vi.fn(async () => options.userId === undefined ? connection().userId : options.userId);
  const completeDeletion = vi.fn(async () => "deleted" as const);
  const listConnections = vi.fn(async () => [connection()]);
  const revoke = vi.fn(async () => {
    if (options.revokeFails) throw new Error("Bearer synthetic-access-token provider failure");
  });
  const service = createIdentityWebhookService({
    repository: { register, prepareDeletion, completeDeletion },
    connections: { listConnections },
    vault: options.configured === false ? null : vault,
    revoker: { revoke },
  });
  return { service, register, prepareDeletion, completeDeletion, listConnections, revoke };
}

describe("identity webhook service", () => {
  it("registers a Clerk identity through a one-way subject digest", async () => {
    const h = setup();
    await expect(h.service.register({
      clerkUserId: "user_private_subject",
      email: "owner@example.com",
      name: "Owner",
    })).resolves.toBe("created");
    expect(h.register).toHaveBeenCalledWith({
      clerkUserId: "user_private_subject",
      subjectDigest: identityDigest("user_private_subject"),
      email: "owner@example.com",
      name: "Owner",
    });
    expect(identityDigest("user_private_subject")).toMatch(/^[0-9a-f]{64}$/);
    expect(identityDigest("user_private_subject")).not.toContain("private_subject");
  });

  it("freezes access, attempts revocation and deletes locally even when Google fails", async () => {
    const h = setup({ revokeFails: true });
    const result = await h.service.deleteAccount({
      clerkUserId: "user_delete",
      eventId: "msg_delete_1",
      eventOccurredAt: "2026-09-10T00:00:00.000Z",
    });
    expect(h.prepareDeletion).toHaveBeenCalledWith("user_delete");
    expect(h.listConnections).toHaveBeenCalledWith(connection().userId);
    expect(h.revoke).toHaveBeenCalledWith("synthetic-refresh-token");
    expect(h.completeDeletion).toHaveBeenCalledWith({
      clerkUserId: "user_delete",
      eventIdDigest: identityDigest("msg_delete_1"),
      subjectDigest: identityDigest("user_delete"),
      eventOccurredAt: "2026-09-10T00:00:00.000Z",
    });
    expect(result).toEqual({
      outcome: "deleted",
      connectionsFound: 1,
      revocationsAttempted: 1,
      revocationsFailed: 1,
    });
  });

  it("completes an already-absent identity without reading connections", async () => {
    const h = setup({ userId: null });
    await h.service.deleteAccount({
      clerkUserId: "user_missing",
      eventId: "msg_missing",
      eventOccurredAt: "2026-09-10T00:00:00.000Z",
    });
    expect(h.listConnections).not.toHaveBeenCalled();
    expect(h.revoke).not.toHaveBeenCalled();
    expect(h.completeDeletion).toHaveBeenCalledOnce();
  });

  it("never retains local data merely because vault configuration is unavailable", async () => {
    const h = setup({ configured: false });
    const result = await h.service.deleteAccount({
      clerkUserId: "user_no_vault",
      eventId: "msg_no_vault",
      eventOccurredAt: "2026-09-10T00:00:00.000Z",
    });
    expect(h.revoke).not.toHaveBeenCalled();
    expect(h.completeDeletion).toHaveBeenCalledOnce();
    expect(result.revocationsFailed).toBe(1);
  });
});
