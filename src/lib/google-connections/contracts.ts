import type { EncryptedSecret } from "./token-vault";
import type { GoogleSource } from "./scopes";

export type GoogleConnectionStatus =
  | "active"
  | "error"
  | "reauth_required"
  | "revoked"
  | "deleted";

export interface GoogleConnectionRecord {
  id: string;
  userId: string;
  googleSubject: string;
  accountEmail: string | null;
  accountDisplayName: string | null;
  grantedScopes: string[];
  accessToken: EncryptedSecret | null;
  refreshToken: EncryptedSecret | null;
  tokenExpiresAt: string | null;
  refreshLeaseId: string | null;
  refreshLeaseExpiresAt: string | null;
  status: GoogleConnectionStatus;
  lastErrorCode: string | null;
  connectedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleOAuthSessionRecord {
  id: string;
  userId: string;
  caseId: string | null;
  connectionId: string | null;
  stateDigest: string;
  pkceVerifier: EncryptedSecret;
  requestedSources: GoogleSource[];
  requestedScopes: string[];
  returnPath: string;
  expiresAt: string;
  consumedAt: string | null;
  outcomeCode: string | null;
  createdAt: string;
}

export type GoogleConnectionEventType =
  | "authorization_started"
  | "authorization_succeeded"
  | "authorization_denied"
  | "authorization_failed"
  | "scope_extended"
  | "refresh_succeeded"
  | "refresh_failed"
  | "revoked"
  | "deleted";

export interface GoogleConnectionEventInput {
  userId: string;
  connectionId: string | null;
  caseId: string | null;
  eventType: GoogleConnectionEventType;
  requestedSources: GoogleSource[];
  coveredSources: GoogleSource[];
  resultCode: string;
  requestId: string;
}

export interface GoogleConnectionSummary {
  id: string;
  account_email: string | null;
  account_display_name: string | null;
  granted_scopes: string[];
  covered_sources: GoogleSource[];
  status: GoogleConnectionStatus;
  last_error_code: string | null;
  connected_at: string;
  updated_at: string;
}

export interface AuthorizedConnectionInput {
  id: string;
  userId: string;
  googleSubject: string;
  accountEmail: string | null;
  accountDisplayName: string | null;
  grantedScopes: string[];
  accessToken: EncryptedSecret;
  refreshToken: EncryptedSecret;
  tokenExpiresAt: string;
}

export interface RefreshedConnectionInput {
  connectionId: string;
  leaseId: string;
  grantedScopes: string[];
  accessToken: EncryptedSecret;
  refreshToken: EncryptedSecret;
  tokenExpiresAt: string;
}
