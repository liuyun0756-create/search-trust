import { isDecisionWorkspaceEnabled } from "../review-decisions/config";
import { isReviewDeliveryEnabled } from "../review-reports/config";
export const isReviewGenerationEnabled = () =>
  isDecisionWorkspaceEnabled() &&
  isReviewDeliveryEnabled() &&
  process.env.V22_REVIEW_GENERATION_ENABLED === "true";
