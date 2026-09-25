import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { E2E_BUSINESS, E2E_MARKET } from "../../../e2e/fixtures/preflight";
import { ProspectStartStep } from "./prospect-start-step";

describe("ProspectStartStep", () => {
  it("shows the confirmed scope, workflow contents and exact credit boundary", () => {
    const html = renderToStaticMarkup(
      <ProspectStartStep
        business={{ business_identity: E2E_BUSINESS, primary_service: "Emergency plumbing", target_market: E2E_MARKET }}
        status="ready"
        message="Ready to begin."
        caseReady
        covered={false}
        creditBalance={5}
        signedIn
        onStart={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    expect(html).toContain("SearchTrust E2E Plumbing");
    expect(html).toContain("Find and qualify real local competitors");
    expect(html).toContain("Technical failure returns the credit");
    expect(html).toContain("Start analysis · uses 1 credit");
  });
});
