import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthorizedConnectionInput,
  GoogleConnectionEventInput,
  GoogleConnectionRecord,
  GoogleOAuthSessionRecord,
  RefreshedConnectionInput,
} from "./contracts";
import { GoogleConnectionError } from "./errors";
import type { EncryptedSecret } from "./token-vault";
import type { GoogleSource } from "./scopes";

type Row = Record<string, unknown>;

export interface GoogleConnectionRepository {
  caseOwnedByUser(userId: string, caseId: string): Promise<boolean>;
  createOAuthSession(session: GoogleOAuthSessionRecord): Promise<void>;
  findOAuthSessionByStateDigest(stateDigest: string): Promise<GoogleOAuthSessionRecord | null>;
  consumeOAuthSession(
    sessionId: string,
    userId: string,
    consumedAt: string,
    outcomeCode: string,
  ): Promise<GoogleOAuthSessionRecord | null>;
  updateOAuthSessionOutcome(sessionId: string, outcomeCode: string): Promise<void>;
  findConnectionBySubject(userId: string, googleSubject: string): Promise<GoogleConnectionRecord | null>;
  findConnectionById(userId: string, connectionId: string): Promise<GoogleConnectionRecord | null>;
  findConnectionByIdInternal(connectionId: string): Promise<GoogleConnectionRecord | null>;
  listConnections(userId: string): Promise<GoogleConnectionRecord[]>;
  saveAuthorizedConnection(input: AuthorizedConnectionInput): Promise<GoogleConnectionRecord>;
  acquireRefreshLease(connectionId: string, leaseId: string, now: string, expiresAt: string): Promise<boolean>;
  saveRefreshedConnection(input: RefreshedConnectionInput): Promise<GoogleConnectionRecord | null>;
  markRefreshError(connectionId: string, leaseId: string, errorCode: string): Promise<void>;
  clearConnection(input: {
    connectionId: string;
    userId?: string;
    status: "reauth_required" | "revoked" | "deleted";
    errorCode?: string | null;
    occurredAt: string;
  }): Promise<GoogleConnectionRecord | null>;
  appendEvent(event: GoogleConnectionEventInput): Promise<void>;
  claimBrokerRequest(input: {
    requestId: string;
    nonceDigest: string;
    connectionId: string;
    source: GoogleSource;
    requestedAt: string;
    expiresAt: string;
  }): Promise<boolean>;
}

export class GoogleConnectionPersistenceError extends GoogleConnectionError {
  constructor() {
    super("GOOGLE_PERSISTENCE_FAILED", { status: 500, retryable: true });
    this.name = "GoogleConnectionPersistenceError";
  }
}

function fail(): never {
  throw new GoogleConnectionPersistenceError();
}

function toBytea(base64: string): string {
  try {
    const value = Buffer.from(base64, "base64");
    if (!value.length) return fail();
    return `\\x${value.toString("hex")}`;
  } catch {
    return fail();
  }
}

function fromBytea(value: unknown): string {
  if (typeof value !== "string") return fail();
  if (/^\\x[0-9a-f]+$/i.test(value)) return Buffer.from(value.slice(2), "hex").toString("base64");
  try {
    const bytes = Buffer.from(value, "base64");
    if (!bytes.length) return fail();
    return bytes.toString("base64");
  } catch {
    return fail();
  }
}

function encryptedFromRow(row: Row, prefix: "access_token" | "refresh_token" | "pkce_verifier"): EncryptedSecret | null {
  const ciphertext = row[`${prefix}_ciphertext`];
  const iv = row[`${prefix}_iv`];
  const authTag = row[`${prefix}_auth_tag`];
  if (ciphertext === null || ciphertext === undefined) return null;
  if (typeof row.encryption_key_version !== "string") return fail();
  return {
    keyVersion: row.encryption_key_version,
    ciphertext: fromBytea(ciphertext),
    iv: fromBytea(iv),
    authTag: fromBytea(authTag),
  };
}

