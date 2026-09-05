import { describe, expect, it } from "vitest";

import type {
  AuthorizedConnectionInput,
  GoogleConnectionEventInput,
  GoogleConnectionRecord,
  GoogleOAuthSessionRecord,
  RefreshedConnectionInput,
} from "./contracts";
import { GoogleConnectionError } from "./errors";
import { digestOAuthState } from "./oauth-state";
import type {
  GoogleIdentity,
  GoogleOAuthProvider,
  GoogleTokenSet,
} from "./provider";
import { GoogleProviderFailure } from "./provider";
import type { GoogleConnectionRepository } from "./repository";
import { GOOGLE_IDENTITY_SCOPES } from "./scopes";
import { createGoogleConnectionService } from "./service";
import { TokenVault } from "./token-vault";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const caseA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-09-05T12:00:00.000Z");
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryRepository implements GoogleConnectionRepository {
  readonly ownedCases = new Map([[caseA, userA]]);
  readonly sessions = new Map<string, GoogleOAuthSessionRecord>();
  readonly connections = new Map<string, GoogleConnectionRecord>();
  readonly events: GoogleConnectionEventInput[] = [];
  allowLease = true;

  async caseOwnedByUser(userId: string, caseId: string) {
    return this.ownedCases.get(caseId) === userId;
  }
  async createOAuthSession(session: GoogleOAuthSessionRecord) {
    this.sessions.set(session.id, clone(session));
  }
  async findOAuthSessionByStateDigest(stateDigest: string) {
    return clone([...this.sessions.values()].find((item) => item.stateDigest === stateDigest) ?? null);
  }
  async consumeOAuthSession(sessionId: string, userId: string, consumedAt: string, outcomeCode: string) {
    const value = this.sessions.get(sessionId);
    if (!value || value.userId !== userId || value.consumedAt || value.expiresAt <= consumedAt) return null;
    value.consumedAt = consumedAt;
    value.outcomeCode = outcomeCode;
    return clone(value);
  }
  async updateOAuthSessionOutcome(sessionId: string, outcomeCode: string) {
    const value = this.sessions.get(sessionId);
    if (!value) throw new Error("missing session");
    value.outcomeCode = outcomeCode;
  }
  async findConnectionBySubject(userId: string, subject: string) {
    return clone([...this.connections.values()].find((item) =>
      item.userId === userId && item.googleSubject === subject && item.status !== "deleted",
    ) ?? null);
  }
  async findConnectionById(userId: string, connectionId: string) {
    const value = this.connections.get(connectionId);
    return clone(value?.userId === userId ? value : null);
  }
  async findConnectionByIdInternal(connectionId: string) {
    return clone(this.connections.get(connectionId) ?? null);
  }
  async listConnections(userId: string) {
    return clone([...this.connections.values()].filter((item) => item.userId === userId && item.status !== "deleted"));
  }
  async saveAuthorizedConnection(input: AuthorizedConnectionInput) {
    const prior = this.connections.get(input.id);
    const now = NOW.toISOString();
    const value: GoogleConnectionRecord = {
      id: input.id,
      userId: input.userId,
      googleSubject: input.googleSubject,
      accountEmail: input.accountEmail,
      accountDisplayName: input.accountDisplayName,
      grantedScopes: clone(input.grantedScopes),
      accessToken: clone(input.accessToken),
      refreshToken: clone(input.refreshToken),
      tokenExpiresAt: input.tokenExpiresAt,
      refreshLeaseId: null,
      refreshLeaseExpiresAt: null,
      status: "active",
      lastErrorCode: null,
      connectedAt: prior?.connectedAt ?? now,
      revokedAt: null,
      deletedAt: null,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
    this.connections.set(value.id, value);
    return clone(value);
  }
  async acquireRefreshLease(connectionId: string, leaseId: string, _now: string, expiresAt: string) {
    const value = this.connections.get(connectionId);
    if (!value || !this.allowLease) return false;
    value.refreshLeaseId = leaseId;
    value.refreshLeaseExpiresAt = expiresAt;
    return true;
  }
  async saveRefreshedConnection(input: RefreshedConnectionInput) {
    const value = this.connections.get(input.connectionId);
    if (!value || value.refreshLeaseId !== input.leaseId) return null;
    Object.assign(value, {
      grantedScopes: clone(input.grantedScopes),
      accessToken: clone(input.accessToken),
      refreshToken: clone(input.refreshToken),
      tokenExpiresAt: input.tokenExpiresAt,
      refreshLeaseId: null,
      refreshLeaseExpiresAt: null,
      status: "active",
      lastErrorCode: null,
    });
    return clone(value);
  }
  async markRefreshError(connectionId: string, leaseId: string, errorCode: string) {
    const value = this.connections.get(connectionId);
    if (!value || value.refreshLeaseId !== leaseId) return;
    value.status = "error";
    value.lastErrorCode = errorCode;
    value.refreshLeaseId = null;
    value.refreshLeaseExpiresAt = null;
  }
  async clearConnection(input: {
    connectionId: string;
    userId?: string;
    status: "reauth_required" | "revoked" | "deleted";
    errorCode?: string | null;
    occurredAt: string;
  }) {
    const value = this.connections.get(input.connectionId);
    if (!value || input.userId && value.userId !== input.userId) return null;
    value.status = input.status;
    value.accessToken = null;
    value.refreshToken = null;
    value.tokenExpiresAt = null;
    value.refreshLeaseId = null;
    value.refreshLeaseExpiresAt = null;
    value.lastErrorCode = input.errorCode ?? null;
    value.revokedAt = input.status === "revoked" ? input.occurredAt : null;
    value.deletedAt = input.status === "deleted" ? input.occurredAt : null;
    return clone(value);
  }
  async appendEvent(event: GoogleConnectionEventInput) {
    this.events.push(clone(event));
  }
  async claimBrokerRequest() { return true; }
}

class FakeProvider implements GoogleOAuthProvider {
  token: GoogleTokenSet = {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresInSeconds: 3600,
    grantedScopes: [...GOOGLE_IDENTITY_SCOPES, GA4_SCOPE],
    tokenType: "Bearer",
  };
  identity: GoogleIdentity = {
    subject: "google-subject",
    email: "owner@example.com",
    displayName: "Owner",
  };
  refreshError: Error | null = null;
  revoked: string[] = [];
  refreshCalls = 0;

  buildAuthorizationUrl(input: { scopes: readonly string[]; state: string; codeChallenge: string }) {
    const url = new URL("https://accounts.google.test/oauth");
    url.searchParams.set("state", input.state);
    url.searchParams.set("scope", input.scopes.join(" "));
    url.searchParams.set("challenge", input.codeChallenge);
    return url.toString();
  }
  async exchangeCode() { return clone(this.token); }
  async getIdentity() { return clone(this.identity); }
  async refresh() {
    this.refreshCalls += 1;
    if (this.refreshError) throw this.refreshError;
    return clone(this.token);
  }
  async revoke(token: string) { this.revoked.push(token); }
}

function harness() {
  const repository = new MemoryRepository();
  const provider = new FakeProvider();
  const vault = TokenVault.fromBase64Keys("v1", {
    v1: Buffer.alloc(32, 5).toString("base64"),
  });
  let counter = 1;
  const service = createGoogleConnectionService({
    repository,
    provider,
    vault,
    cookieSecret: "cookie-secret".repeat(3),
    now: () => new Date(NOW),
    createId: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`,
    createState: () => `state-${counter}`,
    createPkce: () => ({ verifier: `verifier-${counter}`, challenge: `challenge-${counter}` }),
  });
  return { repository, provider, vault, service };
}

async function start(h: ReturnType<typeof harness>, sources: string[] = ["ga4"]) {
  const result = await h.service.startAuthorization({
    userId: userA,
    caseId: caseA,
    sources,
    returnPath: `/cases/${caseA}`,
    requestId: `request-${h.repository.sessions.size + 1}`,
  });
  const state = new URL(result.authorizationUrl).searchParams.get("state")!;
  return { ...result, state };
}

async function expectGoogleError(operation: Promise<unknown>, code: string) {
  try {
    await operation;
    throw new Error("Expected GoogleConnectionError");
  } catch (error) {
    expect(error).toBeInstanceOf(GoogleConnectionError);
    expect((error as GoogleConnectionError).code).toBe(code);
  }
}

describe("Google connection lifecycle service", () => {
  it("creates an owned, encrypted, one-time OAuth session", async () => {
    const h = harness();
    const result = await start(h, ["ga4", "gsc"]);
    const session = [...h.repository.sessions.values()][0];

    expect(session.userId).toBe(userA);
    expect(session.caseId).toBe(caseA);
    expect(session.requestedSources).toEqual(["gsc", "ga4"]);
    expect(session.stateDigest).toBe(digestOAuthState(result.state).toString("base64"));
    expect(JSON.stringify(session)).not.toContain("verifier-2");
    expect(result.cookieBinding).not.toContain(result.state);
    expect(h.repository.events[0].eventType).toBe("authorization_started");

    await expectGoogleError(h.service.startAuthorization({
      userId: userB,
      caseId: caseA,
      sources: ["ga4"],
      requestId: "request-forbidden",
    }), "GOOGLE_CONNECTION_FORBIDDEN");
  });

  it("rejects first authorization without a refresh token and consumes the session", async () => {
    const h = harness();
    h.provider.token.refreshToken = null;
    const auth = await start(h);
    await expectGoogleError(h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-1",
    }), "GOOGLE_REFRESH_TOKEN_REQUIRED");
    expect(h.repository.connections.size).toBe(0);
    await expectGoogleError(h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-replay",
    }), "GOOGLE_OAUTH_SESSION_INVALID");
  });

  it("saves actual partial scope coverage without claiming requested GSC access", async () => {
    const h = harness();
    const auth = await start(h, ["gsc", "ga4"]);
    const result = await h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-partial",
    });

    expect(result.connection.covered_sources).toEqual(["ga4"]);
    expect(result.connection.granted_scopes).not.toContain(GSC_SCOPE);
    expect(JSON.stringify(result.connection)).not.toContain("access-1");
    expect(JSON.stringify(result.connection)).not.toContain("refresh-1");
    expect(h.repository.events.at(-1)?.eventType).toBe("authorization_succeeded");
  });

  it("retains and re-encrypts an existing refresh token during incremental authorization", async () => {
    const h = harness();
    const first = await start(h);
    const created = await h.service.completeAuthorization({
      userId: userA,
      state: first.state,
      cookieBinding: first.cookieBinding,
      code: "fake-code",
      requestId: "callback-first",
    });
    const before = h.repository.connections.get(created.connection.id)!;
    const originalRefreshCiphertext = before.refreshToken!.ciphertext;

    h.provider.token = {
      ...h.provider.token,
      accessToken: "access-2",
      refreshToken: null,
      grantedScopes: [...GOOGLE_IDENTITY_SCOPES, GA4_SCOPE, GSC_SCOPE],
    };
    const second = await start(h, ["gsc"]);
    const updated = await h.service.completeAuthorization({
      userId: userA,
      state: second.state,
      cookieBinding: second.cookieBinding,
      code: "fake-code-2",
      requestId: "callback-second",
    });
    const record = h.repository.connections.get(updated.connection.id)!;

    expect(updated.connection.id).toBe(created.connection.id);
    expect(updated.connection.covered_sources).toEqual(["gsc", "ga4"]);
    expect(record.refreshToken!.ciphertext).not.toBe(originalRefreshCiphertext);
    expect(h.vault.decrypt(record.refreshToken!, {
      recordType: "connection",
      userId: userA,
      recordId: record.id,
      secretKind: "refresh_token",
    })).toBe("refresh-1");
    expect(h.repository.events.at(-1)?.eventType).toBe("scope_extended");
  });

  it("serves a valid access token without refreshing and refreshes an expiring token once", async () => {
    const h = harness();
    const auth = await start(h);
    const created = await h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-token",
    });
    await expect(h.service.getAccessToken(created.connection.id, "ga4", "broker-1"))
      .resolves.toMatchObject({ accessToken: "access-1" });
    expect(h.provider.refreshCalls).toBe(0);

    const record = h.repository.connections.get(created.connection.id)!;
    record.tokenExpiresAt = new Date(NOW.getTime() + 60_000).toISOString();
    h.provider.token = { ...h.provider.token, accessToken: "access-refreshed", refreshToken: null };
    await expect(h.service.getAccessToken(created.connection.id, "ga4", "broker-2"))
      .resolves.toMatchObject({ accessToken: "access-refreshed" });
    expect(h.provider.refreshCalls).toBe(1);
    expect(h.repository.events.at(-1)?.eventType).toBe("refresh_succeeded");
  });

  it("rejects lease contention and clears tokens after invalid_grant", async () => {
    const h = harness();
    const auth = await start(h);
    const created = await h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-invalid",
    });
    const record = h.repository.connections.get(created.connection.id)!;
    record.tokenExpiresAt = new Date(NOW.getTime() + 60_000).toISOString();
    h.repository.allowLease = false;
    await expectGoogleError(
      h.service.getAccessToken(record.id, "ga4", "broker-busy"),
      "GOOGLE_TOKEN_REFRESH_BUSY",
    );

    h.repository.allowLease = true;
    h.provider.refreshError = new GoogleProviderFailure("invalid_grant");
    await expectGoogleError(
      h.service.getAccessToken(record.id, "ga4", "broker-invalid"),
      "GOOGLE_REAUTH_REQUIRED",
    );
    expect(record.status).toBe("reauth_required");
    expect(record.accessToken).toBeNull();
    expect(record.refreshToken).toBeNull();
  });

  it("revokes and clears an owned connection without exposing tokens", async () => {
    const h = harness();
    const auth = await start(h);
    const created = await h.service.completeAuthorization({
      userId: userA,
      state: auth.state,
      cookieBinding: auth.cookieBinding,
      code: "fake-code",
      requestId: "callback-disconnect",
    });
    const result = await h.service.disconnect(userA, created.connection.id, "disconnect-1");

    expect(result.status).toBe("revoked");
    expect(h.provider.revoked).toEqual(["access-1"]);
    expect(h.repository.connections.get(created.connection.id)?.accessToken).toBeNull();
    expect(h.repository.events.at(-1)?.eventType).toBe("revoked");
    await expectGoogleError(
      h.service.disconnect(userB, created.connection.id, "disconnect-other"),
      "GOOGLE_CONNECTION_FORBIDDEN",
    );
  });
});
