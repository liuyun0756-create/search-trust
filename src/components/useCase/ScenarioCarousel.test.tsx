// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ScenarioCarousel } from "./ScenarioCarousel";
import { practiceScenarios } from "./practice-scenarios";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("does not replace a deep-link selection while initial layout has no width", () => {
  vi.useFakeTimers();
  const change = vi.fn();
  render(<ScenarioCarousel items={practiceScenarios.slice(0, 2)} activeIndex={1}
    onActiveIndexChange={change} isVisible label="Scenes" />);
  act(() => { vi.advanceTimersByTime(300); });
  expect(change).not.toHaveBeenCalled();
});

it("keeps a reader's horizontal movement when a late resize arrives", () => {
  vi.useFakeTimers();
  let resize = () => {};
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
  const change = vi.fn();
  render(<ScenarioCarousel items={practiceScenarios.slice(0, 2)} activeIndex={0}
    onActiveIndexChange={change} isVisible label="Scenes" />);
  const viewport = screen.getByRole("region", { name: "Scenes" });
  Object.defineProperties(viewport, { scrollWidth: { value: 800 }, clientWidth: { value: 400 } });
  const cards = viewport.querySelectorAll("article");
  Object.defineProperty(cards[1], "offsetLeft", { value: 400 });
  fireEvent.pointerDown(viewport);
  viewport.scrollLeft = 400;
  fireEvent.scroll(viewport);
  act(() => { resize(); vi.advanceTimersByTime(140); });
  expect(viewport.scrollLeft).toBe(400);
  expect(change).toHaveBeenCalledWith(1);
});
