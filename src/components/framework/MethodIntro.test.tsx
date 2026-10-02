// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MethodIntro } from "./MethodIntro";

describe("MethodIntro", () => {
  it("shows three connected work stages with evidence, decisions and concrete outputs", () => {
    const { container } = render(<MethodIntro />);
    const overview = within(screen.getAllByRole("region")[0]);
    expect(overview.getAllByRole("article")).toHaveLength(3);
    expect(overview.getAllByText("Evidence in")).toHaveLength(3);
    expect(overview.getAllByText("Decision")).toHaveLength(3);
    expect(overview.getAllByText("You get")).toHaveLength(3);
    expect(overview.getByText("01 / Prospect")).toBeVisible();
    expect(overview.getByText("02 / Deliver")).toBeVisible();
    expect(overview.getByText("03 / Review")).toBeVisible();
    expect(overview.getByText(/Illustrated reasoning, not a real client result/)).toBeVisible();
    expect(container.querySelector('.method-hero details')).toBeNull();
  });

  it("makes scroll and page-navigation actions visibly distinct", () => {
    render(<MethodIntro />);
    expect(within(screen.getByRole("navigation", { name: "Our Method chapters" })).getAllByRole("link")).toHaveLength(6);
    const outcomeAnchor = screen.getByRole("link", { name: "See what you get" });
    expect(outcomeAnchor).toHaveAttribute("href", "#method-outputs");
    expect(outcomeAnchor).toHaveClass("method-action-primary");
    const diagnosisAnchor = screen.getByRole("link", { name: "See how the Prospect Diagnosis is built" });
    expect(diagnosisAnchor).toHaveAttribute("href", "#prospect-diagnosis");
    expect(diagnosisAnchor).toHaveClass("method-action-scroll");
    const target = document.getElementById("prospect-diagnosis");
    expect(target?.tagName).toBe("H2");
    expect(target).toHaveClass("scroll-mt-28");
    const route = screen.getByRole("link", { name: "View the full report sample" });
    expect(route).toHaveAttribute("href", "/sample-report");
    expect(route).toHaveClass("method-action-secondary");
  });

  it("states the three professional values and the three final method outputs", () => {
    render(<MethodIntro />);
    for (const value of ["Win better conversations", "Deliver with a reason", "Review without hand-waving"]) expect(screen.getByText(value)).toBeVisible();
    const outputs = within(screen.getByRole("region", { name: "Not another audit checklist. A working set of decisions." }));
    for (const output of ["Prospect Diagnosis", "Verified Action Plan", "Client-ready Review"]) expect(outputs.getByRole("heading", { name: output })).toBeVisible();
  });

  it("shows context questions and all three diagnostic explanations", () => {
    render(<MethodIntro />);
    for (const label of ["Services", "Locations", "Search intent", "Real competitors"]) {
      expect(screen.getByText(label, { selector: "dt" })).toBeVisible();
    }
    expect(screen.getAllByText("What we check")).toHaveLength(3);
    expect(screen.getAllByText("What it helps decide")).toHaveLength(3);
    expect(screen.getByText(/The eight-layer trust model helps/)).toBeVisible();
  });

  it("keeps the complete example and its non-client-result label visible", () => {
    render(<MethodIntro />);
    const example = within(screen.getByRole("article", { name: "Does this service need a dedicated page?" }));
    expect(example.getByText("Method example · Not a real client result")).toBeVisible();
    for (const label of ["Analysis target", "Observed evidence", "Judgment", "Recommended action", "Client confirmation"]) {
      expect(example.getByText(label, { selector: "dt" })).toBeVisible();
    }
    expect(example.getByText(/First check whether an existing page was missed/)).toBeVisible();
  });

  it("retains the public-evidence boundary and professional judgment", () => {
    render(<MethodIntro />);
    expect(screen.getByText(/You keep the final professional judgment/)).toBeVisible();
    expect(screen.getByText(/It does not establish the client’s private traffic, lead quality or revenue/)).toBeVisible();
    expect(screen.queryByText("A disciplined SEO workflow, made traceable.")).not.toBeInTheDocument();
  });
});
