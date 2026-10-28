// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportScrollRegion } from "./ReportScrollRegion";
afterEach(cleanup);
it("lets a keyboard reader reach both ends without moving the outer page", () => {
  render(
    <ReportScrollRegion className="reader">
      <p>Report</p>
    </ReportScrollRegion>,
  );
  const reader = screen.getByRole("region");
  const scroll = vi.fn();
  reader.scrollTo = scroll;
  Object.defineProperty(reader, "scrollHeight", { value: 1800 });
  fireEvent.keyDown(reader, { key: "End" });
  expect(scroll).toHaveBeenLastCalledWith({ top: 1800, behavior: "instant" });
  fireEvent.keyDown(reader, { key: "Home" });
  expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
});
it("preserves descendant controls and modified navigation shortcuts", () => {
  render(
    <ReportScrollRegion className="reader">
      <input aria-label="Inside" />
    </ReportScrollRegion>,
  );
  const reader = screen.getByRole("region");
  const scroll = vi.fn();
  reader.scrollTo = scroll;
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Home" });
  fireEvent.keyDown(reader, { key: "Home", ctrlKey: true });
  fireEvent.keyDown(reader, { key: "ArrowDown" });
  expect(scroll).not.toHaveBeenCalled();
});
