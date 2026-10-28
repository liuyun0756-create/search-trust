// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SampleReportsV22 } from "./SampleReportsV22";
import { deliverables, workflows } from "./deliverable-content";

beforeEach(() => {
  window.history.replaceState(null, "", "/sample-report");
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("sample deliverable workflow", () => {
  it("reads complete chapters with navigation, deep links and an optional continuous view", async () => {
    const user = userEvent.setup();
    render(<SampleReportsV22 />);
    const paper = screen.getByRole("article", {
      name: "Prospect Evidence Report document",
    });
    const nav = screen.getByRole("navigation", {
      name: "Prospect Evidence Report chapters",
    });
    expect(within(paper).getAllByRole("region")).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: /Summary/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await user.click(
      within(paper).getByRole("button", {
        name: "Next: Evidence & open questions",
      }),
    );
    expect(window.location.hash).toBe("#sample-prospect-evidence");
    expect(
      within(paper).getByRole("region", { name: "Evidence & open questions" }),
    ).toBeVisible();
    expect(
      within(paper).getByText(deliverables.prospect.evidence[0].pending),
    ).toBeVisible();
    await user.click(
      within(nav).getByRole("link", { name: /Proposed actions/ }),
    );
    for (const action of deliverables.prospect.actions) {
      expect(
        within(paper).getByRole("heading", { name: action.title }),
      ).toBeVisible();
      expect(within(paper).getByText(action.completion)).toBeVisible();
    }
    expect(
      within(paper).queryByText("View action details"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuous" }));
    expect(within(paper).getAllByRole("region")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "By chapter" }));
    expect(within(paper).getAllByRole("region")).toHaveLength(1);
    await act(async () => {
      window.history.replaceState(null, "", "#sample-verified-inputs");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("article", { name: "Verified Action Plan document" }),
    ).toContainElement(screen.getByRole("region", { name: "Client input" }));
    expect(
      screen.getByRole("link", { name: "Review & branding" }).closest("nav"),
    ).toBeNull();
  });
  it("shows all six workflow steps and keeps workflow tabs independent of the report", async () => {
    const user = userEvent.setup();
    render(<SampleReportsV22 />);
    const guide = within(
      screen.getByRole("region", { name: "Client report workflow" }),
    );
    const first = guide.getByRole("tab", { name: "01 Win the work" });
    expect(first).toHaveAttribute("aria-selected", "true");
    for (const [title, description] of workflows.prospect.steps) {
      expect(guide.getByRole("heading", { name: title })).toBeVisible();
      expect(guide.getByText(description)).toBeVisible();
    }
    expect(guide.getByRole("tabpanel").querySelector("details")).toBeNull();
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(
      guide.getByRole("tab", { name: "02 Deliver the work" }),
    ).toHaveFocus();
    for (const [title, description] of workflows.verified.steps) {
      expect(guide.getByRole("heading", { name: title })).toBeVisible();
      expect(guide.getByText(description)).toBeVisible();
    }
    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("tab", { name: /Prospect Evidence Report/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("aria-selected", "true");
  });
  it("groups both report entries in the hero without duplicating workflow buttons", async () => {
    const user = userEvent.setup();
    render(<SampleReportsV22 />);
    const entries = within(
      screen.getByRole("group", { name: "Read a report" }),
    );
    expect(entries.getAllByRole("button")).toHaveLength(2);
    expect(
      within(
        screen.getByRole("region", { name: "Client report workflow" }),
      ).queryByRole("button", {
        name: /^Read the/,
      }),
    ).not.toBeInTheDocument();
    await user.click(
      entries.getByRole("button", { name: "Read the Verified plan" }),
    );
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-verified");
    await user.click(
      entries.getByRole("button", { name: "Read the Prospect report" }),
    );
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-prospect");
  });
  it("shows the current two-stage workflow and one report at a time", async () => {
    const user = userEvent.setup();
    render(<SampleReportsV22 />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Build the proposal.",
    );
    expect(
      screen.getAllByText(/Direct service-only setup is not available/)[0],
    ).toBeVisible();
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-prospect");
    await user.click(screen.getByRole("tab", { name: "02 Deliver the work" }));
    expect(
      screen.getByText(/Choose the client’s completed Prospect Case/),
    ).toBeVisible();
    const prospect = screen.getByRole("tab", {
      name: /Prospect Evidence Report/,
    });
    prospect.focus();
    await user.keyboard("{End}");
    expect(
      screen.getByRole("tab", { name: /Verified Action Plan/ }),
    ).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-verified");
    expect(
      within(
        screen.getByRole("tabpanel", {
          name: /Prospect Evidence Report|Verified Action Plan/,
        }),
      ).getByText("What changed from the first report?"),
    ).toBeVisible();
    await user.keyboard("{Home}");
    expect(prospect).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByRole("link", { name: "Start a Prospect Case" })[0],
    ).toHaveAttribute("href", "/cases/new");
    expect(
      screen.getAllByRole("link", { name: "Continue with a client Case" })[0],
    ).toHaveAttribute("href", "/cases/service");
  });

  it("opens existing deep links and keeps report prose free of repeated sample notices", async () => {
    window.history.replaceState(null, "", "/sample-report#sample-verified");
    render(<SampleReportsV22 />);
    const paper = screen.getByRole("article", {
      name: "Verified Action Plan document",
    });
    expect(paper).toBeVisible();
    expect(
      within(paper).queryByText(/fictional|illustrative|simulation/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Demonstration reports · Fictional business/),
    ).toBeVisible();
    expect(
      within(paper).getByText(deliverables.verified.caution),
    ).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continuous" }));
    await user.click(within(paper).getAllByText("Inspect the basis")[0]);
    expect(
      within(paper).getByText(deliverables.verified.evidence[0].pending),
    ).toBeVisible();
    expect(
      within(paper).getByText(deliverables.verified.actions[0].completion),
    ).toBeVisible();
  });

  it("keeps report selection independent of the client conversations", async () => {
    const user = userEvent.setup();
    render(<SampleReportsV22 />);
    await user.click(screen.getByRole("tab", { name: /Verified Action Plan/ }));
    await user.click(
      screen.getByRole("button", {
        name: "But our competitor has a dedicated page. Shouldn’t we follow?",
      }),
    );
    expect(window.location.hash).toBe("#sample-verified");
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-verified");
    await act(async () => {
      window.history.replaceState(null, "", "#sample-prospect");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("tabpanel", {
        name: /Prospect Evidence Report|Verified Action Plan/,
      }),
    ).toHaveAttribute("id", "sample-prospect");
  });
});
