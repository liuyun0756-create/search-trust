// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodExecution } from "./MethodExecution";
import { ExecutionDraftDemo } from "./ExecutionDraftDemo";
import { ExecutionReviewDemo } from "./ExecutionReviewDemo";
import { createExecutionDraft, draftSections, formatDemoMetric, getReviewMetrics, hasDraftPlaceholders, serializeExecutionDraft } from "./execution-demo-data";

afterEach(() => vi.restoreAllMocks());

describe("execution module", () => {
  it("shows three workspaces, one active panel and all five completion criteria", () => {
    render(<MethodExecution />);
    const navigation = within(screen.getByRole("group", { name: "Execution workspaces" }));
    expect(navigation.getAllByRole("button")).toHaveLength(3);
    expect(navigation.getAllByRole("button").map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    for (const button of navigation.getAllByRole("button")) expect(document.getElementById(button.getAttribute("aria-controls")!)).toBeInTheDocument();
    expect(document.getElementById("execution-steps-panel")).toBeVisible();
    expect(document.getElementById("execution-draft-panel")).not.toBeVisible();
    const steps = within(screen.getByRole("list", { name: "Implementation steps" })).getAllByRole("button");
    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false", "false"]);
    expect(screen.getAllByText(/Completion criteria:/)).toHaveLength(5);
    expect(screen.getByRole("button", { name: "View the draft for this step" })).toBeVisible();
    expect(screen.getByText(/do not yet save content drafts/)).toBeVisible();
  });

  it("selects a working brief without claiming implementation is complete", async () => {
    const user = userEvent.setup(); render(<MethodExecution />);
    const steps = within(screen.getByRole("list", { name: "Implementation steps" })).getAllByRole("button");
    await user.click(steps[0]);
    expect(steps[0]).toHaveAttribute("aria-pressed", "true"); expect(steps[1]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("region", { name: "Selected implementation brief" })).toHaveTextContent("Step 01 / Working brief");
    expect(screen.queryByRole("button", { name: /mark.*complete/i })).not.toBeInTheDocument();
  });

  it("retains unsaved draft edits across workspace changes", async () => {
    const user = userEvent.setup(); render(<MethodExecution />);
    await user.click(screen.getByRole("button", { name: "View the draft for this step" }));
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Suggested page title" }), { target: { value: "Preserve this unsaved title" } });
    await user.click(screen.getByRole("button", { name: /03 \/ Review changes/ }));
    expect(screen.getByText(/Unsaved draft changes are kept/)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Suggested page title" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /02 \/ Content draft/ }));
    expect(screen.getByRole("textbox", { name: "Suggested page title" })).toHaveValue("Preserve this unsaved title");
    await user.click(screen.getByRole("button", { name: "Save demo changes" }));
    expect(screen.queryByText(/Unsaved draft changes are kept/)).not.toBeInTheDocument();
  });

  it("requires confirmation before leaving an unsaved draft, but allows chapter anchors", async () => {
    const user = userEvent.setup(); const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<><ExecutionDraftDemo /><a href="/sample-report">Leave demo</a><a href="#execution-title">Same page</a></>);
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Suggested page title" }), { target: { value: "Unsaved" } });
    expect(fireEvent.click(screen.getByRole("link", { name: "Leave demo" }))).toBe(false);
    expect(window.dispatchEvent(new Event("searchtrust:before-navigation", { cancelable: true }))).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Same page" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.dispatchEvent(new Event("searchtrust:before-navigation", { cancelable: true }))).toBe(true);
  });
});

describe("editable execution draft", () => {
  it("saves only the demo draft and cancels subsequent edits", async () => {
    const user = userEvent.setup(); render(<ExecutionDraftDemo />);
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
    const ids = Array.from(document.querySelectorAll("[id]")).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    await user.clear(screen.getByRole("textbox", { name: "Suggested page title" }));
    await user.type(screen.getByRole("textbox", { name: "Suggested page title" }), "Reviewed example title");
    await user.click(screen.getByRole("button", { name: "Save demo changes" }));
    expect(screen.getByText("Reviewed example title")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    await user.clear(screen.getByRole("textbox", { name: "Suggested page title" }));
    await user.type(screen.getByRole("textbox", { name: "Suggested page title" }), "Discard this title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Reviewed example title")).toBeVisible();
    expect(screen.queryByText("Discard this title")).not.toBeInTheDocument();
  });

  it("copies the visible, edited draft and warns about remaining placeholders", async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ExecutionDraftDemo />);
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    await user.clear(screen.getByRole("textbox", { name: "Service introduction" }));
    await user.type(screen.getByRole("textbox", { name: "Service introduction" }), "Unsaved visible introduction");
    await user.click(screen.getByRole("button", { name: "Copy content" }));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("Unsaved visible introduction"));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("[Service area]"));
    expect(screen.getByRole("status")).toHaveTextContent("Draft contains information still to fill in.");
    expect(screen.getByRole("status")).toHaveTextContent("Draft copied.");
  });

  it("offers manual copying on clipboard denial without claiming success", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<ExecutionDraftDemo />);
    await user.click(screen.getByRole("button", { name: "Copy content" }));
    expect(screen.getByRole("textbox", { name: "Copy draft manually" })).toHaveValue(serializeExecutionDraft(createExecutionDraft()));
    expect(screen.getByRole("status")).toHaveTextContent("Clipboard access is unavailable.");
    expect(screen.getByRole("status")).not.toHaveTextContent("Draft copied.");
  });

  it("shows and hides notes beneath the corresponding draft sections", async () => {
    const user = userEvent.setup(); render(<ExecutionDraftDemo />);
    await user.click(screen.getByRole("button", { name: "View change notes" }));
    expect(screen.getAllByText("Change note:")).toHaveLength(5);
    for (const section of draftSections) expect(screen.getByText(section.note, { exact: false })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide change notes" }));
    expect(screen.queryByText("Change note:")).not.toBeInTheDocument();
  });

  it("requires confirmation to restore and resets the draft on a new visit", async () => {
    const user = userEvent.setup(); const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(<ExecutionDraftDemo />);
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    await user.clear(screen.getByRole("textbox", { name: "Suggested page title" }));
    await user.type(screen.getByRole("textbox", { name: "Suggested page title" }), "Keep this edit");
    await user.click(screen.getByRole("button", { name: "Restore example" }));
    expect(screen.getByRole("textbox", { name: "Suggested page title" })).toHaveValue("Keep this edit");
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Restore example" }));
    expect(screen.getByText(draftSections[0].value)).toBeVisible();
    view.unmount(); render(<ExecutionDraftDemo />);
    expect(screen.getByText(draftSections[0].value)).toBeVisible();
  });
});

