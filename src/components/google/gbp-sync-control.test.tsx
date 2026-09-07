import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GbpSyncControl } from "./gbp-sync-control";

describe("GBP sync control", () => {
  it("requires confirmed identity and explains the explicit retention boundary", () => {
    const html = renderToStaticMarkup(<GbpSyncControl caseId="case" bindingId="binding" identityMatched={false} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("before syncing");
    expect(html).toContain("no more than 30 days");
    expect(html).toContain("No report or purchase is started");
  });
  it("shows an explicit location-scoped action without starting collection while rendering", () => {
    const html = renderToStaticMarkup(<GbpSyncControl caseId="case" bindingId="binding" identityMatched />);
    expect(html).toContain("Sync Business Profile data");
    expect(html).toContain("this location");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("in progress");
  });
});
