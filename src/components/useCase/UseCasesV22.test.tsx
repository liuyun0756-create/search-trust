// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UseCasesV22 } from "./UseCasesV22";
import { useCaseScenes } from "./use-case-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics-client", () => ({ track: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("In Practice progressive stories", () => {
  it("renders six complete work stories with distinct evidence visuals", () => {
    const { container } = render(<UseCasesV22 />);

    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getAllByRole("img")).toHaveLength(6);

    for (const scene of useCaseScenes) {
      const article = container.querySelector(`#scene-${scene.number}`);
      expect(article).not.toBeNull();
      const story = within(article as HTMLElement);
      expect(story.getByRole("heading", { name: scene.title })).toBeVisible();
      expect(story.getByText(scene.problem)).toBeVisible();
      expect(story.getByText(scene.realIssue)).toBeVisible();
      expect(story.getByText(scene.decision)).toBeVisible();
      expect(story.getByText(scene.seoKeeps)).toBeVisible();
      expect(story.getAllByText("Illustrated method example · not a real client result")).toHaveLength(1);
      expect(scene.outcomes).toHaveLength(3);
    }
  });

  it("uses scroll links for chapters and route links for related pages", () => {
    render(<UseCasesV22 />);
    const nav = screen.getByRole("navigation", { name: "In Practice scenes" });

    for (const scene of useCaseScenes) {
      const links = within(nav).getAllByRole("link", { name: new RegExp(scene.shortTitle, "i") });
      expect(links[0]).toHaveAttribute("href", `#scene-${scene.number}`);
    }

    expect(screen.getByRole("link", { name: /complete report example/i })).toHaveAttribute("href", "/sample-report");
  });

  it("opens and closes the mobile scene directory", async () => {
    const user = userEvent.setup();
    render(<UseCasesV22 />);
    const button = screen.getByRole("button", { name: /all scenes/i });

    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(within(screen.getByRole("navigation", { name: "In Practice scenes" })).getAllByRole("link", { name: /new page or improve one/i })[0]);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
