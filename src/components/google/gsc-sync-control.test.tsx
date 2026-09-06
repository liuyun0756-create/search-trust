import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GscSyncControl } from "./gsc-sync-control";

describe("GSC sync control", () => {
  it("requires confirmed identity and explains the request boundary", () => {
    const html = renderToStaticMarkup(<GscSyncControl caseId="case" bindingId="binding" identityMatched={false} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("before syncing");
    expect(html).toContain("No report or purchase is started");
  });
  it("shows an explicit sync action without starting collection during rendering", () => {
    const html = renderToStaticMarkup(<GscSyncControl caseId="case" bindingId="binding" identityMatched />);
    expect(html).toContain("Sync GSC data");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("in progress");
  });
});
