import { getCurrentUser } from "@/lib/auth";
import { isDecisionWorkspaceEnabled } from "@/lib/review-decisions/config";
import { createDecisionHandlers } from "@/lib/review-decisions/handler";
export const dynamic = "force-dynamic";
export const { GET, POST } = createDecisionHandlers({
  enabled: isDecisionWorkspaceEnabled,
  user: getCurrentUser,
  config: () =>
    process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
      ? {
          baseUrl: process.env.V22_API_BASE_URL,
          token: process.env.V22_INTERNAL_API_TOKEN,
        }
      : null,
});
