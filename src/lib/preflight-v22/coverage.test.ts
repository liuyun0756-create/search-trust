import { describe, expect, it } from "vitest";

import { mapCoverage } from "./coverage";

const modules = [
  { module_key: "competitor_analysis" as const, available: true, reason: "Candidates confirmed." },
  { module_key: "public_gbp" as const, available: false, reason: "Public profile not found." },
];

describe("coverage mapping", () => {
  it("marks one or two competitors as limited and three as available", () => {
    expect(mapCoverage(modules, [], 1)[0].status).toBe("limited");
    expect(mapCoverage(modules, [], 2)[0].status).toBe("limited");
    expect(mapCoverage(modules, [], 3)[0].status).toBe("available");
  });

  it("strictly blocks competitor coverage at zero", () => {
    expect(mapCoverage(modules, [], 0)[0]).toEqual(expect.objectContaining({ status: "blocked", available: false }));
  });

  it("does not treat a missing public GBP as matched or available", () => {
    expect(mapCoverage(modules, [], 3)[1].status).toBe("unavailable");
  });
});
