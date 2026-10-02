// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodPractice } from "./MethodPractice";
import { practiceCases, practiceSteps } from "./practice-case-data";

afterEach(() => vi.restoreAllMocks());
const openRecord = () => fireEvent.click(screen.getByText("Inspect all seven reasoning steps"));

describe("methodology case examples", () => {
  it("exposes the first example’s complete seven-part record on request", () => {
    render(<MethodPractice />); openRecord();
    const choices = within(screen.getByRole("group", { name: "Choose a method example" })).getAllByRole("button");
    expect(choices).toHaveLength(3);
    expect(choices.map((choice) => choice.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    const article = within(screen.getByRole("article"));
    expect(article.getByRole("heading", { level: 3 })).toHaveTextContent(practiceCases[0].title);
    for (const step of practiceSteps) expect(article.getByRole("heading", { name: new RegExp(step.label), level: 4 })).toBeVisible();
    expect(article.getByText("Method example · Not a real client result")).toBeVisible();
  });

  it("keeps every navigation link tied to a visible, offset destination", () => {
    const { container } = render(<MethodPractice />); openRecord();
    const path = screen.getByRole("navigation", { name: "Methodology reading path" });
    expect(within(path).getAllByRole("link")).toHaveLength(6);
    const nav = screen.getByRole("navigation", { name: "Case reading steps" });
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    for (const anchor of container.querySelectorAll('a[href^="#"]')) {
      const target = container.querySelector(anchor.getAttribute("href")!);
      expect(target).toBeVisible();
      expect(target).toHaveClass("scroll-mt-28");
    }
    expect(screen.getByRole("link", { name: "View a method example" })).toHaveAttribute("href", "#practice-case-detail");
    expect(screen.queryByRole("link", { name: /full case study/i })).not.toBeInTheDocument();
  });

  it("switches the complete case without retaining another case's content", async () => {
    const user = userEvent.setup(); const { container } = render(<MethodPractice />); openRecord();
    for (const example of practiceCases) {
      await user.click(screen.getByRole("button", { name: example.title }));
      expect(screen.getByRole("article")).toHaveTextContent(example.conditionalConclusion);
      expect(screen.getByRole("article")).toHaveTextContent(example.value);
      expect(screen.getByRole("status")).toHaveTextContent(example.title);
      expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
      for (const other of practiceCases.filter((item) => item.id !== example.id)) expect(screen.queryByText(other.conditionalConclusion)).not.toBeInTheDocument();
      const ids = Array.from(container.querySelectorAll("[id]")).map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("allows keyboard case selection and retains focus on the selected button", async () => {
    const user = userEvent.setup(); render(<MethodPractice />); openRecord();
    const choice = screen.getByRole("button", { name: practiceCases[1].title });
    choice.focus(); await user.keyboard("{Enter}");
    expect(choice).toHaveAttribute("aria-pressed", "true");
    expect(choice).toHaveFocus();
    expect(screen.getByRole("article")).toHaveTextContent(practiceCases[1].conditionalConclusion);
  });

  it("attaches the correct official source to each public principle", async () => {
    const user = userEvent.setup(); render(<MethodPractice />); openRecord();
    for (const example of practiceCases) {
      await user.click(screen.getByRole("button", { name: example.title }));
      const source = screen.getByRole("link", { name: new RegExp(example.sourceTitle) });
      expect(source).toHaveAttribute("href", example.sourceUrl);
      expect(source).toHaveAttribute("rel", "noopener noreferrer");
      expect(source).toHaveAttribute("target", "_blank");
      expect(screen.getByText(/not a Google endorsement/)).toBeVisible();
    }
  });

  it("distinguishes public principles, judgment, system conditions and manual checks", () => {
    render(<MethodPractice />); openRecord();
    expect(screen.getByText("Analysis conditions illustrated in this method")).toBeVisible();
    expect(screen.getByText("Manual verification")).toBeVisible();
    expect(screen.getByText(/this checklist is not a record of a completed system run/)).toBeVisible();
    expect(screen.getByText(/not a named practitioner’s project record/)).toBeVisible();
    expect(screen.getByText(/L1–L8 is one page-diagnosis tool/)).toBeVisible();
  });

  it("expands evidence, implementation and comparison records independently", async () => {
    const user = userEvent.setup(); const { container } = render(<MethodPractice />); openRecord();
    for (const title of ["View original evidence", "View implementation records", "View result comparison"]) {
      const summary = screen.getByText(title);
      expect(summary.closest("details")).not.toHaveAttribute("open");
      await user.click(summary);
      expect(summary.closest("details")).toHaveAttribute("open");
    }
    expect(container.querySelectorAll("details[open]")).toHaveLength(4);
    expect(screen.getByText(/No original evidence attached/)).toBeVisible();
    expect(screen.getByText(/No work or implementation date verified/)).toBeVisible();
    expect(screen.getByText(practiceCases[0].context)).toBeVisible();
    await user.click(screen.getByText("View original evidence"));
    expect(container.querySelectorAll("details[open]")).toHaveLength(3);
  });

  it("resets open disclosures when the selected example changes", async () => {
    const user = userEvent.setup(); const { container } = render(<MethodPractice />); openRecord();
    await user.click(screen.getByText("View original evidence"));
    await user.click(screen.getByRole("button", { name: practiceCases[2].title }));
    expect(container.querySelectorAll("details[open]")).toHaveLength(1);
    await user.click(screen.getByText("View original evidence"));
    expect(screen.getByText("Corresponding sources")).toBeVisible();
    expect(screen.queryByText("Page and query scope")).not.toBeInTheDocument();
  });

  it("never fills unavailable before/after values with zero or simulated gains", async () => {
    const user = userEvent.setup(); render(<MethodPractice />); openRecord();
    for (const example of practiceCases) {
      await user.click(screen.getByRole("button", { name: example.title }));
      await user.click(screen.getByText("View result comparison"));
      const values = within(screen.getByRole("group", { name: "Unverified comparison values" }));
      expect(values.getAllByText("Not supplied")).toHaveLength(example.metrics.length * 2);
      expect(values.getAllByText("Not calculable")).toHaveLength(example.metrics.length);
      expect(values.queryByText(/^0(?:\.%|%|\.0)?$/)).not.toBeInTheDocument();
      expect(screen.getByText("Validation not completed")).toBeVisible();
      expect(screen.getByText(/No project conclusion established/)).toBeVisible();
      expect(screen.getByText(/No actual work, target URL or implementation date/)).toBeVisible();
      expect(screen.getByText(/no hours or percentages are claimed/)).toBeVisible();
    }
  });

  it("keeps the local correction and measurement claims appropriately limited", async () => {
    const user = userEvent.setup(); render(<MethodPractice />); openRecord();
    await user.click(screen.getByRole("button", { name: practiceCases[1].title }));
    expect(screen.getByText(/missing on both sides is not a confirmed match/)).toBeVisible();
    expect(screen.getAllByText(/effect on ranking remains a separate question/)[0]).toBeVisible();
    expect(screen.getByText("Repair acceptance")).toBeVisible();
    await user.click(screen.getByRole("button", { name: practiceCases[2].title }));
    expect(screen.getAllByText(/Different click and session totals are expected/)[0]).toBeVisible();
    expect(screen.getAllByText(/More recorded events after a repair do not automatically/)[0]).toBeVisible();
  });

  it("updates the reading position and cleans up its scroll listener", () => {
    let run: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { run = callback; return 1; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = practiceSteps.findIndex((step) => `practice-${step.id}` === this.id);
      return { top: index <= 3 ? 150 : 400 } as DOMRect;
    });
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<MethodPractice />); openRecord();
    act(() => { run?.(0); });
    const nav = within(screen.getByRole("navigation", { name: "Case reading steps" }));
    expect(nav.getByRole("link", { name: /Project evidence/ })).toHaveAttribute("aria-current", "step");
    expect(nav.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("does not call business APIs or persist case interactions", async () => {
    const user = userEvent.setup(); const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<MethodPractice />); openRecord();
    for (const example of practiceCases) {
      await user.click(screen.getByRole("button", { name: example.title }));
      await user.click(screen.getByText("View result comparison"));
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
});
