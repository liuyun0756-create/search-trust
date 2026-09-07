import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { loadGoogleConnectionConfig } from "@/lib/google-connections/config";
import { createGa4SyncHandlers } from "@/lib/google-sync/ga4-handlers";
import { createGa4SyncService } from "@/lib/google-sync/ga4-service";

export const runtime = "nodejs";
export const maxDuration = 30;
const handlers = createGa4SyncHandlers({ user: getCurrentUser,
  enabled: () => process.env.GOOGLE_GA4_SYNC_ENABLED === "true" && loadGoogleConnectionConfig().enabled,
  service: () => createGa4SyncService(createServerClient()),
});
export const GET = handlers.GET;
export const POST = handlers.POST;
