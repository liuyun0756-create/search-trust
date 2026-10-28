import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";
import { getCurrentUser } from "@/lib/auth";
import { isReviewGenerationEnabled } from "@/lib/review-intake/config";
import { createReviewIntakeHandlers } from "@/lib/review-intake/handler";
export const dynamic = "force-dynamic";
export const { GET, POST } = createReviewIntakeHandlers({
  enabled: isReviewGenerationEnabled,
  intakeEnabled: isV22PublicEntryEnabled,
  user: getCurrentUser,
  config: () =>
    process.env.V22_API_BASE_URL && process.env.V22_INTERNAL_API_TOKEN
      ? {
          baseUrl: process.env.V22_API_BASE_URL,
          token: process.env.V22_INTERNAL_API_TOKEN,
        }
      : null,
});
