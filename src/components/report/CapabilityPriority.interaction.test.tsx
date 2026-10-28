// @vitest-environment jsdom
import React from "react";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import sample from "@/lib/report-capability/fixtures/generated/service-first.json";
import zero from "@/lib/report-capability/fixtures/generated/service-zero.json";
import { validateCapabilityReport } from "@/lib/report-capability/validate";
import { projectCapabilityReport } from "@/lib/report-capability/projection";
import { initialCapabilityRevision } from "@/lib/report-capability/revision";
import { CapabilityReportDocument } from "./CapabilityReportDocument";

afterEach(cleanup);
function checked(value: unknown) {
  const r = validateCapabilityReport(value);
  if (!r.ok) throw new Error("Invalid fixture");
  return r.report;
}
describe("Readable priority basis", () => {
  it("shows a short why-now for each action and reveals the four decision dimensions on demand", async () => {
    const r = checked(sample);
    render(<CapabilityReportDocument document={projectCapabilityReport(r)}/>);
    const plan = within(screen.getByRole("region", {name:"Action plan"}));
    expect(plan.getAllByText("Why now")).toHaveLength(r.actions.length);
    const summaries = plan.getAllByText("Inspect the priority basis");
    const detail = summaries[0].closest("details")!;
    expect(detail.open).toBe(false);
    await userEvent.click(summaries[0]);
    expect(detail.open).toBe(true);
    for (const label of ["Prerequisites", "Business relevance", "Evidence", "Execution conditions", "Potential impact path", "Checked scope"]) {
      expect(within(detail).getByText(label)).toBeTruthy();
    }
    expect(within(detail).getByText(/Business return is unknown/)).toBeTruthy();
  });
  it("labels the original system recommendation when the SEO edits or reorders the plan", () => {
    const r = checked(sample), revision = initialCapabilityRevision(r);
    revision.actions.reverse(); revision.status = "approved";
    render(<CapabilityReportDocument document={projectCapabilityReport(r, revision)}/>);
    expect(screen.getByText("System recommendation · original position 3")).toBeTruthy();
    expect(screen.getAllByText(/The delivery plan was edited/)).toHaveLength(2);
  });
  it("does not manufacture a priority card when the diagnosis supports no action", () => {
    render(<CapabilityReportDocument document={projectCapabilityReport(checked(zero))}/>);
    expect(screen.queryByText("Why now")).toBeNull();
    expect(screen.queryByText("Inspect the priority basis")).toBeNull();
    expect(screen.getByText("No action proposed yet")).toBeTruthy();
  });
});
