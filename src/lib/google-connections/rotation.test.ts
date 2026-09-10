import { describe, expect, it } from "vitest";

import type { GoogleConnectionRecord, GoogleOAuthSessionRecord } from "./contracts";
import type { GoogleTokenRotationRepository } from "./rotation";
import { runGoogleTokenRotation } from "./rotation";
import { TokenVault, type EncryptedSecret } from "./token-vault";

const oldKey = Buffer.alloc(32, 1).toString("base64");
const newKey = Buffer.alloc(32, 2).toString("base64");
const vault = TokenVault.fromBase64Keys("key-v2", { "key-v1": oldKey, "key-v2": newKey });

function connection(id: string): GoogleConnectionRecord {
  const userId = "00000000-0000-4000-8000-000000000099";
  return {
    id, userId, googleSubject: "subject", accountEmail: null, accountDisplayName: null,
    grantedScopes: [],
    accessToken: vault.encrypt("access", { recordType: "connection", userId, recordId: id, secretKind: "access_token" }),
    refreshToken: vault.encrypt("refresh", { recordType: "connection", userId, recordId: id, secretKind: "refresh_token" }),
    tokenExpiresAt: "2026-09-11T00:00:00Z", refreshLeaseId: null, refreshLeaseExpiresAt: null,
    status: "active", lastErrorCode: null, connectedAt: "2026-09-10T00:00:00Z", revokedAt: null,
    deletedAt: null, createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z",
  };
}

function oldConnection(id: string): GoogleConnectionRecord {
  const current = connection(id);
  const oldVault = TokenVault.fromBase64Keys("key-v1", { "key-v1": oldKey });
  current.accessToken = oldVault.encrypt("access", { recordType: "connection", userId: current.userId, recordId: id, secretKind: "access_token" });
  current.refreshToken = oldVault.encrypt("refresh", { recordType: "connection", userId: current.userId, recordId: id, secretKind: "refresh_token" });
  return current;
}

function oldSession(id: string): GoogleOAuthSessionRecord {
  const userId = "00000000-0000-4000-8000-000000000099";
  const oldVault = TokenVault.fromBase64Keys("key-v1", { "key-v1": oldKey });
  return {
    id, userId, caseId: null, connectionId: null, stateDigest: Buffer.alloc(32).toString("base64"),
    pkceVerifier: oldVault.encrypt("verifier", { recordType: "oauth_session", userId, recordId: id, secretKind: "pkce_verifier" }),
    requestedSources: ["gsc"], requestedScopes: ["openid"], returnPath: "/cases",
    expiresAt: "2026-09-11T00:00:00Z", consumedAt: null, outcomeCode: null,
    createdAt: "2026-09-10T00:00:00Z",
  };
}

class MemoryRepository implements GoogleTokenRotationRepository {
  connections = [oldConnection("00000000-0000-4000-8000-000000000001")];
  sessions = [oldSession("00000000-0000-4000-8000-000000000002")];
  conflict = false;

  async countVersion(version: string) {
    return {
      connections: this.connections.filter((row) => row.accessToken?.keyVersion === version).length,
      oauthSessions: this.sessions.filter((row) => row.pkceVerifier.keyVersion === version).length,
    };
  }
  async listConnectionBatch(version: string, after: string | null, limit: number) {
    return this.connections.filter((row) => row.accessToken?.keyVersion === version && (!after || row.id > after)).slice(0, limit);
  }
  async listOAuthSessionBatch(version: string, after: string | null, limit: number) {
    return this.sessions.filter((row) => row.pkceVerifier.keyVersion === version && (!after || row.id > after)).slice(0, limit);
  }
  async compareAndSwapConnection(input: {
    connectionId: string; expectedKeyVersion: string; expectedUpdatedAt: string;
    accessToken: EncryptedSecret; refreshToken: EncryptedSecret;
  }) {
    const row = this.connections.find((value) => value.id === input.connectionId);
    if (this.conflict || !row || row.accessToken?.keyVersion !== input.expectedKeyVersion || row.updatedAt !== input.expectedUpdatedAt) return false;
    row.accessToken = input.accessToken; row.refreshToken = input.refreshToken;
    return true;
  }
  async compareAndSwapOAuthSession(input: { sessionId: string; expectedKeyVersion: string; pkceVerifier: EncryptedSecret }) {
    const row = this.sessions.find((value) => value.id === input.sessionId);
    if (this.conflict || !row || row.pkceVerifier.keyVersion !== input.expectedKeyVersion) return false;
    row.pkceVerifier = input.pkceVerifier;
    return true;
  }
}

describe("Google token key rotation", () => {
  it("dry-run reports old versions without reading or changing ciphertext", async () => {
    const repository = new MemoryRepository();
    const before = repository.connections[0].accessToken?.ciphertext;
    const result = await runGoogleTokenRotation({ mode: "dry-run", oldKeyVersion: "key-v1", vault, repository });
    expect(result.before).toEqual({ connections: 1, oauthSessions: 1 });
    expect(result.rotated).toEqual({ connections: 0, oauthSessions: 0 });
    expect(repository.connections[0].accessToken?.ciphertext).toBe(before);
    expect(result.ok).toBe(true);
  });

  it("atomically re-encrypts both token kinds and supports repeat execution", async () => {
    const repository = new MemoryRepository();
    const oldIv = repository.connections[0].accessToken?.iv;
    const first = await runGoogleTokenRotation({ mode: "execute", oldKeyVersion: "key-v1", batchSize: 1, vault, repository });
    expect(first.rotated).toEqual({ connections: 1, oauthSessions: 1 });
    expect(first.after).toEqual({ connections: 0, oauthSessions: 0 });
    expect(first.ok).toBe(true);
    expect(repository.connections[0].accessToken?.keyVersion).toBe("key-v2");
    expect(repository.connections[0].refreshToken?.keyVersion).toBe("key-v2");
    expect(repository.connections[0].accessToken?.iv).not.toBe(oldIv);

    const repeated = await runGoogleTokenRotation({ mode: "execute", oldKeyVersion: "key-v1", vault, repository });
    expect(repeated.rotated).toEqual({ connections: 0, oauthSessions: 0 });
    expect(repeated.ok).toBe(true);
  });

  it("leaves conflicted records on the old version for a later resume", async () => {
    const repository = new MemoryRepository();
    repository.conflict = true;
    const result = await runGoogleTokenRotation({ mode: "execute", oldKeyVersion: "key-v1", vault, repository });
    expect(result.conflicts).toEqual({ connections: 1, oauthSessions: 1 });
    expect(result.after).toEqual({ connections: 1, oauthSessions: 1 });
    expect(result.ok).toBe(false);
  });

  it("verify fails while an old record remains and rejects unsafe configuration", async () => {
    const repository = new MemoryRepository();
    const result = await runGoogleTokenRotation({ mode: "verify", oldKeyVersion: "key-v1", vault, repository });
    expect(result.ok).toBe(false);
    await expect(runGoogleTokenRotation({ mode: "execute", oldKeyVersion: "key-v2", vault, repository }))
      .rejects.toThrow("INVALID_ROTATION_CONFIGURATION");
  });
});
