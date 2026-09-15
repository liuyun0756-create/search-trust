import { describe, expect, it } from "vitest";

import {
  buildGoogleAnalyticsPageView,
  parseGoogleAnalyticsMeasurementId,
} from "./google-analytics";

describe("Google Analytics configuration", () => {
  it("accepts a GA4 measurement ID and normalizes whitespace and casing", () => {
    expect(parseGoogleAnalyticsMeasurementId("  g-tn34xqs0mf  ")).toBe("G-TN34XQS0MF");
  });

  it("rejects missing and malformed measurement IDs", () => {
    expect(parseGoogleAnalyticsMeasurementId(undefined)).toBeNull();
    expect(parseGoogleAnalyticsMeasurementId("UA-12345-1")).toBeNull();
    expect(parseGoogleAnalyticsMeasurementId("G-bad/value")).toBeNull();
  });

  it("removes query parameters and fragments from page-view locations", () => {
    expect(buildGoogleAnalyticsPageView(
      "https://trysearchtrust.com/ignored?source=server",
      "/cases/case-1/connections?connection_id=private#google",
    )).toEqual({
      page_location: "https://trysearchtrust.com/cases/case-1/connections",
      page_path: "/cases/case-1/connections",
    });
  });

  it("falls back to the root path for an invalid pathname", () => {
    expect(buildGoogleAnalyticsPageView("https://trysearchtrust.com", "not-a-path")).toEqual({
      page_location: "https://trysearchtrust.com/",
      page_path: "/",
    });
  });
});
