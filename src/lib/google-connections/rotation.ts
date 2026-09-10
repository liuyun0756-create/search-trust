import type { GoogleConnectionRecord, GoogleOAuthSessionRecord } from "./contracts";
import type { EncryptedSecret } from "./token-vault";
import { TokenVault } from "./token-vault";

export interface GoogleTokenRotationRepository {
  countVersion(keyVersion: string): Promise<{ connections: number; oauthSessions: number }>;
  listConnectionBatch(keyVersion: string, afterId: string | null, limit: number): Promise<GoogleConnectionRecord[]>;
  listOAuthSessionBatch(keyVersion: string, afterId: string | null, limit: number): Promise<GoogleOAuthSessionRecord[]>;
  compareAndSwapConnection(input: {
    connectionId: string;
    expectedKeyVersion: string;
    expectedUpdatedAt: string;
    accessToken: EncryptedSecret;
    refreshToken: EncryptedSecret;
  }): Promise<boolean>;
  compareAndSwapOAuthSession(input: {
    sessionId: string;
    expectedKeyVersion: string;
    pkceVerifier: EncryptedSecret;
  }): Promise<boolean>;
}

export type GoogleTokenRotationMode = "dry-run" | "execute" | "verify";

export interface GoogleTokenRotationSummary {
  mode: GoogleTokenRotationMode;
  oldKeyVersion: string;
  activeKeyVersion: string;
  before: { connections: number; oauthSessions: number };
  after: { connections: number; oauthSessions: number };
  rotated: { connections: number; oauthSessions: number };
  conflicts: { connections: number; oauthSessions: number };
  failures: { connections: number; oauthSessions: number };
  verifiedSamples: { connections: number; oauthSessions: number };
  ok: boolean;
}

function connectionContext(
  connection: Pick<GoogleConnectionRecord, "id" | "userId">,
  kind: "access_token" | "refresh_token",
) {
  return {
    recordType: "connection" as const,
    userId: connection.userId,
    recordId: connection.id,
    secretKind: kind,
  };
}

function sessionContext(session: Pick<GoogleOAuthSessionRecord, "id" | "userId">) {
  return {
    recordType: "oauth_session" as const,
    userId: session.userId,
    recordId: session.id,
    secretKind: "pkce_verifier" as const,
  };
}

function emptySummary(
  mode: GoogleTokenRotationMode,
  oldKeyVersion: string,
  activeKeyVersion: string,
  counts: { connections: number; oauthSessions: number },
): GoogleTokenRotationSummary {
  return {
    mode,
    oldKeyVersion,
    activeKeyVersion,
    before: { ...counts },
    after: { ...counts },
    rotated: { connections: 0, oauthSessions: 0 },
    conflicts: { connections: 0, oauthSessions: 0 },
    failures: { connections: 0, oauthSessions: 0 },
    verifiedSamples: { connections: 0, oauthSessions: 0 },
    ok: mode === "dry-run" || (counts.connections === 0 && counts.oauthSessions === 0),
  };
}

async function rotateConnections(
  repository: GoogleTokenRotationRepository,
  vault: TokenVault,
  oldKeyVersion: string,
  batchSize: number,
  summary: GoogleTokenRotationSummary,
) {
  let cursor: string | null = null;
  while (true) {
    const batch = await repository.listConnectionBatch(oldKeyVersion, cursor, batchSize);
    if (!batch.length) return;
    for (const connection of batch) {
      cursor = connection.id;
      try {
        if (!connection.accessToken || !connection.refreshToken ||
            connection.accessToken.keyVersion !== oldKeyVersion ||
            connection.refreshToken.keyVersion !== oldKeyVersion) {
          summary.failures.connections += 1;
          continue;
        }
        const access = vault.decrypt(connection.accessToken, connectionContext(connection, "access_token"));
        const refresh = vault.decrypt(connection.refreshToken, connectionContext(connection, "refresh_token"));
        const swapped = await repository.compareAndSwapConnection({
          connectionId: connection.id,
          expectedKeyVersion: oldKeyVersion,
          expectedUpdatedAt: connection.updatedAt,
          accessToken: vault.encrypt(access, connectionContext(connection, "access_token")),
          refreshToken: vault.encrypt(refresh, connectionContext(connection, "refresh_token")),
        });
        if (swapped) summary.rotated.connections += 1;
        else summary.conflicts.connections += 1;
      } catch {
        summary.failures.connections += 1;
      }
    }
    if (batch.length < batchSize) return;
  }
}

