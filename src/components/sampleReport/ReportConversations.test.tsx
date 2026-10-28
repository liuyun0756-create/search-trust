// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportConversations } from "./ReportConversations";
import { reportConversations } from "./report-conversation-content";
import { deliverables } from "./deliverable-content";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("report-backed client conversations", () => {
  it("shows all three first exchanges and concrete report excerpts without interaction", () => {
    const { container } = render(<ReportConversations />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    for (const item of reportConversations) {
      const card = within(screen.getByRole("article", { name: item.title }));
      expect(card.getByText(item.question)).toBeVisible();
      expect(card.getByText(item.answer)).toBeVisible();
      const excerpt = within(
        card.getByRole("region", { name: `${item.title} report excerpt` }),
      );
      expect(
        excerpt.getByRole("heading", { name: item.documentTitle }),
      ).toBeVisible();
      for (const row of item.rows)
        expect(excerpt.getByText(row.text)).toBeVisible();
      expect(excerpt.getByText(item.note, { exact: false })).toBeVisible();
      expect(card.getByRole("button", { name: item.followUp })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(card.getByText(item.reply)).not.toBeVisible();
    }
    expect(container.querySelector("input, textarea, form")).toBeNull();
    const scope = within(
      screen.getByRole("article", { name: "What am I paying for?" }),
    );
    for (const action of deliverables.verified.actions)
      expect(scope.getByText(action.title, { exact: false })).toBeVisible();
  });
  it("keeps follow-ups independent, supports keyboard activation and never leaves the conversation", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<ReportConversations />);
    const hash = window.location.hash;
    const [first, second] = reportConversations;
    const button = screen.getByRole("button", { name: first.followUp });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(first.reply)).toBeVisible();
    await user.click(screen.getByRole("button", { name: second.followUp }));
    expect(screen.getByText(first.reply)).toBeVisible();
    expect(screen.getByText(second.reply)).toBeVisible();
    await user.click(button);
    expect(screen.getByText(first.reply)).not.toBeVisible();
    expect(screen.getByText(second.reply)).toBeVisible();
    expect(window.location.hash).toBe(hash);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
});
