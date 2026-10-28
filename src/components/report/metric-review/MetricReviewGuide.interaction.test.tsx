// @vitest-environment jsdom
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import fixtures from "@/lib/metric-review-guidance/contracts/fixtures.json";
import type { ActionFacts } from "@/lib/review-reports/types";
import { MetricReviewGuide } from "./MetricReviewGuide";
afterEach(cleanup);
const facts = (name: keyof typeof fixtures.cases) =>
  structuredClone(fixtures.cases[name].facts) as unknown as ActionFacts;
describe("owner metric review guidance", () => {
  it("shows five distinct metrics, real counts and actionable checks without a success claim", () => {
    render(<MetricReviewGuide action={facts("available")} />);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    const sessions = screen.getAllByRole("article")[3];
    expect(within(sessions).getByText("100")).toBeInTheDocument();
    expect(within(sessions).getByText("125")).toBeInTheDocument();
    expect(
      within(sessions).getByText("Snapshot counts only"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /No metric-specific effect threshold has been validated/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps zero-denominator CTR distinct from valid clicks and exposes its basis", () => {
    render(<MetricReviewGuide action={facts("zero_denominator")} />);
    const ctr = screen.getAllByRole("article")[2];
    expect(within(ctr).getByText("No usable denominator")).toBeInTheDocument();
    expect(within(ctr).getByText("CTR change unavailable")).toBeInTheDocument();
    const summary = within(ctr).getByText(
      "Basis & checks for click-through rate",
    );
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(
      within(ctr).getByText(/At least one period has zero impressions/),
    ).toBeVisible();
  });
  it("does not turn a missing source or withheld session count into zero", () => {
    const { rerender } = render(
      <MetricReviewGuide action={facts("not_selected")} />,
    );
    expect(screen.getAllByText("Source not selected")).toHaveLength(5);
    rerender(<MetricReviewGuide action={facts("session_restricted")} />);
    expect(
      within(screen.getAllByRole("article")[3]).getByText(
        "No comparable values shown",
      ),
    ).toBeInTheDocument();
  });
  it("shows waiting, recorded work gaps and reported concurrent changes", () => {
    const { rerender } = render(
      <MetricReviewGuide action={facts("waiting")} />,
    );
    expect(screen.getAllByText("Wait for the window")).toHaveLength(3);
    rerender(<MetricReviewGuide action={facts("work_unconfirmed")} />);
    expect(
      screen.getByText(/No implementation date is recorded/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Other changes were reported/)).toBeInTheDocument();
  });
  it("fails closed on an internally inconsistent reading", () => {
    const a = facts("available");
    a.ga4!.difference = 999;
    render(<MetricReviewGuide action={a} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Metric guidance could not be verified",
    );
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("does not round a nonzero CTR change to zero", () => {
    render(<MetricReviewGuide action={facts("tiny_change")} />);
    expect(
      within(screen.getAllByRole("article")[2]).getByText(
        /\+1\.00e-6 percentage points/,
      ),
    ).toBeInTheDocument();
  });
  it("filters to the selected source during source preparation", () => {
    render(<MetricReviewGuide action={facts("available")} only="ga4" />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("Search clicks")).toBeNull();
  });
});
