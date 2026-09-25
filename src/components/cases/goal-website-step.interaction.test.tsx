// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GoalWebsiteStep } from "./goal-website-step";

describe("GoalWebsiteStep interactions", () => {
  it("submits the chosen job, trimmed website and optional public profile", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GoalWebsiteStep initialGoal="win_new_client" initialSiteUrl="" initialGbpUrl={null} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: /Serve a client/ }));
    await user.type(screen.getByLabelText("Business website"), "  searchtrust-e2e.example.invalid  ");
    await user.click(screen.getByRole("button", { name: /Google Business Profile link/ }));
    expect(screen.getByRole("button", { name: /Google Business Profile link/ })).toHaveAttribute("aria-expanded", "true");
    await user.type(screen.getByLabelText("Google Business Profile link"), "  https://gbp.searchtrust-e2e.example.invalid/location  ");
    await user.click(screen.getByRole("button", { name: /Check this business/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      goal: "work_existing_client",
      site_url: "searchtrust-e2e.example.invalid",
      gbp_url: "https://gbp.searchtrust-e2e.example.invalid/location",
    });
  });
});
