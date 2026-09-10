// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { discoveryStatusFixture } from "../../../e2e/fixtures/preflight";
import { CompetitorConfirmationStep } from "./competitor-confirmation-step";

describe("CompetitorConfirmationStep interactions", () => {
  it("blocks zero competitors and submits a known website for validation", async () => {
    const user = userEvent.setup();
    const onRerun = vi.fn();
    render(<CompetitorConfirmationStep status={discoveryStatusFixture("zero")} selectedIds={[]} onSelectionChange={vi.fn()} onConfirm={vi.fn()} onRerun={onRerun} onEditScope={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "At least one competitor is required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add and validate one competitor/ })).toBeDisabled();
    await user.type(screen.getByLabelText(/Add known competitor websites/), "competitor-added.searchtrust-e2e.example.invalid");
    await user.click(screen.getByRole("button", { name: "Validate & rerun" }));
    expect(onRerun).toHaveBeenCalledWith(["competitor-added.searchtrust-e2e.example.invalid"]);
  });

  it("permits progress after one explicit competitor selection", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState<string[]>([]);
      return <CompetitorConfirmationStep status={discoveryStatusFixture("succeeded")} selectedIds={selected} onSelectionChange={setSelected} onConfirm={onConfirm} onRerun={vi.fn()} onEditScope={vi.fn()} />;
    }
    render(<Harness />);

    const first = screen.getByRole("checkbox", { name: /Synthetic Competitor 1/ });
    await user.click(first);
    expect(screen.getByText("Limited coverage")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Confirm competitors/ });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
