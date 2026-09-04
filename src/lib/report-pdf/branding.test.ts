import { describe, expect, it } from "vitest";
import { parsePdfBranding } from "./branding";

describe("parsePdfBranding", () => {
  it("keeps agency branding ephemeral, trimmed, and bounded", () => {
    expect(parsePdfBranding({ agency_name: "  Northstar SEO  ", client_name: "Example" })).toMatchObject({
      enabled: true,
      agencyName: "Northstar SEO",
      clientName: "Example",
    });
    expect(parsePdfBranding({})).toBeUndefined();
  });

  it("rejects executable or unsupported logo data", () => {
    expect(() => parsePdfBranding({ agency_logo_data: "data:image/svg+xml;base64,PHN2Zz4=" })).toThrow("PNG or JPEG");
    expect(() => parsePdfBranding({ agency_logo_data: "data:image/png;base64,not valid" })).toThrow("PNG or JPEG");
  });
});
