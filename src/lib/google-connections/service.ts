import { randomUUID } from "node:crypto";

import type {
  GoogleConnectionEventInput,
  GoogleConnectionRecord,
  GoogleConnectionSummary,
  GoogleOAuthSessionRecord,
} from "./contracts";
import { GoogleConnectionError, asGoogleConnectionError } from "./errors";
import {
  createOAuthCookieBinding,
  createOAuthState,
  createPkce,
  digestOAuthState,
  verifyOAuthCookieBinding,
} from "./oauth-state";
import type { GoogleOAuthProvider, GoogleTokenSet } from "./provider";
import { GoogleProviderFailure } from "./provider";
import type { GoogleConnectionRepository } from "./repository";
import {
  GOOGLE_IDENTITY_SCOPES,
  coveredGoogleSources,
  normalizeGrantedScopes,
  parseGoogleSources,
  requiredGoogleScopes,
  sourceHasRequiredScopes,
  type GoogleSource,
} from "./scopes";
import { TokenVault, type SecretContext } from "./token-vault";

const SESSION_TTL_MS = 10 * 60 * 1_000;
const REFRESH_LEASE_MS = 30 * 1_000;
const REFRESH_EARLY_MS = 5 * 60 * 1_000;

export interface GoogleConnectionServiceDependencies {
  repository: GoogleConnectionRepository;
  provider: GoogleOAuthProvider;
  vault: TokenVault;
  cookieSecret: string;
  now?: () => Date;
  createId?: () => string;
  createState?: () => string;
  createPkce?: () => { verifier: string; challenge: string };
}

export interface StartAuthorizationInput {
  userId: string;
  caseId?: string | null;
  sources: unknown;
  returnPath?: string | null;
  requestId: string;
  loginHint?: string | null;
}

export interface CompleteAuthorizationInput {
  userId: string;
  state: string;
  cookieBinding: string;
  code?: string | null;
  providerError?: string | null;
  requestId: string;
}

function connectionContext(
  record: Pick<GoogleConnectionRecord, "id" | "userId"> | { id: string; userId: string },
  secretKind: "access_token" | "refresh_token",
): SecretContext {
  return {
    recordType: "connection",
    userId: record.userId,
    recordId: record.id,
    secretKind,
  };
}

function sessionContext(session: Pick<GoogleOAuthSessionRecord, "id" | "userId">): SecretContext {
  return {
    recordType: "oauth_session",
    userId: session.userId,
    recordId: session.id,
    secretKind: "pkce_verifier",
  };
}

function iso(date: Date): string {
  return date.toISOString();
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function validateReturnPath(value: string | null | undefined): string {
  const candidate = value || "/cases";
  try {
    if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) throw new Error();
    const url = new URL(candidate, "https://searchtrust.invalid");
    if (url.origin !== "https://searchtrust.invalid") throw new Error();
    const allowed = url.pathname === "/cases" || url.pathname.startsWith("/cases/") ||
      url.pathname === "/settings/connections";
    if (!allowed) throw new Error();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  }
}

function validateRequestId(value: string): string {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(value)) {
    throw new GoogleConnectionError("GOOGLE_CONNECTION_INVALID_REQUEST", { status: 400 });
  }
  return value;
}

function summary(record: GoogleConnectionRecord): GoogleConnectionSummary {
  return {
    id: record.id,
    account_email: record.accountEmail,
    account_display_name: record.accountDisplayName,
    granted_scopes: [...record.grantedScopes],
    covered_sources: coveredGoogleSources(record.grantedScopes),
    status: record.status,
    last_error_code: record.lastErrorCode,
    connected_at: record.connectedAt,
    updated_at: record.updatedAt,
  };
}

function requireIdentityScopes(scopes: readonly string[]): void {
  const granted = new Set(scopes);
  if (!GOOGLE_IDENTITY_SCOPES.every((scope) => granted.has(scope))) {
    throw new GoogleConnectionError("GOOGLE_REQUIRED_SCOPES_MISSING", { status: 400 });
  }
}

