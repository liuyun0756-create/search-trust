// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ReleaseReportPreview } from "./ReleaseReportPreview";
import data from "@/lib/site-report-candidates/generated/reports.json";
import type { SiteCandidate } from "@/lib/site-report-candidates/project";

afterEach(cleanup);
const props = { ...data, reports: data.reports as SiteCandidate[] };
describe("Candidate report reader", () => {
  it("starts with the Prospect report and displays actual evidence", () => {
    render(<ReleaseReportPreview {...props} />);
    expect(screen.getByRole("tab", { name: /Prospect report/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("region", { name: "Findings" }).textContent).toContain("503");
    expect(screen.getByRole("region", { name: "Action plan" }).textContent).toContain("Completion checks");
  });
  it("switches with arrow and Home/End keys, resets scroll and shows a zero-action diagnosis", async () => {
    const user = userEvent.setup(); render(<ReleaseReportPreview {...props} />);
    const reader = screen.getByLabelText("Scrollable report"); reader.scrollTop = 400;
    screen.getByRole("tab", { name: /Prospect report/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Verified plan/ }).getAttribute("aria-selected")).toBe("true");
    expect(reader.scrollTop).toBe(0);
    expect(screen.getByRole("region", { name: "Findings" }).textContent).toContain("750");
    await user.keyboard("{End}");
    expect(screen.getByRole("heading", { name: "No action proposed yet" })).toBeTruthy();
    expect(screen.getByText(/not refunded/)).toBeTruthy();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /Prospect report/ }).getAttribute("aria-selected")).toBe("true");
  });
  it("navigates to report material with focus while keeping the chapter controls available", async () => {
    render(<ReleaseReportPreview {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /03Action plan/ }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Action plan" }));
    expect(screen.getByRole("navigation", { name: "Report chapters" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Approve|Save|Share/ })).toBeNull();
  });
});
