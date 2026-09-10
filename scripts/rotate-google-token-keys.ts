import { createClient } from "@supabase/supabase-js";

import { loadGoogleTokenVaultConfig } from "../src/lib/google-connections/config";
import { SupabaseGoogleTokenRotationRepository } from "../src/lib/google-connections/rotation-repository";
import { runGoogleTokenRotation, type GoogleTokenRotationMode } from "../src/lib/google-connections/rotation";
import { TokenVault } from "../src/lib/google-connections/token-vault";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("ROTATION_NOT_CONFIGURED");
  return value;
}

async function main() {
  const mode = argument("mode") as GoogleTokenRotationMode | null;
  const oldKeyVersion = argument("old-version");
  const batchText = argument("batch-size") ?? "50";
  const batchSize = Number(batchText);
  if (!mode || !["dry-run", "execute", "verify"].includes(mode) || !oldKeyVersion) {
    throw new Error("INVALID_ROTATION_ARGUMENTS");
  }
  const config = loadGoogleTokenVaultConfig();
  if (!config.configured || !config.tokenKeys[oldKeyVersion]) {
    throw new Error("ROTATION_NOT_CONFIGURED");
  }
  const db = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const summary = await runGoogleTokenRotation({
    mode,
    oldKeyVersion,
    batchSize,
    vault: TokenVault.fromBase64Keys(config.activeKeyVersion, config.tokenKeys),
    repository: new SupabaseGoogleTokenRotationRepository(db),
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!summary.ok && mode !== "dry-run") process.exitCode = 2;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "ROTATION_FAILED" })}\n`);
  process.exitCode = 1;
});
