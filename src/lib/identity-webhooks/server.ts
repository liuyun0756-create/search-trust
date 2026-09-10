import { createServerClient } from "../supabase";
import { loadGoogleTokenVaultConfig } from "../google-connections/config";
import { GoogleOAuthHttpTokenRevoker } from "../google-connections/provider";
import { SupabaseGoogleConnectionRepository } from "../google-connections/repository";
import { TokenVault } from "../google-connections/token-vault";
import { SupabaseIdentityWebhookRepository } from "./repository";
import { createIdentityWebhookService } from "./service";

export function createServerIdentityWebhookService() {
  const db = createServerClient();
  let vault: TokenVault | null = null;
  try {
    const config = loadGoogleTokenVaultConfig();
    if (config.configured) vault = TokenVault.fromBase64Keys(config.activeKeyVersion, config.tokenKeys);
  } catch {
    vault = null;
  }
  return createIdentityWebhookService({
    repository: new SupabaseIdentityWebhookRepository(db),
    connections: new SupabaseGoogleConnectionRepository(db),
    vault,
    revoker: new GoogleOAuthHttpTokenRevoker(),
  });
}
