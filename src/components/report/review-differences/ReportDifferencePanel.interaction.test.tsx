// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, it, expect } from "vitest";
import { ReportDifferencePanel } from "./ReportDifferencePanel";
import { parseReportDifference } from "@/lib/review-differences/contracts";
import { parseReviewReport } from "@/lib/review-reports/delivery";
import fixtures from "@/lib/review-differences/contracts/fixture.json";
afterEach(cleanup);
const data = (key: keyof typeof fixtures.cases) => {
  const f = fixtures.cases[key];
  return parseReportDifference(f.difference, parseReviewReport(f.report));
};
it("shows actual old and new work, a pinned basis, and neutral unchanged evidence", () => {
  const d = data("updated");
  const { container } = render(<ReportDifferencePanel difference={d} />);
  expect(
    screen.getByText(
      `Compared with report version ${d.basis.report_version}, approved plan revision ${d.basis.delivery_revision}.`,
    ),
  ).toBeVisible();
  const work = screen.getByRole("region", {
    name: "Work recommendation changes",
  });
  expect(within(work).getByText("Work updated")).toBeVisible();
  expect(work.textContent).toContain(d.work[0].before!.steps[0]);
  expect(work.textContent).toContain(d.work[0].after!.steps[0]);
  const summary = within(work)
    .getByText("View work comparison")
    .closest("summary")!;
  fireEvent.click(summary);
  expect(container.querySelectorAll('[data-change="work"]').length).toBe(1);
  expect(
    screen.getByRole("link", { name: /Open the previous report/ }),
  ).toHaveAttribute(
    "href",
    expect.stringContaining(`revision=${d.basis.delivery_id}`),
  );
});
it("shows real source values and explicitly says a source was not selected", () => {
  const d = data("unselected");
  render(<ReportDifferencePanel difference={d} />);
  expect(screen.getByText("Evidence changed")).toBeVisible();
  expect(
    screen.getAllByText("Not selected in this review.").length,
  ).toBeGreaterThan(0);
  const g = d.evidence[0]!.before!.ga4!;
  expect(screen.getByText(`${g.before} → ${g.after} sessions`)).toBeVisible();
  expect(
    screen.getByRole("table", {
      name: "Saved Search Console comparison values",
    }),
  ).toBeVisible();
  expect(
    screen.getByText("No changes to the proposed work from the approved plan."),
  ).toBeVisible();
});
it("does not invent changed badges for unchanged work or historical missing snapshots", () => {
  const { container, rerender } = render(
    <ReportDifferencePanel difference={data("baseline")} />,
  );
  expect(container.querySelectorAll("[data-change]").length).toBe(0);
  expect(screen.getByText(/First review evidence baseline/)).toBeVisible();
  rerender(<ReportDifferencePanel difference={null} />);
  expect(
    screen.getByText("No saved comparison for this version"),
  ).toBeVisible();
  rerender(<ReportDifferencePanel difference={null} unavailable />);
  expect(screen.getByRole("alert")).toHaveTextContent(/could not be verified/);
  expect(screen.queryByText("No saved comparison for this version")).toBeNull();
});
