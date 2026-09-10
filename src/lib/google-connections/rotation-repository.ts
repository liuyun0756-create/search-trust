import type { SupabaseClient } from "@supabase/supabase-js";

import type { GoogleConnectionRecord, GoogleOAuthSessionRecord } from "./contracts";
import type { GoogleTokenRotationRepository } from "./rotation";
import type { EncryptedSecret } from "./token-vault";

type Row = Record<string, unknown>;

const CONNECTION_COLUMNS = [
  "id", "user_id", "google_subject", "account_email", "account_display_name", "granted_scopes",
  "access_token_ciphertext", "access_token_iv", "access_token_auth_tag",
  "refresh_token_ciphertext", "refresh_token_iv", "refresh_token_auth_tag",
  "encryption_key_version", "token_expires_at", "refresh_lease_id", "refresh_lease_expires_at",
  "status", "last_error_code", "connected_at", "revoked_at", "deleted_at", "created_at", "updated_at",
].join(",");

const SESSION_COLUMNS = [
  "id", "user_id", "case_id", "connection_id", "state_digest", "pkce_verifier_ciphertext",
  "pkce_verifier_iv", "pkce_verifier_auth_tag", "encryption_key_version", "requested_sources",
  "requested_scopes", "return_path", "expires_at", "consumed_at", "outcome_code", "created_at",
].join(",");

function fail(): never {
  throw new Error("GOOGLE_ROTATION_PERSISTENCE_FAILED");
}

function decodeBytea(value: unknown): string {
  if (typeof value !== "string") return fail();
  if (/^\\x[0-9a-f]+$/i.test(value)) return Buffer.from(value.slice(2), "hex").toString("base64");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length) return fail();
  return bytes.toString("base64");
}

function encodeBytea(value: string): string {
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length) return fail();
  return `\\x${bytes.toString("hex")}`;
}

function encrypted(row: Row, prefix: "access_token" | "refresh_token" | "pkce_verifier"): EncryptedSecret {
  if (typeof row.encryption_key_version !== "string") return fail();
  return {
    keyVersion: row.encryption_key_version,
    ciphertext: decodeBytea(row[`${prefix}_ciphertext`]),
    iv: decodeBytea(row[`${prefix}_iv`]),
    authTag: decodeBytea(row[`${prefix}_auth_tag`]),
  };
}

function columns(prefix: "access_token" | "refresh_token" | "pkce_verifier", value: EncryptedSecret) {
  return {
    [`${prefix}_ciphertext`]: encodeBytea(value.ciphertext),
    [`${prefix}_iv`]: encodeBytea(value.iv),
    [`${prefix}_auth_tag`]: encodeBytea(value.authTag),
  };
}

function connection(row: Row): GoogleConnectionRecord {
  return {
    id: String(row.id), userId: String(row.user_id), googleSubject: String(row.google_subject),
    accountEmail: typeof row.account_email === "string" ? row.account_email : null,
    accountDisplayName: typeof row.account_display_name === "string" ? row.account_display_name : null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [],
    accessToken: encrypted(row, "access_token"), refreshToken: encrypted(row, "refresh_token"),
    tokenExpiresAt: typeof row.token_expires_at === "string" ? row.token_expires_at : null,
    refreshLeaseId: typeof row.refresh_lease_id === "string" ? row.refresh_lease_id : null,
    refreshLeaseExpiresAt: typeof row.refresh_lease_expires_at === "string" ? row.refresh_lease_expires_at : null,
    status: row.status as GoogleConnectionRecord["status"],
    lastErrorCode: typeof row.last_error_code === "string" ? row.last_error_code : null,
    connectedAt: String(row.connected_at), revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function session(row: Row): GoogleOAuthSessionRecord {
  return {
    id: String(row.id), userId: String(row.user_id),
    caseId: typeof row.case_id === "string" ? row.case_id : null,
    connectionId: typeof row.connection_id === "string" ? row.connection_id : null,
    stateDigest: decodeBytea(row.state_digest), pkceVerifier: encrypted(row, "pkce_verifier"),
    requestedSources: (Array.isArray(row.requested_sources) ? row.requested_sources : []) as GoogleOAuthSessionRecord["requestedSources"],
    requestedScopes: Array.isArray(row.requested_scopes) ? row.requested_scopes.map(String) : [],
    returnPath: String(row.return_path), expiresAt: String(row.expires_at),
    consumedAt: typeof row.consumed_at === "string" ? row.consumed_at : null,
    outcomeCode: typeof row.outcome_code === "string" ? row.outcome_code : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseGoogleTokenRotationRepository implements GoogleTokenRotationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async countVersion(keyVersion: string) {
    const [connections, sessions] = await Promise.all([
      this.db.from("google_connections").select("id", { count: "exact", head: true })
        .eq("encryption_key_version", keyVersion),
      this.db.from("google_oauth_sessions").select("id", { count: "exact", head: true })
        .eq("encryption_key_version", keyVersion),
    ]);
    if (connections.error || sessions.error) return fail();
    return { connections: connections.count ?? 0, oauthSessions: sessions.count ?? 0 };
  }

  async listConnectionBatch(keyVersion: string, afterId: string | null, limit: number) {
    let query = this.db.from("google_connections").select(CONNECTION_COLUMNS)
      .eq("encryption_key_version", keyVersion).order("id").limit(limit);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) return fail();
    return (data ?? []).map((row) => connection(row as unknown as Row));
  }

  async listOAuthSessionBatch(keyVersion: string, afterId: string | null, limit: number) {
    let query = this.db.from("google_oauth_sessions").select(SESSION_COLUMNS)
      .eq("encryption_key_version", keyVersion).order("id").limit(limit);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) return fail();
    return (data ?? []).map((row) => session(row as unknown as Row));
  }

  async compareAndSwapConnection(input: {
    connectionId: string;
    expectedKeyVersion: string;
    expectedUpdatedAt: string;
    accessToken: EncryptedSecret;
    refreshToken: EncryptedSecret;
  }) {
    if (input.accessToken.keyVersion !== input.refreshToken.keyVersion) return false;
    const { data, error } = await this.db.from("google_connections").update({
      ...columns("access_token", input.accessToken), ...columns("refresh_token", input.refreshToken),
      encryption_key_version: input.accessToken.keyVersion,
    }).eq("id", input.connectionId).eq("encryption_key_version", input.expectedKeyVersion)
      .eq("updated_at", input.expectedUpdatedAt).select("id").maybeSingle();
    if (error) return fail();
    return Boolean(data);
  }

  async compareAndSwapOAuthSession(input: {
    sessionId: string;
    expectedKeyVersion: string;
    pkceVerifier: EncryptedSecret;
  }) {
    const { data, error } = await this.db.from("google_oauth_sessions").update({
      ...columns("pkce_verifier", input.pkceVerifier),
      encryption_key_version: input.pkceVerifier.keyVersion,
    }).eq("id", input.sessionId).eq("encryption_key_version", input.expectedKeyVersion)
      .select("id").maybeSingle();
    if (error) return fail();
    return Boolean(data);
  }
}
