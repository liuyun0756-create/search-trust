import { createServerClient } from "../supabase";
import { SupabaseConnectionCenterRepository } from "./repository";
import { createConnectionCenterService } from "./service";

export function createServerConnectionCenterService() {
  return createConnectionCenterService({
    repository: new SupabaseConnectionCenterRepository(createServerClient()),
    flags: {
      gsc_sync_enabled: process.env.GOOGLE_GSC_SYNC_ENABLED === "true",
      ga4_sync_enabled: process.env.GOOGLE_GA4_SYNC_ENABLED === "true",
      official_gbp_sync_enabled: process.env.GOOGLE_GBP_SYNC_ENABLED === "true",
      verified_generation_enabled: process.env.GOOGLE_VERIFIED_ANALYSIS_ENABLED === "true",
    },
  });
}
