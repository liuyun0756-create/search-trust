import { getCurrentUser } from "@/lib/auth";
import { createServerGoogleConnectionService } from "@/lib/google-connections";
import { createGoogleOAuthCallbackHandler } from "@/lib/google-connections/handlers";

export const GET = createGoogleOAuthCallbackHandler({
  getCurrentUser,
  createService: createServerGoogleConnectionService,
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL ?? "",
});
