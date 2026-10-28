import { afterEach, expect, it, vi } from "vitest";
import { isMultiRoundReviewsEnabled } from "./multi-round-config";
const names = [
  "V22_CAPABILITY_DISPATCH_ENABLED",
  "V22_IMPLEMENTATION_RECORDS_ENABLED",
  "V22_REVIEW_EVIDENCE_WORKSPACE_ENABLED",
  "V22_REVIEW_DECISIONS_WORKSPACE_ENABLED",
  "V22_REVIEW_DELIVERY_ENABLED",
  "V22_REVIEW_GENERATION_ENABLED",
  "V22_MULTI_ROUND_REVIEWS_ENABLED",
];
afterEach(() => vi.unstubAllEnvs());
it.each(names)("requires %s as well as the rest of the flow", (name) => {
  for (const n of names) vi.stubEnv(n, "true");
  expect(isMultiRoundReviewsEnabled()).toBe(true);
  vi.stubEnv(name, "false");
  expect(isMultiRoundReviewsEnabled()).toBe(false);
});
