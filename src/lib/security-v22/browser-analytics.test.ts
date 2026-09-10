import { describe, expect, it } from "vitest";

import { shouldInitializeBrowserAnalytics } from "./browser-analytics";

describe("browser analytics security boundary", () => {
  it("disables third-party analytics for current and legacy share paths", () => {
    expect(shouldInitializeBrowserAnalytics("/share")).toBe(false);
    expect(shouldInitializeBrowserAnalytics("/share/legacy-token")).toBe(false);
    expect(shouldInitializeBrowserAnalytics("/cases/new")).toBe(true);
  });
});
