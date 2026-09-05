export const GOOGLE_CONNECTION_ERROR_CODES = [
  "GOOGLE_CONNECTIONS_DISABLED",
  "GOOGLE_OAUTH_NOT_CONFIGURED",
  "GOOGLE_OAUTH_SESSION_INVALID",
  "GOOGLE_OAUTH_SESSION_EXPIRED",
  "GOOGLE_OAUTH_ACCESS_DENIED",
  "GOOGLE_REQUIRED_SCOPES_MISSING",
  "GOOGLE_REFRESH_TOKEN_REQUIRED",
  "GOOGLE_REAUTH_REQUIRED",
  "GOOGLE_CONNECTION_FORBIDDEN",
  "GOOGLE_CONNECTION_NOT_FOUND",
  "GOOGLE_CONNECTION_INVALID_REQUEST",
  "GOOGLE_TOKEN_DECRYPTION_FAILED",
  "GOOGLE_TOKEN_REFRESH_BUSY",
  "GOOGLE_BROKER_AUTH_FAILED",
  "GOOGLE_BROKER_REPLAYED",
  "GOOGLE_PROVIDER_UNAVAILABLE",
  "GOOGLE_PERSISTENCE_FAILED",
] as const;

export type GoogleConnectionErrorCode = (typeof GOOGLE_CONNECTION_ERROR_CODES)[number];

const DEFAULT_MESSAGES: Record<GoogleConnectionErrorCode, string> = {
  GOOGLE_CONNECTIONS_DISABLED: "Google connections are not available yet.",
  GOOGLE_OAUTH_NOT_CONFIGURED: "Google connections are not configured.",
  GOOGLE_OAUTH_SESSION_INVALID: "This Google authorization session is invalid.",
  GOOGLE_OAUTH_SESSION_EXPIRED: "This Google authorization session has expired.",
  GOOGLE_OAUTH_ACCESS_DENIED: "Google authorization was not granted.",
  GOOGLE_REQUIRED_SCOPES_MISSING: "The required Google permissions were not granted.",
  GOOGLE_REFRESH_TOKEN_REQUIRED: "Google must be reconnected to enable ongoing access.",
  GOOGLE_REAUTH_REQUIRED: "This Google connection must be authorized again.",
  GOOGLE_CONNECTION_FORBIDDEN: "This Google connection is not available to the current user.",
  GOOGLE_CONNECTION_NOT_FOUND: "The Google connection was not found.",
  GOOGLE_CONNECTION_INVALID_REQUEST: "The Google connection request is invalid.",
  GOOGLE_TOKEN_DECRYPTION_FAILED: "The Google connection must be authorized again.",
  GOOGLE_TOKEN_REFRESH_BUSY: "The Google connection is already being refreshed.",
  GOOGLE_BROKER_AUTH_FAILED: "Google token broker authentication failed.",
  GOOGLE_BROKER_REPLAYED: "This Google token request has already been used.",
  GOOGLE_PROVIDER_UNAVAILABLE: "Google is temporarily unavailable. Please try again.",
  GOOGLE_PERSISTENCE_FAILED: "The Google connection could not be saved.",
};

export class GoogleConnectionError extends Error {
  readonly code: GoogleConnectionErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: GoogleConnectionErrorCode,
    options: { status?: number; retryable?: boolean; message?: string } = {},
  ) {
    super(options.message ?? DEFAULT_MESSAGES[code]);
    this.name = "GoogleConnectionError";
    this.code = code;
    this.status = options.status ?? 400;
    this.retryable = options.retryable ?? false;
  }
}

export function asGoogleConnectionError(error: unknown): GoogleConnectionError {
  if (error instanceof GoogleConnectionError) return error;
  return new GoogleConnectionError("GOOGLE_PROVIDER_UNAVAILABLE", {
    status: 503,
    retryable: true,
  });
}