describe("simulated implementation review", () => {
  it("starts with the requested search values and percentage-point distinction", () => {
    render(<ExecutionReviewDemo />);
    const table = within(screen.getByRole("table"));
    for (const value of ["6,000", "6,250", "120", "150", "2.0%", "2.4%", "+4.2%", "+25%", "+0.4 percentage points"]) expect(table.getByText(value)).toBeVisible();
    expect(screen.getByText(/no real implementation date is recorded/)).toBeVisible();
    expect(screen.getByText(/not a published version of your edited demo draft/)).toBeVisible();
  });

  it("changes metric scope and preserves the distinction between events and leads", async () => {
    const user = userEvent.setup(); render(<ExecutionReviewDemo />);
    await user.click(screen.getByRole("button", { name: "On-site behavior" }));
    const table = within(screen.getByRole("table"));
    expect(table.getByText("100")).toBeVisible(); expect(table.getByText("125")).toBeVisible();
    expect(table.getByText("4")).toBeVisible(); expect(table.getByText("5")).toBeVisible();
    expect(table.getByText("+1 event")).toBeVisible();
    expect(screen.getByText(/not completed sales or counts of qualified leads/)).toBeVisible();
  });

  it("updates figures, explanations and data status together for all scenarios", async () => {
    const user = userEvent.setup(); render(<ExecutionReviewDemo />);
    await user.click(screen.getByRole("button", { name: "No clear change" }));
    expect(within(screen.getByRole("table")).getAllByText("6,000")).toHaveLength(2);
    expect(within(screen.getByRole("table")).queryByText("6,250")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No clear change appears");
    await user.click(screen.getByRole("button", { name: "Insufficient data" }));
    expect(within(screen.getByRole("table")).getAllByText("Not available")).toHaveLength(3);
    expect(within(screen.getByRole("table")).getAllByText("Not comparable")).toHaveLength(3);
    expect(within(screen.getByRole("table")).queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("Insufficient for comparison — simulated")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Missing values are not zero");
    await user.click(screen.getByRole("button", { name: "On-site behavior" }));
    expect(within(screen.getByRole("table")).getAllByText("Not available")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Insufficient data" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not fetch live data or persist demo changes", async () => {
    const user = userEvent.setup(); const fetch = vi.spyOn(globalThis, "fetch"); const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<MethodExecution />);
    await user.click(screen.getByRole("button", { name: /03 \/ Review changes/ }));
    await user.click(screen.getByRole("button", { name: "Insufficient data" }));
    await user.click(screen.getByRole("button", { name: /02 \/ Content draft/ }));
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    await user.click(screen.getByRole("button", { name: "Save demo changes" }));
    expect(fetch).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });
});

describe("demo data helpers", () => {
  it("detects unresolved fields without changing the provided example", () => {
    const draft = createExecutionDraft(); expect(hasDraftPlaceholders(draft)).toBe(true);
    for (const key of Object.keys(draft) as (keyof typeof draft)[]) draft[key] = "Client-approved example text";
    expect(hasDraftPlaceholders(draft)).toBe(false);
    draft.title = "【待确认】"; expect(hasDraftPlaceholders(draft)).toBe(true);
    expect(createExecutionDraft().title).toContain("[Service area]");
  });

  it("preserves missing values as null and formats zero distinctly", () => {
    for (const scope of ["search", "onsite"] as const) expect(getReviewMetrics(scope, "insufficient").every((metric) => metric.after === null)).toBe(true);
    expect(formatDemoMetric(null)).toBe("Not available"); expect(formatDemoMetric(0)).toBe("0");
    expect(formatDemoMetric(2, true)).toBe("2.0%");
  });
});
