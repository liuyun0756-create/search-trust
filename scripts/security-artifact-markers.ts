export const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "CLERK_WEBHOOK_SIGNING_SECRET", "DODO_API_KEY",
  "DODO_WEBHOOK_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_COOKIE_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEYS", "GOOGLE_TOKEN_BROKER_SECRET",
] as const;

export function configuredArtifactMarkers(): string[] {
  return [
    ...SECRET_ENV_NAMES.map((name) => process.env[name] ?? ""),
    process.env.SEARCHTRUST_SECURITY_SENTINEL ?? "",
  ].filter((value) => value.length >= 16);
}
