// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionPlanDemo } from "./ActionPlanDemo";
import { MethodPrioritization } from "./MethodPrioritization";
import { createDemoPlan, demoRecommendations, reorderDemoPlan } from "./plan-demo-data";

const rows = () => within(screen.getByRole("list", { name: "Demo action plan" })).getAllByRole("listitem").filter((node) => node.hasAttribute("data-action-id"));
const first = () => within(rows()[0]);

afterEach(() => vi.restoreAllMocks());

describe("priority module", () => {
  it("shows five open considerations, the complete rationale and a preview boundary", () => {
    const { container } = render(<MethodPrioritization />);
    fireEvent.click(screen.getByText("Read the complete service-page recommendation"));
    expect(within(screen.getByRole("list", { name: "Priority considerations" })).getAllByRole("heading", { level: 4 })).toHaveLength(5);
    const rationale = within(screen.getByRole("article"));
    expect(rationale.getAllByRole("term")).toHaveLength(6);
    expect(rationale.getByText("Method example · Not a real client result")).toBeVisible();
    expect(screen.getByText(/you can reorder the three generated actions/)).toBeVisible();
    expect(container.querySelector("iframe, a")).toBeNull();
  });
});

describe("isolated action plan demo", () => {
  it("renders three suggestions with disabled boundary moves and no login", () => {
    render(<ActionPlanDemo />);
    expect(rows()).toHaveLength(3);
    expect(first().getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(within(rows()[2]).getByRole("button", { name: "Move down" })).toBeDisabled();
    expect(screen.getByText(/no sign-in, analysis or credits are required/)).toBeVisible();
  });

  it("retains original evidence and expanded state when the action moves", async () => {
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "View evidence" }));
    expect(first().getByText(demoRecommendations[0].finding)).toBeVisible();
    await user.click(first().getByRole("button", { name: "Move down" }));
    expect(rows()[1]).toHaveAttribute("data-action-id", "core-service");
    expect(within(rows()[1]).getByText(demoRecommendations[0].finding)).toBeVisible();
    await user.click(within(rows()[1]).getByRole("button", { name: "Hide evidence" }));
    expect(within(rows()[1]).queryByText(demoRecommendations[0].finding)).not.toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Selected action reasoning" })).getByText(demoRecommendations[0].finding)).toBeVisible();
  });

  it("edits all seven work fields without changing the original evidence", async () => {
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form");
    const inputs = within(form).getAllByRole("textbox");
    expect(inputs).toHaveLength(7);
    for (const [index, input] of inputs.entries()) { await user.clear(input); await user.type(input, `Revised value ${index}`); }
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(first().getByRole("heading", { name: "Revised value 0" })).toBeVisible();
    expect(first().getByText(/Scope changed/)).toBeVisible();
    expect(first().getByText(/Your edited plan/)).toBeVisible();
    await user.click(first().getByRole("button", { name: "View evidence" }));
    expect(first().getByText(demoRecommendations[0].finding)).toBeVisible();
    expect(first().getByText(`Original target: ${demoRecommendations[0].target}`)).toBeVisible();
    expect(demoRecommendations[0].title).toBe("Improve the core service page");
  });

  it("cancel discards the form draft and leaves plan data unchanged", async () => {
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Action title" }));
    await user.type(screen.getByRole("textbox", { name: "Action title" }), "Discard this title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(first().getByRole("heading", { name: demoRecommendations[0].title })).toBeVisible();
    expect(screen.queryByText("Discard this title")).not.toBeInTheDocument();
  });

  it("rejects whitespace-only title or scope", async () => {
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Action title" }));
    await user.type(screen.getByRole("textbox", { name: "Action title" }), "   ");
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an action title");
    expect(screen.getByRole("form")).toBeVisible();
  });

  it("does not label owner edits as a verified new scope", async () => {
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Owner" }));
    await user.type(screen.getByRole("textbox", { name: "Owner" }), "Agency lead");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Agency lead")).toBeVisible();
    expect(screen.queryByText(/Scope changed/)).not.toBeInTheDocument();
  });

  it("saves a demo snapshot and marks subsequent ordering changes unsaved without network or storage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(screen.getByRole("button", { name: "Save demo plan" }));
    expect(screen.getByRole("status")).toHaveTextContent("Demo plan saved. It applies only within this demo.");
    expect(screen.getByText("Current plan matches the saved demo.")).toBeVisible();
    await user.click(first().getByRole("button", { name: "Move down" }));
    expect(screen.getByText("Changes since the last demo save.")).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled();
  });

  it("requires confirmation before restoring, including discarding an open edit", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup(); render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Move down" }));
    await user.click(screen.getByRole("button", { name: "Restore initial suggestions" }));
    expect(rows()[0]).toHaveAttribute("data-action-id", "business-contact");
    await user.click(first().getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save demo plan" })).toBeDisabled();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Restore initial suggestions" }));
    expect(rows()[0]).toHaveAttribute("data-action-id", "core-service");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByText("Demo plan not saved.")).toBeVisible();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("supports drag reorder without trusting external drag data", () => {
    const { container } = render(<ActionPlanDemo />);
    fireEvent.drop(rows()[2], { dataTransfer: { getData: () => "core-service" } });
    expect(rows()[0]).toHaveAttribute("data-action-id", "core-service");
    const handle = container.querySelector('[draggable="true"]')!;
    fireEvent.dragStart(handle, { dataTransfer: { setData: vi.fn(), effectAllowed: "" } });
    fireEvent.dragOver(rows()[2], { dataTransfer: { dropEffect: "" } });
    fireEvent.drop(rows()[2]);
    expect(rows()[2]).toHaveAttribute("data-action-id", "core-service");
  });

  it("starts fresh on remount and does not leak changes between visitors", async () => {
    const user = userEvent.setup(); const view = render(<ActionPlanDemo />);
    await user.click(first().getByRole("button", { name: "Move down" }));
    await user.click(screen.getByRole("button", { name: "Save demo plan" }));
    view.unmount(); render(<ActionPlanDemo />);
    expect(rows()[0]).toHaveAttribute("data-action-id", "core-service");
    expect(screen.getByText("Demo plan not saved.")).toBeVisible();
  });
});

describe("demo ordering", () => {
  it("does not mutate inputs and ignores invalid indices or identities", () => {
    const plan = createDemoPlan();
    expect(reorderDemoPlan(plan, plan[0].id, 2)[2].id).toBe(plan[0].id);
    expect(plan[0].id).toBe("core-service");
    expect(reorderDemoPlan(plan, "unknown", 1)).toBe(plan);
    expect(reorderDemoPlan(plan, plan[0].id, -1)).toBe(plan);
    expect(reorderDemoPlan(plan, plan[0].id, 3)).toBe(plan);
  });
});
