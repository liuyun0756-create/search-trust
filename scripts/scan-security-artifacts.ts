import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { scanArtifacts } from "../src/lib/security-v22/artifact-scan";

const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "CLERK_WEBHOOK_SIGNING_SECRET", "DODO_API_KEY",
  "DODO_WEBHOOK_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_COOKIE_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEYS", "GOOGLE_TOKEN_BROKER_SECRET",
];

async function main() {
  loadEnvConfig(process.cwd());
  // Local templates intentionally reuse short placeholder text. Real deployment
  // credentials are longer; ignoring values below 16 bytes prevents ordinary bundle
  // words from being reported as credential leaks.
  const markers = SECRET_ENV_NAMES.map((name) => {
    const value = process.env[name] ?? "";
    return value.length >= 16 ? value : "";
  });
  markers.push(process.env.SEARCHTRUST_SECURITY_SENTINEL ?? "");
  const result = await scanArtifacts(path.resolve(process.cwd(), ".next/static"), markers);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 2;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "SECURITY_SCAN_FAILED" })}\n`);
  process.exitCode = 1;
});
