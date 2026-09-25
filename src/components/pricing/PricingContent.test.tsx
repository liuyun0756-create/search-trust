// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BillingDetails } from "./BillingDetails";
import { PricingCTA } from "./PricingCTA";
import { WhatOneCreditStarts } from "./WhatOneCreditStarts";

vi.mock("@/lib/client-auth", () => ({ useAppUser: () => ({ isLoaded: true, isSignedIn: false }) }));
vi.mock("@/components/common/RunAuditButton", () => ({
  RunAuditButton: ({ children, className }: { children: React.ReactNode; className?: string }) => <button className={className}>{children}</button>,
}));
vi.mock("./CreditPurchaseButton", () => ({
  CreditPurchaseButton: ({ children, className }: { children: React.ReactNode; className?: string }) => <button className={className}>{children}</button>,
}));

describe("pricing credit explanation", () => {
  it("shows the complete Case journey with charges only on the two generation steps", () => {
    render(<WhatOneCreditStarts />);
    const journey = screen.getByLabelText("How credits are used through one client Case");

    expect(within(journey).getAllByText("1 credit")).toHaveLength(2);
    expect(within(journey).getAllByText("Free")).toHaveLength(3);
    expect(within(journey).getByRole("heading", { name: "Prospect Analysis" })).toBeVisible();
    expect(within(journey).getByRole("heading", { name: "Verified Action Plan" })).toBeVisible();
  });

  it("explains the two continuous workflows, five-credit mixes and usage boundary", () => {
    render(<WhatOneCreditStarts />);

    expect(screen.getByRole("heading", { name: /win the work, then continue/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /five credits can follow/i })).toBeVisible();
    expect(screen.getByText("5 × Prospect Analysis")).toBeVisible();
    expect(screen.getByText("2 × Verified")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Uses one credit" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Does not use another credit" })).toBeVisible();
    expect(screen.getByText(/do not promise clients, rankings, traffic/i)).toBeVisible();
  });

  it("keeps payment, delivery, failure and refund rules together", () => {
    render(<BillingDetails />);

    expect(screen.getByRole("heading", { name: /simple payment, clear failure protection/i })).toBeVisible();
    for (const label of ["Payment", "Delivery", "Technical failure", "Refund review"]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByRole("link", { name: /full refund policy/i })).toHaveAttribute("href", "/refund-policy");
  });

  it("keeps account creation primary and the additional credit available", () => {
    render(<PricingCTA />);
    expect(screen.getByRole("button", { name: /create account — get 5 credits/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /add 1 credit · \$19/i })).toBeVisible();
  });
});
