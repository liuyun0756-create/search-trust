// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SampleReportsV22 } from "./SampleReportsV22";
import { sampleReports } from "./sample-report-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics-client", () => ({ track: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function reportAt(index: number) {
  return within(screen.getAllByRole("article", { name: /report view/i })[index]);
}
function deskAt(index: number) {
  return within(screen.getAllByRole("complementary", { name: /SEO review desk/i })[index]);
}

describe("continuous sample reports", () => {
  it("renders two complete, separately navigable reports for one fictional business", () => {
    const { container } = render(<SampleReportsV22 />);
    const nav = within(screen.getByRole("navigation", { name: "Report sample scenarios" }));
    expect(nav.getAllByRole("link")).toHaveLength(2);
    for (const link of nav.getAllByRole("link")) expect(container.querySelector(link.getAttribute("href")!)).toHaveClass("scroll-mt-28");
    expect(container.querySelector("#report-scenarios")).toHaveClass("scroll-mt-28");
    for (const index of [0, 1]) {
      const report = reportAt(index);
      expect(report.getByText(/Local air-conditioning repair business/)).toBeVisible();
      for (const section of ["What we found", "The evidence behind the decision", "What this means for the work", "Three actions for SEO and client review", "What this report does not claim"]) expect(report.getByRole("heading", { name: section })).toBeVisible();
      expect(report.getAllByRole("listitem").length).toBeGreaterThan(6);
      expect(report.getByText(/SEO review required before any client delivery/)).toBeVisible();
    }
    expect(screen.getByText(/The first question is not erased/)).toBeVisible();
  });

  it("switches wording, not evidence or limits, and requires both views for demo readiness", async () => {
    const user = userEvent.setup(); render(<SampleReportsV22 />);
    const desk = deskAt(1); const report = reportAt(1);
    expect(desk.getByRole("button", { name: "Mark demo ready" })).toBeDisabled();
    const source = sampleReports[1].evidence[0].finding;
    const limit = sampleReports[1].limits[1];
    expect(report.getByText(source)).toBeVisible(); expect(report.getByText(limit)).toBeVisible();
    await user.click(desk.getByRole("button", { name: "SEO working view" }));
    expect(report.getByRole("heading", { name: sampleReports[1].seo.headline })).toBeVisible();
    expect(report.getByText(source)).toBeVisible(); expect(report.getByText(limit)).toBeVisible();
    expect(desk.getByRole("button", { name: "Mark demo ready" })).toBeEnabled();
    await user.click(desk.getByRole("button", { name: "Mark demo ready" }));
    expect(desk.getByRole("status")).toHaveTextContent(/Nothing has been shared/);
  });

  it("edits a client draft in memory while keeping source evidence and the SEO view unchanged", async () => {
    const user = userEvent.setup(); const api = vi.spyOn(globalThis, "fetch"); const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<SampleReportsV22 />);
    const desk = deskAt(0); const report = reportAt(0);
    await user.click(desk.getByRole("button", { name: "Edit client wording" }));
    await user.clear(desk.getByRole("textbox", { name: "Report headline" }));
    await user.type(desk.getByRole("textbox", { name: "Report headline" }), "A clearer client proposal");
    await user.click(desk.getByRole("button", { name: "Move action 2 up" }));
    await user.click(desk.getByRole("button", { name: "Save demo draft" }));
    expect(report.getByRole("heading", { name: "A clearer client proposal" })).toBeVisible();
    expect(report.getByText(sampleReports[0].evidence[0].finding)).toBeVisible();
    expect(desk.getByText(/Check the other view for consistency/)).toBeVisible();
    await user.click(desk.getByRole("button", { name: "SEO working view" }));
    expect(report.getByRole("heading", { name: sampleReports[0].seo.headline })).toBeVisible();
    expect(desk.getByRole("button", { name: "Mark demo ready" })).toBeDisabled();
    await user.click(desk.getByRole("checkbox", { name: /checked the edited wording/ }));
    expect(desk.getByRole("button", { name: "Mark demo ready" })).toBeEnabled();
    expect(api).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });

  it("cancels edits and restores the original example after confirmation", async () => {
    const user = userEvent.setup(); vi.spyOn(window, "confirm").mockReturnValue(true); render(<SampleReportsV22 />);
    const desk = deskAt(0); const report = reportAt(0);
    await user.click(desk.getByRole("button", { name: "Edit client wording" }));
    await user.clear(desk.getByRole("textbox", { name: "Report headline" }));
    await user.type(desk.getByRole("textbox", { name: "Report headline" }), "Unsaved title");
    await user.click(desk.getByRole("button", { name: "Cancel" }));
    expect(report.getByRole("heading", { name: sampleReports[0].client.headline })).toBeVisible();
    await user.click(desk.getByRole("button", { name: "Edit client wording" }));
    await user.clear(desk.getByRole("textbox", { name: "Report headline" }));
    await user.type(desk.getByRole("textbox", { name: "Report headline" }), "Saved title");
    await user.click(desk.getByRole("button", { name: "Save demo draft" }));
    await user.click(desk.getByRole("button", { name: "Restore original example" }));
    expect(report.getByRole("heading", { name: sampleReports[0].client.headline })).toBeVisible();
    expect(desk.queryByText(/Edited in this demo/)).not.toBeInTheDocument();
  });
});
