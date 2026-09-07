import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { loadGoogleConnectionConfig } from "@/lib/google-connections/config";
import { createGbpSyncHandlers } from "@/lib/google-sync/gbp-handlers";
import { createGbpSyncService } from "@/lib/google-sync/gbp-service";

export const runtime = "nodejs";
export const maxDuration = 30;
const handlers = createGbpSyncHandlers({
  user: getCurrentUser,
  enabled: () => process.env.GOOGLE_GBP_SYNC_ENABLED === "true" && loadGoogleConnectionConfig().enabled,
  service: () => createGbpSyncService(createServerClient()),
});
export const GET = handlers.GET;
export const POST = handlers.POST;
