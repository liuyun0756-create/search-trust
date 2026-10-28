// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clientWorkExample } from "./client-work-example";
import { ReadyToUseWork } from "./ReadyToUseWork";
import { ReportOutcomePreviews } from "./ReportOutcomePreviews";

beforeEach(() => window.history.replaceState(null, "", "/use-cases"));

describe("Client work previews", () => {
  it("shows two concrete reports without leaking verified data into the prospect card", () => {
    const { container } = render(
      <ReportOutcomePreviews example={clientWorkExample} />,
    );
    const reports = container.querySelectorAll("article");
    expect(reports).toHaveLength(2);
    expect(within(reports[0] as HTMLElement).getByText(/Fast, reliable cooling solutions/)).toBeVisible();
    expect(within(reports[0] as HTMLElement).getByText(/One question for the first call/)).toBeVisible();
    expect(reports[0].textContent).not.toMatch(/12,400|310 clicks|Search Console/);
    expect(within(reports[1] as HTMLElement).getByText(/12,400 impressions and 310 clicks/)).toBeVisible();
    expect(within(reports[1] as HTMLElement).getByText(/Aug 31–Sep 27, 2026/)).toBeVisible();
    expect(within(reports[0] as HTMLElement).getByRole("link", { name: /Explore prospect situations/ })).toHaveAttribute("href", "#practice-first-conversation");
    expect(within(reports[1] as HTMLElement).getByRole("link", { name: /Explore ongoing client work/ })).toHaveAttribute("href", "#practice-revisit-recommendation");
  });

  it("shows full evidence, action steps and client copy by default", () => {
    const { container } = render(<ReadyToUseWork example={clientWorkExample} />);
    for (const id of ["E01", "E02", "E03", "E04", "E05"])
      expect(screen.getByText(id)).toBeVisible();
    expect(screen.getByText("oakvalecooling.example/ac-repair/")).toBeVisible();
    expect(screen.getAllByText(/12,400 impressions · 310 clicks · 2.5% CTR/)).toHaveLength(2);
    expect(screen.getByText("Make the opening specific.")).toBeVisible();
    expect(screen.getByText("Check the mobile path.")).toBeVisible();
    expect(screen.getByText(/booking action reaches the intended form/)).toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "Client view" })).toBeVisible();
    expect(screen.getByText(/Whether qualified enquiries improve requires follow-up evidence/)).toBeVisible();
    expect(screen.getByRole("link", { name: /View the complete sample reports/ })).toHaveAttribute("href", "/sample-report");
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /export|send|approve|save/i })).toBeNull();
  });

  it("switches delivery audience with keyboard, preserving the URL and story controls", async () => {
    const user = userEvent.setup();
    render(<ReadyToUseWork example={clientWorkExample} />);
    const tabs = within(screen.getByRole("tablist", { name: "Report delivery audience" })).getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "SEO view" })).toBeVisible();
    expect(within(screen.getByRole("tabpanel", { name: "SEO view" })).getByText(/12,400 impressions · 310 clicks · 2.5% CTR/)).toBeVisible();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tabs[1]).toHaveFocus();
    await user.click(tabs[0]);
    expect(screen.getByRole("tabpanel", { name: "Client view" })).toBeVisible();
    expect(window.location.pathname).toBe("/use-cases");
    expect(window.location.hash).toBe("");
  });
});
