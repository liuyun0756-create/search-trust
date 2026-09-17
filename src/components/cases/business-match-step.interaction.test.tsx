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
    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));

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

    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      business_identity: expect.objectContaining({ public_gbp_url: E2E_IDS.gbpUrl }),
    }));
  });

  it("restores the last confirmed scope and clears stale coordinates when the market label changes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={preflightFixture}
        submittedGbpUrl={E2E_IDS.gbpUrl}
        initialConfirmation={{
          business_identity: {
            ...preflightFixture.identity_candidates[0].business,
            business_name: "SearchTrust",
          },
          primary_service: "Local SEO audit software",
          target_market: E2E_MARKET,
        }}
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Business name")).toHaveValue("SearchTrust");
    expect(screen.getByLabelText("Primary service")).toHaveValue("Local SEO audit software");
    await user.clear(screen.getByLabelText("Target market"));
    await user.type(screen.getByLabelText("Target market"), "Brooklyn, NY");
    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      target_market: {
        display_name: "Brooklyn, NY",
        country_code: "US",
        region: null,
        city: null,
        postal_code: null,
        latitude: null,
        longitude: null,
      },
    }));
  });
});
