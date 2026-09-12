import { describe, expect, it, vi } from "vitest";

import {
  APPROVED_RELEASE_TARGETS,
  assertControlConfirmations,
  buildControlPlan,
  executeMutationPlan,
  parseControlArguments,
} from "../../../scripts/control-v22-public-entry.mjs";

describe("V2.2 public entry operational control", () => {
  it("is dry-run by default and requires an explicit direction", () => {
    expect(parseControlArguments(["close"])).toMatchObject({ direction: "close", execute: false });
    expect(parseControlArguments(["open", "--execute"])).toMatchObject({ direction: "open", execute: true });
    expect(() => parseControlArguments([])).toThrow("CONTROL_DIRECTION_REQUIRED");
    expect(() => parseControlArguments(["toggle"])).toThrow("CONTROL_DIRECTION_REQUIRED");
  });

  it("requires exact confirmation for every production target", () => {
    const targets = APPROVED_RELEASE_TARGETS;
    const confirmations = {
      vercelProject: targets.vercel.projectId,
      railwayProject: targets.railway.projectId,
      railwayEnvironment: targets.railway.environmentId,
      railwayWeb: targets.railway.webServiceId,
      railwayWorker: targets.railway.workerServiceId,
    };
    expect(() => assertControlConfirmations(confirmations)).not.toThrow();
    for (const key of Object.keys(confirmations) as Array<keyof typeof confirmations>) {
      expect(() => assertControlConfirmations({ ...confirmations, [key]: "wrong-target" })).toThrow();
    }
  });

  it("constructs only the approved close and open variable commands", () => {
    for (const direction of ["close", "open"] as const) {
      const plan = buildControlPlan(direction);
      const value = direction === "open" ? "true" : "false";
      const serialized = JSON.stringify(plan.commands);
      expect(plan.commands[0].args).toEqual(expect.arrayContaining([
        "V22_PUBLIC_ENTRY_ENABLED", "production", "--value", value,
      ]));
      expect(serialized).toContain(`V22_ANALYZE_ENABLED=${value}`);
      expect(serialized).toContain(`V22_PREFLIGHT_ENABLED=${value}`);
      expect(serialized).toContain(`V22_COMPETITOR_DISCOVERY_ENABLED=${value}`);
      expect(serialized).not.toMatch(/supabase|\bsql\b|truncate|delete from/i);
    }
  });

  it("executes the fixed plan through injectable fake executables", () => {
    const calls: Array<{ executable: string; args: string[] }> = [];
    const fake = vi.fn((executable: string, args: string[]) => {
      calls.push({ executable, args });
      return "";
    });
    const plan = buildControlPlan("close");
    executeMutationPlan(plan, fake);
    expect(fake).toHaveBeenCalledTimes(4);
    expect(calls.map((call) => call.executable)).toEqual(["npx", "railway", "railway", "npx"]);
    expect(calls.every((call) => call.args.includes("--project") || call.args.includes("redeploy"))).toBe(true);
  });
});