export function createGoogleConnectionService(dependencies: GoogleConnectionServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? randomUUID;
  const makeState = dependencies.createState ?? (() => createOAuthState());
  const makePkce = dependencies.createPkce ?? (() => createPkce());

  async function appendEvent(event: GoogleConnectionEventInput) {
    await dependencies.repository.appendEvent(event);
  }

  async function finishSession(
    session: GoogleOAuthSessionRecord,
    outcomeCode: string,
    eventType: GoogleConnectionEventInput["eventType"],
    requestId: string,
    connection: GoogleConnectionRecord | null = null,
  ) {
    await dependencies.repository.updateOAuthSessionOutcome(session.id, outcomeCode);
    await appendEvent({
      userId: session.userId,
      connectionId: connection?.id ?? null,
      caseId: session.caseId,
      eventType,
      requestedSources: session.requestedSources,
      coveredSources: connection ? coveredGoogleSources(connection.grantedScopes) : [],
      resultCode: outcomeCode,
      requestId,
    });
  }

  async function saveTokenSet(
    session: GoogleOAuthSessionRecord,
    tokenSet: GoogleTokenSet,
    googleSubject: string,
    email: string | null,
    displayName: string | null,
  ): Promise<GoogleConnectionRecord> {
    const scopes = normalizeGrantedScopes(tokenSet.grantedScopes);
    requireIdentityScopes(scopes);
    const existing = await dependencies.repository.findConnectionBySubject(session.userId, googleSubject);
    const connectionId = existing?.id ?? createId();
    let refreshToken = tokenSet.refreshToken;
    if (!refreshToken && existing?.refreshToken) {
      refreshToken = dependencies.vault.decrypt(
        existing.refreshToken,
        connectionContext(existing, "refresh_token"),
      );
    }
    if (!refreshToken) {
      throw new GoogleConnectionError("GOOGLE_REFRESH_TOKEN_REQUIRED", { status: 409 });
    }
    const identity = { id: connectionId, userId: session.userId };
    return dependencies.repository.saveAuthorizedConnection({
      id: connectionId,
      userId: session.userId,
      googleSubject,
      accountEmail: email,
      accountDisplayName: displayName,
      grantedScopes: scopes,
      accessToken: dependencies.vault.encrypt(
        tokenSet.accessToken,
        connectionContext(identity, "access_token"),
      ),
      refreshToken: dependencies.vault.encrypt(
        refreshToken,
        connectionContext(identity, "refresh_token"),
      ),
      tokenExpiresAt: iso(addMilliseconds(now(), tokenSet.expiresInSeconds * 1_000)),
    });
  }

  return {
    async startAuthorization(input: StartAuthorizationInput) {
      const sources = parseGoogleSources(input.sources);
      const requestId = validateRequestId(input.requestId);
      const returnPath = validateReturnPath(input.returnPath);
      if (input.caseId && !await dependencies.repository.caseOwnedByUser(input.userId, input.caseId)) {
        throw new GoogleConnectionError("GOOGLE_CONNECTION_FORBIDDEN", { status: 404 });
      }
      const createdAt = now();
      const sessionId = createId();
      const state = makeState();
      const stateDigest = digestOAuthState(state);
      const pkce = makePkce();
      const scopes = requiredGoogleScopes(sources);
      const session: GoogleOAuthSessionRecord = {
        id: sessionId,
        userId: input.userId,
        caseId: input.caseId ?? null,
        stateDigest: stateDigest.toString("base64"),
        pkceVerifier: dependencies.vault.encrypt(pkce.verifier, sessionContext({ id: sessionId, userId: input.userId })),
        requestedSources: sources,
        requestedScopes: scopes,
        returnPath,
        expiresAt: iso(addMilliseconds(createdAt, SESSION_TTL_MS)),
        consumedAt: null,
        outcomeCode: null,
        createdAt: iso(createdAt),
      };
      await dependencies.repository.createOAuthSession(session);
      await appendEvent({
        userId: input.userId,
        connectionId: null,
        caseId: session.caseId,
        eventType: "authorization_started",
        requestedSources: sources,
        coveredSources: [],
        resultCode: "STARTED",
        requestId,
      });
      return {
        authorizationUrl: dependencies.provider.buildAuthorizationUrl({
          scopes,
          state,
          codeChallenge: pkce.challenge,
          loginHint: input.loginHint,
        }),
        cookieBinding: createOAuthCookieBinding(dependencies.cookieSecret, sessionId, stateDigest),
        expiresAt: session.expiresAt,
      };
    },

    async completeAuthorization(input: CompleteAuthorizationInput): Promise<{
      connection: GoogleConnectionSummary;
      returnPath: string;
    }> {
      const requestId = validateRequestId(input.requestId);
      const stateDigest = digestOAuthState(input.state);
      const session = await dependencies.repository.findOAuthSessionByStateDigest(stateDigest.toString("base64"));
      if (!session || session.userId !== input.userId || session.consumedAt) {
        throw new GoogleConnectionError("GOOGLE_OAUTH_SESSION_INVALID", { status: 400 });
      }
      if (new Date(session.expiresAt).getTime() <= now().getTime()) {
        throw new GoogleConnectionError("GOOGLE_OAUTH_SESSION_EXPIRED", { status: 400 });
      }
      if (!verifyOAuthCookieBinding(
        dependencies.cookieSecret,
        input.cookieBinding,
        session.id,
        stateDigest,
      )) {
        throw new GoogleConnectionError("GOOGLE_OAUTH_SESSION_INVALID", { status: 400 });
      }
      if (session.caseId && !await dependencies.repository.caseOwnedByUser(input.userId, session.caseId)) {
        throw new GoogleConnectionError("GOOGLE_CONNECTION_FORBIDDEN", { status: 404 });
      }
      const consumedAt = iso(now());
      const consumed = await dependencies.repository.consumeOAuthSession(
        session.id,
        input.userId,
        consumedAt,
        "PROCESSING",
      );
      if (!consumed) throw new GoogleConnectionError("GOOGLE_OAUTH_SESSION_INVALID", { status: 400 });

      if (input.providerError) {
        const denied = input.providerError === "access_denied";
        const error = new GoogleConnectionError(
          denied ? "GOOGLE_OAUTH_ACCESS_DENIED" : "GOOGLE_PROVIDER_UNAVAILABLE",
          { status: denied ? 400 : 503, retryable: !denied },
        );
        await finishSession(consumed, error.code, denied ? "authorization_denied" : "authorization_failed", requestId);
        throw error;
      }
      if (!input.code) {
        const error = new GoogleConnectionError("GOOGLE_OAUTH_SESSION_INVALID", { status: 400 });
        await finishSession(consumed, error.code, "authorization_failed", requestId);
        throw error;
      }

      try {
        const verifier = dependencies.vault.decrypt(consumed.pkceVerifier, sessionContext(consumed));
        const tokenSet = await dependencies.provider.exchangeCode(input.code, verifier);
        const identity = await dependencies.provider.getIdentity(tokenSet.accessToken);
        const existing = await dependencies.repository.findConnectionBySubject(input.userId, identity.subject);
        const connection = await saveTokenSet(
          consumed,
          tokenSet,
          identity.subject,
          identity.email,
          identity.displayName,
        );
        await finishSession(
          consumed,
          "AUTHORIZED",
          existing ? "scope_extended" : "authorization_succeeded",
          requestId,
          connection,
        );
        return { connection: summary(connection), returnPath: consumed.returnPath };
      } catch (cause) {
        const error = asGoogleConnectionError(cause);
        await finishSession(consumed, error.code, "authorization_failed", requestId);
        throw error;
      }
    },

    async listConnections(userId: string): Promise<GoogleConnectionSummary[]> {
      return (await dependencies.repository.listConnections(userId)).map(summary);
    },

    async disconnect(userId: string, connectionId: string, requestId: string): Promise<GoogleConnectionSummary> {
      validateRequestId(requestId);
      const connection = await dependencies.repository.findConnectionById(userId, connectionId);
      if (!connection) throw new GoogleConnectionError("GOOGLE_CONNECTION_FORBIDDEN", { status: 404 });
      if (connection.status === "revoked" || connection.status === "deleted") return summary(connection);

      if (connection.accessToken) {
        const token = dependencies.vault.decrypt(
          connection.accessToken,
          connectionContext(connection, "access_token"),
        );
        await dependencies.provider.revoke(token);
      }
      const cleared = await dependencies.repository.clearConnection({
        connectionId,
        userId,
        status: "revoked",
        occurredAt: iso(now()),
      });
      if (!cleared) throw new GoogleConnectionError("GOOGLE_CONNECTION_FORBIDDEN", { status: 404 });
      await appendEvent({
        userId,
        connectionId,
        caseId: null,
        eventType: "revoked",
        requestedSources: [],
        coveredSources: [],
        resultCode: "REVOKED",
        requestId,
      });
      return summary(cleared);
    },

    async getAccessToken(connectionId: string, source: GoogleSource, requestId: string): Promise<{
      accessToken: string;
      expiresAt: string;
      grantedScopes: string[];
    }> {
      validateRequestId(requestId);
      let connection = await dependencies.repository.findConnectionByIdInternal(connectionId);
      if (!connection) throw new GoogleConnectionError("GOOGLE_CONNECTION_NOT_FOUND", { status: 404 });
      if (!sourceHasRequiredScopes(source, connection.grantedScopes)) {
        throw new GoogleConnectionError("GOOGLE_REQUIRED_SCOPES_MISSING", { status: 409 });
      }
      if (!connection.accessToken || !connection.refreshToken || !connection.tokenExpiresAt ||
        !["active", "error"].includes(connection.status)) {
        throw new GoogleConnectionError("GOOGLE_REAUTH_REQUIRED", { status: 409 });
      }
      if (new Date(connection.tokenExpiresAt).getTime() > now().getTime() + REFRESH_EARLY_MS) {
        return {
          accessToken: dependencies.vault.decrypt(
            connection.accessToken,
            connectionContext(connection, "access_token"),
          ),
          expiresAt: connection.tokenExpiresAt,
          grantedScopes: [...connection.grantedScopes],
        };
      }

      const leaseId = createId();
      const leaseNow = now();
      const acquired = await dependencies.repository.acquireRefreshLease(
        connection.id,
        leaseId,
        iso(leaseNow),
        iso(addMilliseconds(leaseNow, REFRESH_LEASE_MS)),
      );
      if (!acquired) throw new GoogleConnectionError("GOOGLE_TOKEN_REFRESH_BUSY", { status: 409, retryable: true });

      try {
        const refreshToken = dependencies.vault.decrypt(
          connection.refreshToken,
          connectionContext(connection, "refresh_token"),
        );
        const tokenSet = await dependencies.provider.refresh(refreshToken, connection.grantedScopes);
        requireIdentityScopes(tokenSet.grantedScopes);
        if (!sourceHasRequiredScopes(source, tokenSet.grantedScopes)) {
          throw new GoogleConnectionError("GOOGLE_REQUIRED_SCOPES_MISSING", { status: 409 });
        }
        const rotatedRefresh = tokenSet.refreshToken ?? refreshToken;
        const tokenExpiresAt = iso(addMilliseconds(now(), tokenSet.expiresInSeconds * 1_000));
        const identity = { id: connection.id, userId: connection.userId };
        const refreshed = await dependencies.repository.saveRefreshedConnection({
          connectionId: connection.id,
          leaseId,
          grantedScopes: normalizeGrantedScopes(tokenSet.grantedScopes),
          accessToken: dependencies.vault.encrypt(
            tokenSet.accessToken,
            connectionContext(identity, "access_token"),
          ),
          refreshToken: dependencies.vault.encrypt(
            rotatedRefresh,
            connectionContext(identity, "refresh_token"),
          ),
          tokenExpiresAt,
        });
        if (!refreshed) throw new GoogleConnectionError("GOOGLE_TOKEN_REFRESH_BUSY", { status: 409, retryable: true });
        await appendEvent({
          userId: refreshed.userId,
          connectionId: refreshed.id,
          caseId: null,
          eventType: "refresh_succeeded",
          requestedSources: [source],
          coveredSources: coveredGoogleSources(refreshed.grantedScopes),
          resultCode: "REFRESHED",
          requestId,
        });
        return { accessToken: tokenSet.accessToken, expiresAt: tokenExpiresAt, grantedScopes: refreshed.grantedScopes };
      } catch (cause) {
        const error = asGoogleConnectionError(cause);
        if ((cause instanceof GoogleProviderFailure && cause.reason === "invalid_grant") ||
          error.code === "GOOGLE_TOKEN_DECRYPTION_FAILED" ||
          error.code === "GOOGLE_REQUIRED_SCOPES_MISSING") {
          await dependencies.repository.clearConnection({
            connectionId: connection.id,
            status: "reauth_required",
            errorCode: error.code,
            occurredAt: iso(now()),
          });
        } else {
          await dependencies.repository.markRefreshError(connection.id, leaseId, error.code);
        }
        await appendEvent({
          userId: connection.userId,
          connectionId: connection.id,
          caseId: null,
          eventType: "refresh_failed",
          requestedSources: [source],
          coveredSources: [],
          resultCode: error.code,
          requestId,
        });
        throw error;
      }
    },
  };
}

export type GoogleConnectionService = ReturnType<typeof createGoogleConnectionService>;
