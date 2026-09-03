import type { DataGap, ModuleAvailability } from "./contracts";

export type CoverageStatus = "available" | "limited" | "unavailable" | "blocked" | "not_connected";

export interface CoverageItem extends ModuleAvailability {
  status: CoverageStatus;
}

export function mapCoverage(
  modules: ModuleAvailability[],
  gaps: DataGap[],
  competitorCount: number,
): CoverageItem[] {
  const hasBlockingGap = gaps.some((gap) => gap.blocking);
  return modules.map((module) => {
    if (module.module_key === "competitor_analysis") {
      if (competitorCount === 0) return { ...module, available: false, status: "blocked" };
      if (competitorCount < 3) return { ...module, available: true, status: "limited" };
    }
    if (!module.available) {
      const status = module.module_key === "public_gbp" ? "unavailable" : hasBlockingGap ? "blocked" : "unavailable";
      return { ...module, status };
    }
    return { ...module, status: "available" };
  });
}
