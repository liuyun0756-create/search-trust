export const SECRET_ENV_NAMES = [
  "CLERK_SECRET_KEY",
  "V22_INTERNAL_API_TOKEN",
  "V22_CALLBACK_SECRET",
  "V22_GOOGLE_BROKER_SECRET",
  "V22_SUPABASE_SERVICE_ROLE_KEY",
  "V22_DIFY_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "DODO_API_KEY",
  "DODO_WEBHOOK_SECRET",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_COOKIE_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEYS",
  "GOOGLE_TOKEN_BROKER_SECRET",
] as const;

export function configuredArtifactMarkers(): string[] {
  let vaultKeys: string[] = [];
  try {
    const value = JSON.parse(process.env.GOOGLE_TOKEN_ENCRYPTION_KEYS ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value))
      vaultKeys = Object.values(value).filter(
        (v): v is string => typeof v === "string",
      );
  } catch {
    /* The full configured value is still checked if it is malformed. */
  }
  return [
    ...new Set(
      [
        ...SECRET_ENV_NAMES.map((name) => process.env[name] ?? ""),
        ...vaultKeys,
        process.env.SEARCHTRUST_SECURITY_SENTINEL ?? "",
      ].filter((value) => value.length >= 16),
    ),
  ];
}
