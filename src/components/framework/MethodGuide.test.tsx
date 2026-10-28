// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MethodV22 } from "./MethodV22";
import { sampleReports } from "../sampleReport/sample-report-data";

describe("public method guide", () => {
  it("keeps six practical method situations in a selectable chapter", async () => {
    const user = userEvent.setup();
    render(<MethodV22 />);
    const list = screen.getByRole("tablist", {
      name: "Choose a method situation",
    });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tabpanel", { name: /Before the first call/i }),
    ).toHaveTextContent("Public evidence cannot establish traffic");
    tabs[0].focus();
    await user.keyboard("{End}");
    expect(tabs[5]).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", { name: /Explain what changed/i }),
    ).toHaveTextContent("A later change does not prove");
    expect(
      screen.getByRole("link", { name: /More situations/i }),
    ).toHaveAttribute("href", "#method-situations");
  });
  it("renders the approved route sequence, scope and current product boundary", () => {
    const { container } = render(<MethodV22 />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Build the proposal around the business.",
    );
    const scope = within(
      container.querySelector("#method-scope")! as HTMLElement,
    );
    for (const title of [
      "Business & competition",
      "Pages & access",
      "Public business identity",
      "Content & credibility",
      "Search performance",
      "On-site behavior",
      "Measurement & review",
    ])
      expect(scope.getByRole("tab", { name: title })).toBeVisible();
    expect(
      screen.getByText(/The eight-layer model is not Google/),
    ).toBeInTheDocument();
    expect(screen.getByText("What is available today?")).toBeVisible();
    expect(
      screen.queryByText("Client-ready Review", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Content draft/ }),
    ).not.toBeInTheDocument();
    for (const name of ["Support", "Revise", "Defer", "Investigate"])
      expect(screen.getByText(name, { exact: true })).toBeVisible();
    const navigation = within(
      screen.getByRole("navigation", { name: "Our Method chapters" }),
    );
    for (const link of navigation.getAllByRole("link"))
      expect(
        container.querySelector(link.getAttribute("href")!),
      ).not.toBeNull();
    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each scope's evidence and limits reachable through keyboard selection", async () => {
    const user = userEvent.setup();
    render(<MethodV22 />);
    const list = screen.getByRole("tablist", {
      name: "Explore the diagnostic scope",
    });
    const tabs = within(list).getAllByRole("tab");
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    tabs[0].focus();
    for (let index = 0; index < tabs.length; index++) {
      expect(tabs[index]).toHaveAttribute("aria-selected", "true");
      const panel = document.getElementById(
        tabs[index].getAttribute("aria-controls")!,
      )!;
      expect(panel).toBeVisible();
      expect(
        within(panel).getByRole("heading", {
          name: "SEO confirmation & limits",
        }),
      ).toBeVisible();
      await user.keyboard("{ArrowDown}");
    }
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs[6]).toHaveFocus();
    await user.keyboard("{Home}{ArrowUp}");
    expect(tabs[6]).toHaveFocus();
    await user.click(tabs[3]);
    expect(
      screen.getByText(/The eight-layer model is not Google/),
    ).toBeVisible();
  });

  it("connects evidence explanations to the decision while keeping facts and limits visible", async () => {
    const user = userEvent.setup();
    const { container } = render(<MethodV22 />);
    const section = within(
      container.querySelector("#prospect-diagnosis")! as HTMLElement,
    );
    const client = section.getByRole("button", {
      name: /Client confirmation: how/,
    });
    const ga4 = section.getByRole("button", {
      name: /GA4 \/ pending check: how/,
    });
    const decision = section.getByRole("heading", {
      name: "Improve the existing service page first.",
    });
    expect(decision).toBeVisible();
    await user.click(client);
    expect(client).toHaveAttribute("aria-expanded", "true");
    expect(section.getByText("Confirms the page to improve.")).toBeVisible();
    await user.click(ga4);
    expect(client).toHaveAttribute("aria-expanded", "false");
    expect(section.getByText("Keeps enquiry causes unresolved.")).toBeVisible();
    expect(section.getByText(/A service page exists/)).toBeVisible();
    expect(section.getByText(/Still unproven/).parentElement).toHaveAttribute(
      "data-highlight",
      "true",
    );
    await user.click(ga4);
    expect(ga4).toHaveAttribute("aria-expanded", "false");
    expect(decision).toBeVisible();
    expect(section.getByText(/Still unproven/)).toBeVisible();
  });

  it("switches diagnostic examples by keyboard with intact limits and sources", async () => {
    const user = userEvent.setup();
    render(<MethodV22 />);
    const tabs = within(
      screen.getByRole("tablist", { name: "Explore a diagnostic question" }),
    ).getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", {
        name: "Are the sources in conflict—or measuring different things?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Clicks and sessions are different measurements/),
    ).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("link", { name: /Google guidance: local ranking/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows conditional priority changes, not a calculated impact score", async () => {
    const user = userEvent.setup();
    render(<MethodV22 />);
    await user.click(screen.getByRole("tab", { name: "Confirmed blocker" }));
    expect(
      screen.getByRole("heading", {
        name: "Bring the contact correction forward.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/rule out valid branch or tracking numbers/),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Delivery timing" }));
    expect(
      screen.getByRole("heading", {
        name: "Sequence work around the release.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/not automatically calculated business-value weights/),
    ).toBeVisible();
  });

  it("keeps professional outreach specific, qualified and keyboard accessible", async () => {
    const user = userEvent.setup();
    render(<MethodV22 />);
    const list = screen.getByRole("tablist", {
      name: "Choose a client conversation",
    });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(within(list).getByText("Win the work")).toBeVisible();
    expect(within(list).getByText("Deliver the work")).toBeVisible();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs[0].focus();
    for (const tab of tabs) {
      expect(tab).toHaveFocus();
      const panel = within(
        document.getElementById(tab.getAttribute("aria-controls")!)!,
      );
      for (const label of ["What you bring", "What the client can assess"])
        expect(panel.getByText(label, { exact: true })).toBeVisible();
      expect(panel.getByText("Illustrative source basis")).not.toBeVisible();
      await user.click(panel.getByText("View evidence & open questions"));
      expect(panel.getByText("Illustrative source basis")).toBeVisible();
      expect(
        panel.getByText(/No collected URLs, snapshots, dates or values/),
      ).toBeVisible();
      await user.click(panel.getByText("View evidence & open questions"));
      await user.click(panel.getByText("View the reasoning"));
      expect(panel.getByText("Take forward", { exact: true })).toBeVisible();
      await user.click(panel.getByText("View the reasoning"));
      tab.focus();
      await user.keyboard("{ArrowDown}");
    }
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs[4]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByText(/It may be a valid branch or tracking number/),
    ).toBeVisible();
  });

  it("shows execution, completion and review as distinct steps without pretending work is done", async () => {
    const user = userEvent.setup();
    const { container } = render(<MethodV22 />);
    const section = within(
      container.querySelector("#execution-title")! as HTMLElement,
    );
    await user.click(section.getByRole("tab", { name: "02 When it’s done" }));
    expect(
      section.getByText(/These are checks to perform, not completed tasks/),
    ).toBeVisible();
    await user.click(section.getByRole("tab", { name: "03 What to review" }));
    expect(
      section.getByText(/A performance change alone does not prove/),
    ).toBeVisible();
    await user.click(section.getByText("What is available today?"));
    expect(
      section.getByText(/Content drafting, implementation-history tracking/),
    ).toBeVisible();
    expect(section.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders the complete shared sample with a non-interactive video placeholder and no real mutations", async () => {
    const user = userEvent.setup();
    const api = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<MethodV22 />);
    const region = screen.getByRole("region", {
      name: "Complete fictional Verified Action Plan",
    });
    const report = sampleReports.find((item) => item.stage === "verified")!;
    for (const text of [
      report.client.headline,
      report.client.summary,
      report.client.decision,
      ...report.client.actions,
      report.client.clientRequest,
      report.client.review,
      ...report.limits,
    ])
      expect(within(region).getByText(text, { exact: true })).toBeVisible();
    for (const evidence of report.evidence)
      expect(
        within(region).getByText(evidence.finding, { exact: true }),
      ).toBeVisible();
    for (const text of [
      ...report.judgment.map((item) => item.answer),
      ...report.status.map((item) => item.detail),
    ])
      expect(within(region).getByText(text, { exact: true })).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: "Client view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Editing walkthrough video placeholder/,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /play|send|approve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Current workspace editing covers the three-action plan/,
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Explain fewer clicks/ }));
    await user.click(screen.getByRole("tab", { name: /03 What to review/ }));
    expect(
      screen.getByRole("link", { name: "Read both full report samples" }),
    ).toHaveAttribute("href", "/sample-report");
    expect(api).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    api.mockRestore();
    storage.mockRestore();
  });
});
