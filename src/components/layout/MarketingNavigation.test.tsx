// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("link", { name: "SearchTrust home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Start with 5 free credits" })).toBeVisible();
  });

  it("opens the mobile menu and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });

    await user.click(toggle);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });

  it("renders only valid product, account and legal footer destinations", () => {
    render(<CTABanner />);

    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeVisible();
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
