import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GoogleResourceSelector } from "./google-resource-selector";

describe("Google resource selector", () => {
  it("uses public GBP coverage without requiring an owner account by default", () => {
    const html = renderToStaticMarkup(
      <GoogleResourceSelector caseId="case" businessName="Example Plumbing" siteUrl="https://example.test" />,
    );

    expect(html).toContain("Public Business Profile evidence is already included");
    expect(html).toContain("No Business Profile owner account or OAuth connection is required");
    expect(html).toContain("Verified Core");
    expect(html).not.toContain('<option value="gbp">');
  });

  it("shows official GBP as an optional source only when its connector is enabled", () => {
    const html = renderToStaticMarkup(
      <GoogleResourceSelector
        caseId="case"
        businessName="Example Plumbing"
        siteUrl="https://example.test"
        gbpSyncEnabled
      />,
    );

    expect(html).toContain('<option value="gbp">Business Profile</option>');
    expect(html).not.toContain("Public Business Profile evidence is already included");
  });
});
