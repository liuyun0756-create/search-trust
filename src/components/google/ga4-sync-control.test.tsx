import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Ga4SyncControl } from "./ga4-sync-control";

describe("GA4 sync control", () => {
  it("requires confirmed identity and explains the request boundary", () => {
    const html = renderToStaticMarkup(<Ga4SyncControl caseId="case" bindingId="binding" identityMatched={false} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("before syncing");
    expect(html).toContain("No report or purchase is started");
  });
  it("shows an explicit site-filtered action without starting collection while rendering", () => {
    const html = renderToStaticMarkup(<Ga4SyncControl caseId="case" bindingId="binding" identityMatched />);
    expect(html).toContain("Sync GA4 data");
    expect(html).toContain("site-filtered");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("in progress");
  });
});
