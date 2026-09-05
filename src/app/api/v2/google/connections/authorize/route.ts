import { getCurrentUser } from "@/lib/auth";
import { createServerGoogleConnectionService } from "@/lib/google-connections";
import { createGoogleConnectionCollectionHandlers } from "@/lib/google-connections/handlers";

const handlers = createGoogleConnectionCollectionHandlers({
  getCurrentUser,
  createService: createServerGoogleConnectionService,
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL ?? "",
});

export const POST = handlers.POST;
