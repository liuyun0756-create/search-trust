import { describe, expect, it } from "vitest";
import { ga4HostsForCase } from "./ga4-hosts";

describe("GA4 Case hostname scope", () => {
  it.each([
    ["https://example.com/", "example.com", ["example.com", "www.example.com"]],
    ["https://www.example.co.uk/path", "example.co.uk", ["example.co.uk", "www.example.co.uk"]],
    ["https://shop.example.co.uk/", "shop.example.co.uk", ["shop.example.co.uk"]],
  ])("recognizes registrable apex/www without widening subdomains", (url, domain, expected) => {
    expect(ga4HostsForCase(url, domain)).toEqual(expected);
  });
  it.each([
    ["https://other.example.com/", "example.com"], ["https://127.0.0.1/", "127.0.0.1"],
    ["https://user:pass@example.com/", "example.com"], ["https://example.com:8443/", "example.com"],
    ["not a url", "example.com"],
  ])("rejects invalid or inconsistent Case identities", (url, domain) => {
    expect(() => ga4HostsForCase(url, domain)).toThrow("INVALID_CASE_HOST");
  });
});