async function rotateOAuthSessions(
  repository: GoogleTokenRotationRepository,
  vault: TokenVault,
  oldKeyVersion: string,
  batchSize: number,
  summary: GoogleTokenRotationSummary,
) {
  let cursor: string | null = null;
  while (true) {
    const batch = await repository.listOAuthSessionBatch(oldKeyVersion, cursor, batchSize);
    if (!batch.length) return;
    for (const session of batch) {
      cursor = session.id;
      try {
        if (session.pkceVerifier.keyVersion !== oldKeyVersion) {
          summary.failures.oauthSessions += 1;
          continue;
        }
        const verifier = vault.decrypt(session.pkceVerifier, sessionContext(session));
        const swapped = await repository.compareAndSwapOAuthSession({
          sessionId: session.id,
          expectedKeyVersion: oldKeyVersion,
          pkceVerifier: vault.encrypt(verifier, sessionContext(session)),
        });
        if (swapped) summary.rotated.oauthSessions += 1;
        else summary.conflicts.oauthSessions += 1;
      } catch {
        summary.failures.oauthSessions += 1;
      }
    }
    if (batch.length < batchSize) return;
  }
}

async function verifyActiveSamples(
  repository: GoogleTokenRotationRepository,
  vault: TokenVault,
  batchSize: number,
  summary: GoogleTokenRotationSummary,
) {
  const limit = Math.min(batchSize, 10);
  const connections = await repository.listConnectionBatch(vault.activeKeyVersion, null, limit);
  for (const connection of connections) {
    try {
      if (!connection.accessToken || !connection.refreshToken) throw new Error("INVALID_ROTATION_RECORD");
      vault.decrypt(connection.accessToken, connectionContext(connection, "access_token"));
      vault.decrypt(connection.refreshToken, connectionContext(connection, "refresh_token"));
      summary.verifiedSamples.connections += 1;
    } catch {
      summary.failures.connections += 1;
    }
  }
  const sessions = await repository.listOAuthSessionBatch(vault.activeKeyVersion, null, limit);
  for (const session of sessions) {
    try {
      vault.decrypt(session.pkceVerifier, sessionContext(session));
      summary.verifiedSamples.oauthSessions += 1;
    } catch {
      summary.failures.oauthSessions += 1;
    }
  }
}

export async function runGoogleTokenRotation(input: {
  mode: GoogleTokenRotationMode;
  oldKeyVersion: string;
  batchSize?: number;
  vault: TokenVault;
  repository: GoogleTokenRotationRepository;
}): Promise<GoogleTokenRotationSummary> {
  const oldKeyVersion = input.oldKeyVersion.trim();
  const batchSize = input.batchSize ?? 50;
  if (!oldKeyVersion || oldKeyVersion === input.vault.activeKeyVersion ||
      !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("INVALID_ROTATION_CONFIGURATION");
  }
  const before = await input.repository.countVersion(oldKeyVersion);
  const summary = emptySummary(input.mode, oldKeyVersion, input.vault.activeKeyVersion, before);
  if (input.mode === "dry-run") return summary;

  if (input.mode === "execute") {
    await rotateConnections(input.repository, input.vault, oldKeyVersion, batchSize, summary);
    await rotateOAuthSessions(input.repository, input.vault, oldKeyVersion, batchSize, summary);
  }
  await verifyActiveSamples(input.repository, input.vault, batchSize, summary);
  summary.after = await input.repository.countVersion(oldKeyVersion);
  summary.ok = summary.after.connections === 0 && summary.after.oauthSessions === 0 &&
    summary.failures.connections === 0 && summary.failures.oauthSessions === 0;
  return summary;
}
