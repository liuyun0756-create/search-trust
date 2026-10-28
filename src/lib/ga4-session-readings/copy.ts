import type {Ga4SessionReading} from "./types";
export const sessionReason: Record<Ga4SessionReading["reasons"][number], string> = {
  TRUNCATION_NOT_CAPTURED: "This older observation does not include the required truncation metadata.",
  WINDOW_NOT_ELAPSED: "The after period had not finished when collection began.",
  TOTAL_NOT_RETURNED: "A period total was not returned. An absent total is not treated as zero.",
  DATES_NOT_RETURNED: "Some requested dates were not returned. Missing rows are not treated as zero.",
  SAMPLED: "Sampling was reported for a required view.",
  THRESHOLDED: "A required view was subject to thresholding.",
  OTHER_ROW_LOSS: "Other-row aggregation affected a required view.",
  EMPTY_REASON: "GA4 supplied an empty-result reason for a required view.",
  TRUNCATED: "Data truncation was reported for a required view.",
  SESSIONS_RESTRICTED: "Access to the sessions metric was restricted in a required view.",
};
