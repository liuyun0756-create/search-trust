import { createServerClient } from "@/lib/supabase";
import { createServerGoogleConnectionRepository, createServerGoogleConnectionService } from "../google-connections";
import { GoogleResourceHttpProvider } from "./provider";
import { createResourceService, SupabaseResourceRepository } from "./service";

export function createServerResourceService() {
  const tokens = createServerGoogleConnectionService(); // Enforces the shared feature flag and configuration.
  return createResourceService({ tokens, connections: createServerGoogleConnectionRepository(),
    repository: new SupabaseResourceRepository(createServerClient()), provider: new GoogleResourceHttpProvider() });
}
