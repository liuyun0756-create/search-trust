import { getCurrentUser } from "@/lib/auth";
import {
  createGoogleConnectionCollectionHandlers,
} from "@/lib/google-connections/handlers";
import { createServerGoogleConnectionService } from "@/lib/google-connections";

const handlers = createGoogleConnectionCollectionHandlers({
  getCurrentUser,
  createService: createServerGoogleConnectionService,
  getBaseUrl: () => process.env.NEXT_PUBLIC_BASE_URL ?? "",
});

export const GET = handlers.GET;
