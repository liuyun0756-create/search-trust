// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { E2E_IDS } from "../../../e2e/fixtures/ids";
import { E2E_MARKET, preflightFixture } from "../../../e2e/fixtures/preflight";
import { BusinessMatchStep } from "./business-match-step";

describe("BusinessMatchStep interactions", () => {
  it("preserves a submitted GBP link when automatic identity discovery is incomplete", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={{ ...preflightFixture, identity_candidates: [] }}
        submittedGbpUrl={E2E_IDS.gbpUrl}
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    expect(screen.getByText("Profile link provided — verification pending")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Business name"), "SearchTrust E2E Plumbing");
    await user.click(screen.getByRole("button", { name: /Confirm & find competitors/ }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      business_identity: expect.objectContaining({
        public_gbp_url: E2E_IDS.gbpUrl,
        primary_location: E2E_MARKET,
      }),
    }));
  });

  it("prefers the profile URL returned by public identity discovery", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={preflightFixture}
        submittedGbpUrl="https://maps.google.com/submitted"
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Confirm & find competitors/ }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      business_identity: expect.objectContaining({ public_gbp_url: E2E_IDS.gbpUrl }),
    }));
  });
});
