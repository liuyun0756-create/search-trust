// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MethodVerified } from "./MethodVerified";

describe("MethodVerified", () => {
  it("exposes all three reasoning steps and outputs in the detailed method", () => {
    const { container } = render(<MethodVerified />);
    fireEvent.click(screen.getByText("Inspect the three-stage verification method"));
    const steps = within(screen.getByRole("list", { name: "How client data informs the decision" }));
    expect(steps.getAllByRole("heading", { level: 4 })).toHaveLength(3);
    expect(steps.getAllByText("Stage output")).toHaveLength(3);
    for (const label of ["Confirm the direction:", "Revise the action:", "Defer the work:", "Investigate first:"]) {
      expect(steps.getByText(label)).toBeVisible();
    }
    expect(container.querySelector("button, input, form, [role='tab'], iframe")).toBeNull();
  });

  it("continues the service-page example with explicit provenance and visible conditions", () => {
    render(<MethodVerified />);
    const example = within(screen.getByRole("article"));
    fireEvent.click(example.getByText("Inspect the initial reasoning"));
    expect(example.getByText("Method example · Not a real client result")).toBeVisible();
    expect(example.getByText("Still unresolved")).toBeVisible();
    expect(example.getByText("Client confirmation")).toBeVisible();
    expect(example.getByText("Search performance")).toBeVisible();
    expect(example.getByText("On-site behavior")).toBeVisible();
    expect(example.getByText("Page inspection")).toBeVisible();
    expect(example.getByText(/A corresponding service page already exists/)).toBeVisible();
  });

  it("keeps initial evidence, new evidence, judgment changes and action in reading order", () => {
    render(<MethodVerified />);
    const example = within(screen.getByRole("article"));
    expect(example.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"))).toEqual([
      "verified-initial-title", "verified-evidence-title", "verified-decisions-title", "verified-work-title",
    ]);
  });

  it("preserves causal uncertainty and makes the top-three selection conditional", () => {
    render(<MethodVerified />);
    fireEvent.click(screen.getByText("View the complete action brief and review criteria"));
    expect(screen.getByText(/Not yet. Event measurement/)).toBeVisible();
    expect(screen.getByText(/decide whether this belongs in the top three/)).toBeVisible();
    expect(screen.getByText(/rather than filling uncertainty with confident language/)).toBeVisible();
  });

  it("shows the full action brief and four deliverables", () => {
    render(<MethodVerified />);
    fireEvent.click(screen.getByText("View the complete action brief and review criteria"));
    const action = within(screen.getByRole("region", { name: "Improve the existing core service page. Clarify the service and the contact path." }));
    for (const label of ["Target", "Specific work", "Priority rationale", "Completion criteria", "How to review"]) {
      expect(action.getByText(label, { selector: "dt" })).toBeVisible();
    }
    expect(action.getAllByRole("listitem")).toHaveLength(3);
    for (const label of ["Problem assessment", "Supporting evidence", "Priority actions", "Execution & validation"]) {
      expect(screen.getByText(label, { selector: "dt" })).toBeVisible();
    }
  });

  it("only links to the public sample page, with no connection or generation action", () => {
    render(<MethodVerified />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View a sample report" })).toHaveAttribute("href", "/sample-report");
    expect(document.getElementById("verified-action")).toHaveClass("scroll-mt-28");
  });
});
