// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { E2E_MARKET, preflightFixture } from "../../../e2e/fixtures/preflight";
import { BusinessMatchStep } from "./business-match-step";

const TRACEABLE_GBP_URL = "https://www.google.com/maps?cid=123456789";

describe("BusinessMatchStep interactions", () => {
  it("preserves a submitted GBP link when automatic identity discovery is incomplete", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={{ ...preflightFixture, identity_candidates: [] }}
        submittedGbpUrl={TRACEABLE_GBP_URL}
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Public GBP")).toHaveValue(TRACEABLE_GBP_URL);
    await user.type(screen.getByLabelText("Business name"), "SearchTrust E2E Plumbing");
    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      business_identity: expect.objectContaining({
        public_gbp_url: TRACEABLE_GBP_URL,
        primary_location: E2E_MARKET,
      }),
    }));
  });

  it("prefers the profile URL returned by public identity discovery", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={{
          ...preflightFixture,
          identity_candidates: preflightFixture.identity_candidates.map((candidate) => ({
            ...candidate,
            business: { ...candidate.business, public_gbp_url: TRACEABLE_GBP_URL },
          })),
        }}
        submittedGbpUrl="https://maps.google.com/submitted"
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      business_identity: expect.objectContaining({ public_gbp_url: TRACEABLE_GBP_URL }),
    }));
  });

  it("blocks confirmation until a traceable full Google Maps listing URL is provided", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={{ ...preflightFixture, identity_candidates: [] }}
        submittedGbpUrl="https://maps.app.goo.gl/short-link"
        initialConfirmation={{
          business_identity: { ...preflightFixture.identity_candidates[0].business, public_gbp_url: null },
          primary_service: "Emergency plumbing",
          target_market: E2E_MARKET,
        }}
        onConfirm={onConfirm}
        onEditSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Confirm business scope/ }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("place ID or cid");
  });

  it("restores the last confirmed scope and clears stale coordinates when the market label changes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BusinessMatchStep
        preflight={preflightFixture}
        submittedGbpUrl={TRACEABLE_GBP_URL}
        initialConfirmation={{
          business_identity: {
            ...preflightFixture.identity_candidates[0].business,
            business_name: "SearchTrust",
            public_gbp_url: TRACEABLE_GBP_URL,
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
