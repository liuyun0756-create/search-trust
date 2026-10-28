import { isImplementationRecordsEnabled } from "../implementation-records/config";
export const isReviewWorkspaceEnabled = () =>
  isImplementationRecordsEnabled() &&
  process.env.V22_REVIEW_EVIDENCE_WORKSPACE_ENABLED === "true";
