import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { loadGoogleConnectionConfig } from "@/lib/google-connections/config";
import { createSyncHandlers } from "@/lib/google-sync/handlers";
import { createSyncService } from "@/lib/google-sync/service";

export const runtime = "nodejs";
export const maxDuration = 30;
const handlers = createSyncHandlers({ user: getCurrentUser,
  enabled: () => process.env.GOOGLE_GSC_SYNC_ENABLED === "true" && loadGoogleConnectionConfig().enabled,
  service: () => createSyncService(createServerClient()),
});
export const GET = handlers.GET;
export const POST = handlers.POST;
