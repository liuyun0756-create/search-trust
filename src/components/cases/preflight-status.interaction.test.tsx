// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PreflightStatus } from "./preflight-status";

describe("PreflightStatus interactions", () => {
  it("offers an edit path when the same failed discovery cannot be retried", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <PreflightStatus
        kind="error"
        title="Competitor discovery needs attention"
        message="The target market could not be matched."
        onEdit={onEdit}
        editLabel="Edit business scope"
      />,
    );

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit business scope" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
