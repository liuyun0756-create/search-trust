// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodNavigation, methodChapters } from "./MethodNavigation";
import { MethodJourney } from "./MethodJourney";

afterEach(() => vi.restoreAllMocks());

describe("method chapter navigation", () => {
  it("opens the compact menu and closes it with Escape, returning focus", () => {
    render(<MethodJourney><MethodNavigation /></MethodJourney>);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const link = screen.getByRole("link", { name: /Discover/ });
    link.focus(); fireEvent.keyDown(link, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("tracks the current chapter, closes on selection and focuses its heading", () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frame = callback; return 1; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = methodChapters.findIndex((chapter) => this.querySelector?.(`#${chapter.id}`));
      return { top: index >= 0 && index <= 2 ? 150 : 500 } as DOMRect;
    });
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<MethodJourney><MethodNavigation />{methodChapters.map((chapter) => <section data-method-stage key={chapter.id}><h2 id={chapter.id}>{chapter.label}</h2></section>)}</MethodJourney>);
    act(() => frame?.(0));
    const navigation = within(screen.getByRole("navigation"));
    expect(navigation.getByRole("link", { name: /Prioritize/ })).toHaveAttribute("aria-current", "step");
    expect(navigation.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(navigation.getByRole("link", { name: /Deliver/ }));
    act(() => frame?.(0));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("delivery-title")).toHaveFocus();
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
