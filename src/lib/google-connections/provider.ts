import { GoogleConnectionError } from "./errors";
import { normalizeGrantedScopes } from "./scopes";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  grantedScopes: string[];
  tokenType: "Bearer";
}

export interface GoogleIdentity {
  subject: string;
  email: string | null;
  displayName: string | null;
}

export type GoogleProviderFailureReason =
  | "access_denied"
  | "invalid_grant"
  | "provider_error";

export class GoogleProviderFailure extends GoogleConnectionError {
  readonly reason: GoogleProviderFailureReason;

  constructor(reason: GoogleProviderFailureReason) {
    const denied = reason === "access_denied";
    const invalidGrant = reason === "invalid_grant";
    super(
      denied
        ? "GOOGLE_OAUTH_ACCESS_DENIED"
        : invalidGrant
          ? "GOOGLE_REAUTH_REQUIRED"
          : "GOOGLE_PROVIDER_UNAVAILABLE",
      { status: denied ? 400 : invalidGrant ? 409 : 503, retryable: reason === "provider_error" },
    );
    this.name = "GoogleProviderFailure";
    this.reason = reason;
  }
}

export interface GoogleOAuthProvider {
  buildAuthorizationUrl(input: {
    scopes: readonly string[];
    state: string;
    codeChallenge: string;
    loginHint?: string | null;
  }): string;
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenSet>;
  getIdentity(accessToken: string): Promise<GoogleIdentity>;
  refresh(refreshToken: string): Promise<GoogleTokenSet>;
  revoke(token: string): Promise<void>;
}

function unavailable(): GoogleConnectionError {
  return new GoogleConnectionError("GOOGLE_PROVIDER_UNAVAILABLE", {
    status: 503,
    retryable: true,
  });
}

async function limitedJson(response: Response): Promise<Record<string, unknown>> {
  const text = (await response.text()).slice(0, 16_384);
  try {
    const value: unknown = JSON.parse(text);
    if (value && !Array.isArray(value) && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  } catch {}
  return {};
}

function providerFailure(body: Record<string, unknown>): GoogleProviderFailure {
  if (body.error === "access_denied") return new GoogleProviderFailure("access_denied");
  if (body.error === "invalid_grant") return new GoogleProviderFailure("invalid_grant");
  return new GoogleProviderFailure("provider_error");
}

function normalizeTokenSet(body: Record<string, unknown>): GoogleTokenSet {
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  const expiresIn = body.expires_in;
  const scope = body.scope;
  const tokenType = body.token_type;
  if (
    typeof accessToken !== "string" || !accessToken ||
    (refreshToken !== undefined && typeof refreshToken !== "string") ||
    typeof expiresIn !== "number" || !Number.isInteger(expiresIn) || expiresIn <= 0 || expiresIn > 86_400 ||
    typeof scope !== "string" || !scope.trim() ||
    typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer"
  ) {
    throw unavailable();
  }
  return {
    accessToken,
    refreshToken: typeof refreshToken === "string" && refreshToken ? refreshToken : null,
    expiresInSeconds: expiresIn,
    grantedScopes: normalizeGrantedScopes(scope),
    tokenType: "Bearer",
  };
}

export class GoogleOAuthHttpProvider implements GoogleOAuthProvider {
  constructor(
    private readonly config: GoogleProviderConfig,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  buildAuthorizationUrl(input: {
    scopes: readonly string[];
    state: string;
    codeChallenge: string;
    loginHint?: string | null;
  }): string {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", [...new Set(input.scopes)].sort().join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
    return url.toString();
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenSet> {
    return this.tokenRequest(new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    }));
  }

  async refresh(refreshToken: string): Promise<GoogleTokenSet> {
    return this.tokenRequest(new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }));
  }

  async getIdentity(accessToken: string): Promise<GoogleIdentity> {
    try {
      const response = await this.fetcher(USERINFO_ENDPOINT, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const body = await limitedJson(response);
      if (!response.ok) throw providerFailure(body);
      if (typeof body.sub !== "string" || !body.sub.trim()) throw unavailable();
      return {
        subject: body.sub,
        email: typeof body.email === "string" && body.email ? body.email : null,
        displayName: typeof body.name === "string" && body.name ? body.name : null,
      };
    } catch (error) {
      if (error instanceof GoogleConnectionError) throw error;
      throw unavailable();
    }
  }

  async revoke(token: string): Promise<void> {
    try {
      const response = await this.fetcher(REVOCATION_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ token }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.ok) return;
      const body = await limitedJson(response);
      if (response.status === 400 && body.error === "invalid_token") return;
      throw providerFailure(body);
    } catch (error) {
      if (error instanceof GoogleConnectionError) throw error;
      throw unavailable();
    }
  }

  private async tokenRequest(body: URLSearchParams): Promise<GoogleTokenSet> {
    try {
      const response = await this.fetcher(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const payload = await limitedJson(response);
      if (!response.ok) throw providerFailure(payload);
      return normalizeTokenSet(payload);
    } catch (error) {
      if (error instanceof GoogleConnectionError) throw error;
      throw unavailable();
    }
  }
}
