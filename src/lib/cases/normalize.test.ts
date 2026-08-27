import { describe, expect, it } from "vitest";

import { CaseApiError } from "./errors";
import {
  caseLocationKey,
  parseCaseId,
  parseCaseListQuery,
  parseCreateCaseInput,
  parseUpdateCaseInput,
} from "./normalize";

const validCreateRequest = {
  site_url: " https://www.Example.com/services/?utm_source=test#top ",
  business_name: "  Example   Dental  ",
  operating_model: "storefront",
  primary_service: " Emergency   dentist ",
  primary_location: {
    display_name: " Austin,   TX ",
    country_code: " us ",
    region: " Texas ",
    city: " Austin ",
    postal_code: " 78701 ",
    latitude: 30.2672,
    longitude: -97.7431,
  },
  target_market: {
    display_name: "Austin, TX",
    country_code: "us",
  },
  public_gbp_url: "https://maps.google.com/?cid=123#details",
} as const;

function expectCaseError(operation: () => unknown, code = "INVALID_REQUEST") {
  try {
    operation();
    throw new Error("Expected CaseApiError.");
  } catch (error) {
    expect(error).toBeInstanceOf(CaseApiError);
    expect((error as CaseApiError).code).toBe(code);
  }
}

describe("Case request normalization", () => {
  it("normalizes a valid create request and constructs a consistent identity", () => {
    const input = parseCreateCaseInput(validCreateRequest);

    expect(input.site_url).toBe("https://www.example.com/services");
    expect(input.normalized_domain).toBe("example.com");
    expect(input.business_name).toBe("Example Dental");
    expect(input.primary_service).toBe("Emergency dentist");
    expect(input.primary_location).toEqual({
      display_name: "Austin, TX",
      country_code: "US",
      region: "Texas",
      city: "Austin",
      postal_code: "78701",
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(input.target_market).toEqual({
      display_name: "Austin, TX",
      country_code: "US",
      region: null,
      city: null,
      postal_code: null,
      latitude: null,
      longitude: null,
    });
    expect(input.location_key).toBe("geo:30.267200:-97.743100");
    expect(input.public_gbp_url).toBe("https://maps.google.com/?cid=123");
    expect(input.business_identity).toEqual({
      business_name: "Example Dental",
      site_url: "https://www.example.com/services",
      normalized_domain: "example.com",
      operating_model: "storefront",
      primary_location: input.primary_location,
      public_gbp_url: "https://maps.google.com/?cid=123",
    });
  });

  it("creates a stable place key when coordinates are absent", () => {
    const input = parseCreateCaseInput({
      ...validCreateRequest,
      primary_location: {
        display_name: " Austin,  TX ",
        country_code: "US",
        region: " Texas ",
        city: " Austin ",
        postal_code: null,
      },
    });
    expect(caseLocationKey(input.primary_location)).toBe("place:us|texas|austin||austin, tx");
  });

  it("requires coordinates to be provided as a pair", () => {
    expectCaseError(() => parseCreateCaseInput({
      ...validCreateRequest,
      primary_location: {
        ...validCreateRequest.primary_location,
        longitude: null,
      },
    }));
  });

  it.each([
    "http://localhost/",
    "http://service.local/",
    "http://127.0.0.1/",
    "http://10.0.0.2/",
    "http://169.254.1.2/",
    "http://[::1]/",
    "ftp://example.com/",
    "https://user:password@example.com/",
  ])("rejects unsafe site URL %s", (siteUrl) => {
    expectCaseError(() => parseCreateCaseInput({ ...validCreateRequest, site_url: siteUrl }));
  });

  it("rejects unknown and server-owned create fields", () => {
    expectCaseError(() => parseCreateCaseInput({
      ...validCreateRequest,
      user_id: "00000000-0000-4000-8000-000000000001",
      normalized_domain: "example.com",
    }));
  });

  it("rejects an empty PATCH, immutable fields, and mixed restore", () => {
    expectCaseError(() => parseUpdateCaseInput({}));
    expectCaseError(() => parseUpdateCaseInput({ site_url: "https://other.example.com" }));
    expectCaseError(() => parseUpdateCaseInput({ status: "active", business_name: "New Name" }));
  });

  it("normalizes a valid confirmation PATCH", () => {
    expect(parseUpdateCaseInput({
      business_name: " New   Name ",
      public_gbp_url: null,
    })).toEqual({ business_name: "New Name", public_gbp_url: null });
  });

  it("validates list query parameters and Case IDs", () => {
    expect(parseCaseListQuery(new URLSearchParams())).toEqual({
      status: "active",
      limit: 20,
      offset: 0,
    });
    expect(parseCaseListQuery(new URLSearchParams("status=all&limit=100&offset=20"))).toEqual({
      status: "all",
      limit: 100,
      offset: 20,
    });
    expectCaseError(() => parseCaseListQuery(new URLSearchParams("limit=0&unknown=x")));
    expect(parseCaseId("00000000-0000-4000-8000-000000000001"))
      .toBe("00000000-0000-4000-8000-000000000001");
    expectCaseError(() => parseCaseId("not-a-uuid"));
  });
});