function encryptedColumns(prefix: "access_token" | "refresh_token" | "pkce_verifier", value: EncryptedSecret) {
  return {
    [`${prefix}_ciphertext`]: toBytea(value.ciphertext),
    [`${prefix}_iv`]: toBytea(value.iv),
    [`${prefix}_auth_tag`]: toBytea(value.authTag),
  };
}

function connectionFromRow(row: Row): GoogleConnectionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    googleSubject: String(row.google_subject),
    accountEmail: typeof row.account_email === "string" ? row.account_email : null,
    accountDisplayName: typeof row.account_display_name === "string" ? row.account_display_name : null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [],
    accessToken: encryptedFromRow(row, "access_token"),
    refreshToken: encryptedFromRow(row, "refresh_token"),
    tokenExpiresAt: typeof row.token_expires_at === "string" ? row.token_expires_at : null,
    refreshLeaseId: typeof row.refresh_lease_id === "string" ? row.refresh_lease_id : null,
    refreshLeaseExpiresAt: typeof row.refresh_lease_expires_at === "string" ? row.refresh_lease_expires_at : null,
    status: row.status as GoogleConnectionRecord["status"],
    lastErrorCode: typeof row.last_error_code === "string" ? row.last_error_code : null,
    connectedAt: String(row.connected_at),
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function oauthSessionFromRow(row: Row): GoogleOAuthSessionRecord {
  const verifier = encryptedFromRow(row, "pkce_verifier");
  if (!verifier) return fail();
  return {
    id: String(row.id),
    userId: String(row.user_id),
    caseId: typeof row.case_id === "string" ? row.case_id : null,
    connectionId: typeof row.connection_id === "string" ? row.connection_id : null,
    stateDigest: fromBytea(row.state_digest),
    pkceVerifier: verifier,
    requestedSources: (Array.isArray(row.requested_sources) ? row.requested_sources : []) as GoogleOAuthSessionRecord["requestedSources"],
    requestedScopes: Array.isArray(row.requested_scopes) ? row.requested_scopes.map(String) : [],
    returnPath: String(row.return_path),
    expiresAt: String(row.expires_at),
    consumedAt: typeof row.consumed_at === "string" ? row.consumed_at : null,
    outcomeCode: typeof row.outcome_code === "string" ? row.outcome_code : null,
    createdAt: String(row.created_at),
  };
}

const CONNECTION_COLUMNS = [
  "id", "user_id", "google_subject", "account_email", "account_display_name", "granted_scopes",
  "access_token_ciphertext", "access_token_iv", "access_token_auth_tag",
  "refresh_token_ciphertext", "refresh_token_iv", "refresh_token_auth_tag",
  "encryption_key_version", "token_expires_at", "refresh_lease_id", "refresh_lease_expires_at",
  "status", "last_error_code", "connected_at", "revoked_at", "deleted_at", "created_at", "updated_at",
].join(",");

const SESSION_COLUMNS = [
  "id", "user_id", "case_id", "connection_id", "state_digest", "pkce_verifier_ciphertext", "pkce_verifier_iv",
  "pkce_verifier_auth_tag", "encryption_key_version", "requested_sources", "requested_scopes",
  "return_path", "expires_at", "consumed_at", "outcome_code", "created_at",
].join(",");

