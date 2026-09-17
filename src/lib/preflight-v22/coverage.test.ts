import { describe, expect, it } from "vitest";

import { mapCoverage, resolveCoverageAfterConfirmation } from "./coverage";

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

  it("removes resolved preflight gaps and exposes collected market evidence", () => {
    const resolved = resolveCoverageAfterConfirmation([
      ...modules,
      { module_key: "serp_organic" as const, available: false, reason: "Missing prerequisites." },
    ], [
      { gap_code: "BUSINESS_IDENTITY_UNCONFIRMED", message: "Confirm identity.", blocking: true, resolution: "Confirm it." },
      { gap_code: "COMPETITOR_DISCOVERY_PENDING", message: "Run discovery.", blocking: false, resolution: "Run it." },
      { gap_code: "PAGESPEED_UNAVAILABLE", message: "Unavailable.", blocking: false, resolution: "Configure it." },
    ], true);

    expect(resolved.gaps.map((gap) => gap.gap_code)).toEqual(["PAGESPEED_UNAVAILABLE"]);
    expect(resolved.modules.find((module) => module.module_key === "serp_organic")).toEqual(expect.objectContaining({ available: true }));
  });
});
