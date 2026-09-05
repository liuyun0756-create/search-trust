import { GoogleConnectionError } from "./errors";

type Environment = Record<string, string | undefined>;

export type GoogleConnectionConfig =
  | { enabled: false }
  | {
      enabled: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      activeKeyVersion: string;
      tokenKeys: Record<string, string>;
      cookieSecret: string;
      brokerSecret: string;
    };

function invalidConfiguration(): GoogleConnectionError {
  return new GoogleConnectionError("GOOGLE_OAUTH_NOT_CONFIGURED", { status: 503 });
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw invalidConfiguration();
  return value;
}

function parseKeys(raw: string, activeVersion: string): Record<string, string> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalidConfiguration();
  }
  if (!value || Array.isArray(value) || typeof value !== "object") throw invalidConfiguration();
  const keys: Record<string, string> = {};
  for (const [version, encoded] of Object.entries(value)) {
    if (!version.trim() || typeof encoded !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw invalidConfiguration();
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== 32) throw invalidConfiguration();
    keys[version] = encoded;
  }
  if (!keys[activeVersion]) throw invalidConfiguration();
  return keys;
}

function validateRedirectUri(raw: string, baseUrlRaw: string): string {
  try {
    const redirect = new URL(raw);
    const base = new URL(baseUrlRaw);
    const localhost = redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1";
    if (redirect.origin !== base.origin || redirect.pathname !== "/api/v2/google/oauth/callback") {
      throw invalidConfiguration();
    }
    if (redirect.protocol !== "https:" && !(localhost && redirect.protocol === "http:")) {
      throw invalidConfiguration();
    }
    return redirect.toString();
  } catch (error) {
    if (error instanceof GoogleConnectionError) throw error;
    throw invalidConfiguration();
  }
}

export function loadGoogleConnectionConfig(env: Environment = process.env): GoogleConnectionConfig {
  if (env.GOOGLE_CONNECTIONS_ENABLED !== "true") return { enabled: false };

  const clientId = required(env, "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = required(env, "GOOGLE_OAUTH_CLIENT_SECRET");
  const baseUrl = required(env, "NEXT_PUBLIC_BASE_URL");
  const redirectUri = validateRedirectUri(required(env, "GOOGLE_OAUTH_REDIRECT_URI"), baseUrl);
  const activeKeyVersion = required(env, "GOOGLE_TOKEN_ENCRYPTION_ACTIVE_VERSION");
  const tokenKeys = parseKeys(required(env, "GOOGLE_TOKEN_ENCRYPTION_KEYS"), activeKeyVersion);
  const cookieSecret = required(env, "GOOGLE_OAUTH_COOKIE_SECRET");
  const brokerSecret = required(env, "GOOGLE_TOKEN_BROKER_SECRET");
  if (Buffer.byteLength(cookieSecret, "utf8") < 32 || Buffer.byteLength(brokerSecret, "utf8") < 32) {
    throw invalidConfiguration();
  }

  return {
    enabled: true,
    clientId,
    clientSecret,
    redirectUri,
    activeKeyVersion,
    tokenKeys,
    cookieSecret,
    brokerSecret,
  };
}