export class SupabaseGoogleConnectionRepository implements GoogleConnectionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async caseOwnedByUser(userId: string, caseId: string): Promise<boolean> {
    const { data, error } = await this.supabase.from("client_cases").select("id")
      .eq("id", caseId).eq("user_id", userId).maybeSingle();
    if (error) return fail();
    return Boolean(data);
  }

  async createOAuthSession(session: GoogleOAuthSessionRecord): Promise<void> {
    const { error } = await this.supabase.from("google_oauth_sessions").insert({
      id: session.id,
      user_id: session.userId,
      case_id: session.caseId,
      connection_id: session.connectionId,
      state_digest: toBytea(session.stateDigest),
      ...encryptedColumns("pkce_verifier", session.pkceVerifier),
      encryption_key_version: session.pkceVerifier.keyVersion,
      requested_sources: session.requestedSources,
      requested_scopes: session.requestedScopes,
      return_path: session.returnPath,
      expires_at: session.expiresAt,
      consumed_at: session.consumedAt,
      outcome_code: session.outcomeCode,
      created_at: session.createdAt,
    });
    if (error) return fail();
  }

  async findOAuthSessionByStateDigest(stateDigest: string): Promise<GoogleOAuthSessionRecord | null> {
    const { data, error } = await this.supabase.from("google_oauth_sessions").select(SESSION_COLUMNS)
      .eq("state_digest", toBytea(stateDigest)).maybeSingle();
    if (error) return fail();
    return data ? oauthSessionFromRow(data as unknown as Row) : null;
  }

  async consumeOAuthSession(
    sessionId: string,
    userId: string,
    consumedAt: string,
    outcomeCode: string,
  ): Promise<GoogleOAuthSessionRecord | null> {
    const { data, error } = await this.supabase.from("google_oauth_sessions")
      .update({ consumed_at: consumedAt, outcome_code: outcomeCode })
      .eq("id", sessionId).eq("user_id", userId).is("consumed_at", null)
      .gt("expires_at", consumedAt).select(SESSION_COLUMNS).maybeSingle();
    if (error) return fail();
    return data ? oauthSessionFromRow(data as unknown as Row) : null;
  }

  async updateOAuthSessionOutcome(sessionId: string, outcomeCode: string): Promise<void> {
    const { error } = await this.supabase.from("google_oauth_sessions")
      .update({ outcome_code: outcomeCode }).eq("id", sessionId).not("consumed_at", "is", null);
    if (error) return fail();
  }

  async findConnectionBySubject(userId: string, googleSubject: string): Promise<GoogleConnectionRecord | null> {
    const { data, error } = await this.supabase.from("google_connections").select(CONNECTION_COLUMNS)
      .eq("user_id", userId).eq("google_subject", googleSubject).neq("status", "deleted").maybeSingle();
    if (error) return fail();
    return data ? connectionFromRow(data as unknown as Row) : null;
  }

  async findConnectionById(userId: string, connectionId: string): Promise<GoogleConnectionRecord | null> {
    const { data, error } = await this.supabase.from("google_connections").select(CONNECTION_COLUMNS)
      .eq("id", connectionId).eq("user_id", userId).maybeSingle();
    if (error) return fail();
    return data ? connectionFromRow(data as unknown as Row) : null;
  }

  async findConnectionByIdInternal(connectionId: string): Promise<GoogleConnectionRecord | null> {
    const { data, error } = await this.supabase.from("google_connections").select(CONNECTION_COLUMNS)
      .eq("id", connectionId).maybeSingle();
    if (error) return fail();
    return data ? connectionFromRow(data as unknown as Row) : null;
  }

  async listConnections(userId: string): Promise<GoogleConnectionRecord[]> {
    const { data, error } = await this.supabase.from("google_connections").select(CONNECTION_COLUMNS)
      .eq("user_id", userId).neq("status", "deleted").order("updated_at", { ascending: false });
    if (error) return fail();
    return (data ?? []).map((row) => connectionFromRow(row as unknown as Row));
  }

  async saveAuthorizedConnection(input: AuthorizedConnectionInput): Promise<GoogleConnectionRecord> {
    if (input.accessToken.keyVersion !== input.refreshToken.keyVersion) return fail();
    const payload = {
      id: input.id,
      user_id: input.userId,
      google_subject: input.googleSubject,
      account_email: input.accountEmail,
      account_display_name: input.accountDisplayName,
      granted_scopes: input.grantedScopes,
      ...encryptedColumns("access_token", input.accessToken),
      ...encryptedColumns("refresh_token", input.refreshToken),
      encryption_key_version: input.accessToken.keyVersion,
      token_expires_at: input.tokenExpiresAt,
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
      status: "active",
      last_error_code: null,
      last_error_message: null,
      revoked_at: null,
      deleted_at: null,
    };
    const { data, error } = await this.supabase.from("google_connections").upsert(payload, { onConflict: "id" })
      .select(CONNECTION_COLUMNS).single();
    if (error || !data) return fail();
    return connectionFromRow(data as unknown as Row);
  }

  async acquireRefreshLease(connectionId: string, leaseId: string, now: string, expiresAt: string): Promise<boolean> {
    const { data, error } = await this.supabase.from("google_connections")
      .update({ refresh_lease_id: leaseId, refresh_lease_expires_at: expiresAt })
      .eq("id", connectionId).in("status", ["active", "error"])
      .or(`refresh_lease_id.is.null,refresh_lease_expires_at.lt.${now}`)
      .select("id").maybeSingle();
    if (error) return fail();
    return Boolean(data);
  }

  async saveRefreshedConnection(input: RefreshedConnectionInput): Promise<GoogleConnectionRecord | null> {
    if (input.accessToken.keyVersion !== input.refreshToken.keyVersion) return fail();
    const { data, error } = await this.supabase.from("google_connections").update({
      granted_scopes: input.grantedScopes,
      ...encryptedColumns("access_token", input.accessToken),
      ...encryptedColumns("refresh_token", input.refreshToken),
      encryption_key_version: input.accessToken.keyVersion,
      token_expires_at: input.tokenExpiresAt,
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
      status: "active",
      last_error_code: null,
      last_error_message: null,
    }).eq("id", input.connectionId).eq("refresh_lease_id", input.leaseId)
      .select(CONNECTION_COLUMNS).maybeSingle();
    if (error) return fail();
    return data ? connectionFromRow(data as unknown as Row) : null;
  }

  async markRefreshError(connectionId: string, leaseId: string, errorCode: string): Promise<void> {
    const { error } = await this.supabase.from("google_connections").update({
      status: "error",
      last_error_code: errorCode,
      last_error_message: "Google is temporarily unavailable.",
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
    }).eq("id", connectionId).eq("refresh_lease_id", leaseId);
    if (error) return fail();
  }

  async clearConnection(input: {
    connectionId: string;
    userId?: string;
    status: "reauth_required" | "revoked" | "deleted";
    errorCode?: string | null;
    occurredAt: string;
  }): Promise<GoogleConnectionRecord | null> {
    const payload = {
      status: input.status,
      access_token_ciphertext: null,
      access_token_iv: null,
      access_token_auth_tag: null,
      refresh_token_ciphertext: null,
      refresh_token_iv: null,
      refresh_token_auth_tag: null,
      encryption_key_version: null,
      token_expires_at: null,
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
      last_error_code: input.errorCode ?? null,
      last_error_message: null,
      revoked_at: input.status === "revoked" ? input.occurredAt : null,
      deleted_at: input.status === "deleted" ? input.occurredAt : null,
    };
    let query = this.supabase.from("google_connections").update(payload).eq("id", input.connectionId);
    if (input.userId) query = query.eq("user_id", input.userId);
    const { data, error } = await query.select(CONNECTION_COLUMNS).maybeSingle();
    if (error) return fail();
    return data ? connectionFromRow(data as unknown as Row) : null;
  }

  async appendEvent(event: GoogleConnectionEventInput): Promise<void> {
    const { error } = await this.supabase.from("google_connection_events").insert({
      user_id: event.userId,
      connection_id: event.connectionId,
      case_id: event.caseId,
      event_type: event.eventType,
      requested_sources: event.requestedSources,
      covered_sources: event.coveredSources,
      result_code: event.resultCode,
      request_id: event.requestId,
    });
    if (error) return fail();
  }

  async claimBrokerRequest(input: {
    requestId: string;
    nonceDigest: string;
    connectionId: string;
    source: GoogleSource;
    requestedAt: string;
    expiresAt: string;
  }): Promise<boolean> {
    const { error } = await this.supabase.from("google_token_broker_requests").insert({
      request_id: input.requestId,
      nonce_digest: toBytea(input.nonceDigest),
      connection_id: input.connectionId,
      source_type: input.source,
      requested_at: input.requestedAt,
      expires_at: input.expiresAt,
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    return fail();
  }
}
