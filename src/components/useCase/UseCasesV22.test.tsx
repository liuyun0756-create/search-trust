// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UseCasesV22 } from "./UseCasesV22";

beforeEach(() => window.history.replaceState(null, "", "/use-cases"));

describe("Client Scenarios workbench", () => {
  it("starts with the first story and keeps the full content and links available", () => {
    const { container } = render(<UseCasesV22 />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "From the first pitch to the next client review.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Find your situation/ }),
    ).toHaveAttribute("href", "#practice-scenarios");
    expect(
      screen.getByRole("link", { name: /Read the sample reports/ }),
    ).toHaveAttribute("href", "/sample-report");
    expect(screen.getByRole("region", { name: "Two report outcomes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Findings you can explain." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Actions with the next steps included." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "A report you can review and share." })).toBeVisible();
    expect(screen.queryByText("The division of work")).toBeNull();
    expect(
      container.querySelectorAll("[data-testid^='practice-scene-']"),
    ).toHaveLength(15);
    const stageTabs = within(
      screen.getByRole("tablist", { name: "Choose a stage of work" }),
    ).getAllByRole("tab");
    expect(stageTabs).toHaveLength(2);
    expect(stageTabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tablist", { name: /situations$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Only a website/ })).toBeNull();
    const first = container.querySelector("#practice-first-conversation");
    expect(first).toHaveAttribute("aria-hidden", "false");
    expect(first).not.toHaveAttribute("inert");
    expect(
      container.querySelector("#practice-competitor-question"),
    ).toHaveAttribute("inert");
    expect(
      within(first as HTMLElement).getByText(
        "An emergency-appointment question",
      ),
    ).toBeVisible();
    expect(
      within(first as HTMLElement).getByText("Only a website"),
    ).toBeVisible();
    expect(
      within(first as HTMLElement).getByText("A · First conversations"),
    ).toBeVisible();
    expect(
      within(first as HTMLElement).getByText(
        /does not establish lost bookings/,
      ),
    ).toBeVisible();
    expect(
      within(first as HTMLElement).getByRole("link", {
        name: /Start a Prospect Case/,
      }),
    ).toHaveAttribute("href", "/cases/new");
    expect(
      screen.getByText(/Fictional situations, not customer testimonials/),
    ).toBeVisible();
  });

  it("swipes one continuous set per stage and remembers each stage's card", async () => {
    const user = userEvent.setup();
    const { container } = render(<UseCasesV22 />);
    const stageTabs = within(
      screen.getByRole("tablist", { name: "Choose a stage of work" }),
    ).getAllByRole("tab");
    stageTabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(stageTabs[1]).toHaveFocus();
    expect(stageTabs[1]).toHaveAttribute("aria-selected", "true");
    await user.click(
      screen.getByRole("button", { name: "Next Deliver the work situation" }),
    );
    expect(
      container.querySelector("#practice-execution-brief"),
    ).toHaveAttribute("aria-hidden", "false");
    expect(window.location.hash).toBe("#practice-execution-brief");
    await user.click(stageTabs[0]);
    for (let index = 0; index < 3; index++) {
      await user.click(
        screen.getByRole("button", { name: "Next Win the work situation" }),
      );
    }
    expect(container.querySelector("#practice-limited-budget")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    expect(
      within(
        container.querySelector("#practice-limited-budget") as HTMLElement,
      ).getByText("B · Scope the engagement"),
    ).toBeVisible();
    await user.click(stageTabs[1]);
    expect(
      container.querySelector("#practice-execution-brief"),
    ).toHaveAttribute("aria-hidden", "false");
    expect(
      screen.getByRole("button", {
        name: "Previous Deliver the work situation",
      }),
    ).toBeEnabled();
  });
});
