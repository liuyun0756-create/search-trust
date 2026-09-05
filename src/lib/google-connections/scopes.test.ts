import { describe, expect, it } from "vitest";

import {
  GOOGLE_IDENTITY_SCOPES,
  GoogleSourceInputError,
  coveredGoogleSources,
  parseGoogleSources,
  requiredGoogleScopes,
  sourceHasRequiredScopes,
} from "./scopes";

describe("Google connection scope catalog", () => {
  it("forces identity and produces deterministic scopes for approved sources", () => {
    expect(requiredGoogleScopes(["gbp", "gsc", "gsc"])).toEqual([
      ...GOOGLE_IDENTITY_SCOPES,
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/business.manage",
    ]);
    expect(requiredGoogleScopes(["gsc", "gbp"])).toEqual(requiredGoogleScopes(["gbp", "gsc"]));
  });

  it("rejects empty, unknown, and malformed source collections", () => {
    for (const input of [[], ["drive"], "gsc", ["gsc", 1], ["gsc", "ga4", "gbp", "gsc"]]) {
      expect(() => parseGoogleSources(input)).toThrow(GoogleSourceInputError);
    }
  });

  it("normalizes approved source input without duplicates", () => {
    expect(parseGoogleSources(["gbp", "gsc", "gbp"])).toEqual(["gsc", "gbp"]);
  });

  it("derives coverage only from actually granted scopes", () => {
    const granted = [
      ...GOOGLE_IDENTITY_SCOPES,
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/business.manage",
    ];
    expect(coveredGoogleSources(granted)).toEqual(["ga4", "gbp"]);
    expect(sourceHasRequiredScopes("gsc", granted)).toBe(false);
    expect(sourceHasRequiredScopes("ga4", granted)).toBe(true);
  });

  it("requires every identity scope before reporting any source as covered", () => {
    expect(coveredGoogleSources([
      "openid",
      "email",
      "https://www.googleapis.com/auth/analytics.readonly",
    ])).toEqual([]);
  });
});
