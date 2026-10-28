import { getCurrentUser } from "@/lib/auth";
import { isReviewWorkspaceEnabled } from "@/lib/review-workspace/config";
import { createReviewWorkspaceHandlers } from "@/lib/review-workspace/handler";
export const dynamic = "force-dynamic";
export const { GET, POST } = createReviewWorkspaceHandlers({
  enabled: isReviewWorkspaceEnabled,
  user: getCurrentUser,
  config: () =>
    process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
      ? {
          baseUrl: process.env.V22_API_BASE_URL,
          token: process.env.V22_INTERNAL_API_TOKEN,
        }
      : null,
});
