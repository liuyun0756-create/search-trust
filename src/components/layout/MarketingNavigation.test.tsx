// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CTABanner } from "@/components/home/CTABanner";

import { Header } from "./Header";

const navigationState = vi.hoisted(() => ({ pathname: "/pricing" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/client-auth", () => ({ useAppUser: () => ({ isLoaded: true, isSignedIn: false }) }));
vi.mock("@/lib/analytics-client", () => ({ track: vi.fn() }));

afterEach(() => {
  navigationState.pathname = "/pricing";
  vi.restoreAllMocks();
});

describe("marketing navigation consistency", () => {
  it("links the brand home, marks the current page and uses the account credit CTA", () => {
    render(<Header />);

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Home",
      "Method",
      "Sample Reports",
      "Client Scenarios",
      "Pricing",
    ]);
    expect(screen.getByRole("link", { name: "SearchTrust home" })).toHaveAttribute("href", "/");
    const active = within(navigation).getByRole("link", { name: "Pricing" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Start with 5 free credits" })).toBeVisible();
  });

  it("does not mark Home current on a non-navigation page", () => {
    navigationState.pathname = "/cases/service";
    render(<Header />);
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it("opens the mobile menu and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });

    await user.click(toggle);
    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(mobileNavigation).toBeInTheDocument();
    const active = within(mobileNavigation).getByRole("link", { name: "Pricing" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.querySelector('[aria-hidden="true"]')).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });

  it("renders only valid product, account and legal footer destinations", () => {
    render(<CTABanner />);

    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Method" })).toHaveAttribute("href", "/framework");
    expect(screen.getByRole("link", { name: "Sample Reports" })).toHaveAttribute("href", "/sample-report");
    expect(screen.getByRole("link", { name: "Client Scenarios" })).toHaveAttribute("href", "/use-cases");
    expect(screen.getByRole("link", { name: "Refund Policy" })).toHaveAttribute("href", "/refund-policy");
    expect(screen.getByRole("link", { name: "Start a Case" })).toHaveAttribute("href", "/cases/new");
    expect(screen.queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Blog" })).not.toBeInTheDocument();
  });

  it("does not show the marketing footer inside the reports workspace", () => {
    navigationState.pathname = "/reports";
    const { container } = render(<CTABanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the sign-in experience focused by hiding marketing chrome", () => {
    navigationState.pathname = "/sign-in";
    const header = render(<Header />);
    const footer = render(<CTABanner />);

    expect(header.container).toBeEmptyDOMElement();
    expect(footer.container).toBeEmptyDOMElement();
  });
});
