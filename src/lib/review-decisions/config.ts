import { isReviewWorkspaceEnabled } from "../review-workspace/config";
export const isDecisionWorkspaceEnabled = () =>
  isReviewWorkspaceEnabled() &&
  process.env.V22_REVIEW_DECISIONS_WORKSPACE_ENABLED === "true";
