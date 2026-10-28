// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryShowcase } from "./DeliveryShowcase";
import { deliverables } from "./deliverable-content";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("client delivery showcase", () => {
  it("shows a non-editable adaptation with before/after comparison and unchanged evidence", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const { container } = render(<DeliveryShowcase />);
    expect(screen.getByRole("tab", { name: /Adapt the plan/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "delivery-panel-0",
    );
    expect(
      container.querySelector("input, textarea, form, [contenteditable] "),
    ).toBeNull();
    const paper = within(
      screen.getByRole("article", { name: "Action adaptation illustration" }),
    );
    expect(paper.getByText(/Start with client-approved/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Proposed plan" }));
    expect(
      paper.getByText("Clarify the existing repair-service page."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "SEO adaptation" }));
    expect(paper.getByText(/Start with client-approved/)).toBeVisible();
    expect(
      paper.getByText(/Evidence and source limits · unchanged/),
    ).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
  it("supports keyboard navigation and shows three actions, client input and limits before delivery", async () => {
    const user = userEvent.setup();
    render(<DeliveryShowcase />);
    screen.getByRole("tab", { name: /Adapt the plan/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Review delivery/ })).toHaveFocus();
    const paper = within(
      screen.getByRole("article", { name: "Client report illustration" }),
    );
    for (const action of deliverables.verified.actions)
      expect(paper.getByText(action.title)).toBeVisible();
    expect(paper.getByText(/They do not prove/)).toBeVisible();
    expect(paper.getByText(/Confirm service details/)).toBeVisible();
    expect(screen.getByText(/Later edits do not update PDFs/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /save|approve|send/i }),
    ).not.toBeInTheDocument();
    await user.keyboard("{End}");
    expect(
      screen.getByRole("tab", { name: /Add your identity/ }),
    ).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /Adapt the plan/ })).toHaveFocus();
  });
  it("compares export identity without implying full white-label or persistent share branding", async () => {
    const user = userEvent.setup();
    render(<DeliveryShowcase />);
    await user.click(screen.getByRole("tab", { name: /Add your identity/ }));
    const cover = within(
      screen.getByRole("article", { name: "PDF identity illustration" }),
    );
    expect(cover.getByText("Northline · Independent SEO")).toBeVisible();
    expect(cover.getByText("SearchTrust")).toBeVisible();
    expect(
      screen.getByText(/is not saved and does not apply to online share links/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Default cover" }));
    expect(
      cover.queryByText("Northline · Independent SEO"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "With your identity" }),
    );
    expect(cover.getByText("Northline · Independent SEO")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Start a Prospect Case" }),
    ).toHaveAttribute("href", "/cases/new");
    expect(
      screen.getByRole("link", { name: "Continue with a client Case" }),
    ).toHaveAttribute("href", "/cases/service");
  });
});
