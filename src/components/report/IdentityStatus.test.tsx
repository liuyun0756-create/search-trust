// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityStatus } from "./IdentityStatus";
import sample from "@/lib/identity-review/fixtures/synthetic.json";
import type { BusinessIdentityV2, ContactCheck } from "@/lib/report-capability/generated/types";

const saved = sample.workspace.identity as unknown as BusinessIdentityV2;
const savedVariant = (key: keyof typeof sample.variants) => sample.variants[key].identity as unknown as BusinessIdentityV2;
const statusGroup = (label: string) => within(screen.getByText(label, { selector: "dt" }).parentElement!);

afterEach(cleanup);

describe("saved report identity status", () => {
  it.each([
    ["legacy report with no v2 identity", undefined, "No saved match", "Unknown", "Unconfirmed"],
    ["machine matched, unknown mode", saved, "Machine matched", "Unknown", "Unconfirmed"],
    ["unmatched, machine identified", {
      ...saved, identity_match: { ...saved.identity_match, state: "unresolved" },
      operating_model: { ...saved.operating_model, state: "resolved", value: "hybrid" },
    }, "No saved match", "Machine identified · awaiting confirmation", "Unconfirmed"],
    ["manually confirmed hybrid without a visit", savedVariant("hybrid"), "Manually confirmed", "Manually confirmed", "Unconfirmed"],
    ["manually confirmed hybrid and visit", savedVariant("hybrid_visit"), "Manually confirmed", "Manually confirmed", "Confirmed"],
    ["manually confirmed storefront and visit", savedVariant("storefront_visit"), "Manually confirmed", "Manually confirmed", "Confirmed"],
    ["service area", savedVariant("service_area"), "Manually confirmed", "Manually confirmed", "Not applicable"],
    ["meeting point", savedVariant("meeting_point"), "Manually confirmed", "Manually confirmed", "Not applicable"],
  ] as const)("renders the three independent states for %s", (_name, identity, branch, mode, address) => {
    const before = JSON.stringify(identity);
    render(<IdentityStatus identity={identity as BusinessIdentityV2 | undefined} />);
    expect(statusGroup("GBP branch match").getByText(branch, { exact: true })).toBeTruthy();
    expect(statusGroup("Operating model").getByText(mode, { exact: true })).toBeTruthy();
    expect(statusGroup("Customer visits at this address").getByText(address, { exact: true })).toBeTruthy();
    expect(JSON.stringify(identity)).toBe(before);
  });

  it("shows the saved identifiers and match evidence without filling missing checks", () => {
    const checks = sample.workspace.checks as ContactCheck[];
    const { rerender } = render(<IdentityStatus identity={saved} />);
    expect(screen.getByText("CID 12345")).toBeTruthy();
    expect(screen.getByText(/Website domain .* Match detail not saved/)).toBeTruthy();
    expect(screen.getByText("Phone · Match detail not saved")).toBeTruthy();

    rerender(<IdentityStatus identity={{
      ...saved, selected_branch_ref: "Place-example",
      public_gbp_url: "https://maps.google.com/?place_id=Place-example",
      identity_match: { ...saved.identity_match, matched_on: ["domain"] },
    }} checks={checks.map(check => check.field === "phone" ? { ...check, status: "confirmed", result: "match" } : check)} />);
    expect(screen.getByText("Place ID Place-example")).toBeTruthy();
    expect(screen.getByText(/Website domain .* Recorded match/)).toBeTruthy();
    expect(screen.getByText("Phone · Recorded match")).toBeTruthy();
  });
});
