import { isReviewGenerationEnabled } from "./config";
export const isMultiRoundReviewsEnabled = () =>
  isReviewGenerationEnabled() &&
  process.env.V22_MULTI_ROUND_REVIEWS_ENABLED === "true";
