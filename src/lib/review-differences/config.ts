import { isReviewDeliveryEnabled } from "../review-reports/config";
export const isReportDifferencesEnabled = () =>
  isReviewDeliveryEnabled() &&
  process.env.V22_REVIEW_DIFFERENCES_ENABLED === "true";
