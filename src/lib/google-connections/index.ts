import { createServerClient } from "@/lib/supabase";

import { loadGoogleConnectionConfig } from "./config";
import { GoogleConnectionError } from "./errors";
import { GoogleOAuthHttpProvider } from "./provider";
import { SupabaseGoogleConnectionRepository } from "./repository";
import { createGoogleConnectionService } from "./service";
import { TokenVault } from "./token-vault";

export function createServerGoogleConnectionService() {
  const config = loadGoogleConnectionConfig();
  if (!config.enabled) {
    throw new GoogleConnectionError("GOOGLE_CONNECTIONS_DISABLED", { status: 503 });
  }
  return createGoogleConnectionService({
    repository: new SupabaseGoogleConnectionRepository(createServerClient()),
    provider: new GoogleOAuthHttpProvider({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    }),
    vault: TokenVault.fromBase64Keys(config.activeKeyVersion, config.tokenKeys),
    cookieSecret: config.cookieSecret,
  });
}
