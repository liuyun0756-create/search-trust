import { describe, expect, it } from "vitest";

import { isMissingDiscoveryTaskError, PreflightApiError } from "./errors";

describe("preflight API errors", () => {
  it.each([
    ["JOB_NOT_FOUND", 404],
    ["DISCOVERY_JOB_NOT_FOUND", 404],
    ["UNEXPECTED_NOT_FOUND", 404],
  ])("recognizes a missing discovery task (%s)", (code, status) => {
    expect(isMissingDiscoveryTaskError(new PreflightApiError(code, "Missing.", status))).toBe(true);
  });

  it("does not restart discovery for unrelated failures", () => {
    expect(isMissingDiscoveryTaskError(new PreflightApiError("QUEUE_UNAVAILABLE", "Unavailable.", 503))).toBe(false);
    expect(isMissingDiscoveryTaskError(new Error("boom"))).toBe(false);
  });
});
