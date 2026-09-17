import type { DataGap, ModuleAvailability } from "./contracts";

export type CoverageStatus = "available" | "limited" | "unavailable" | "blocked" | "not_connected";

export interface CoverageItem extends ModuleAvailability {
  status: CoverageStatus;
}

const CONFIRMED_SCOPE_GAPS = new Set([
  "BUSINESS_IDENTITY_UNCONFIRMED",
  "OPERATING_MODEL_MISSING",
  "PRIMARY_SERVICE_MISSING",
  "TARGET_MARKET_MISSING",
]);

export function resolveCoverageAfterConfirmation(
  modules: ModuleAvailability[],
  gaps: DataGap[],
  discoveryCompleted: boolean,
): { modules: ModuleAvailability[]; gaps: DataGap[] } {
  const resolvedGaps = new Set(CONFIRMED_SCOPE_GAPS);
  if (discoveryCompleted) resolvedGaps.add("COMPETITOR_DISCOVERY_PENDING");

  return {
    modules: modules.map((module) => {
      if (!discoveryCompleted) return module;
      if (module.module_key === "serp_organic") {
        return {
          ...module,
          available: true,
          reason: "Market search evidence was collected for the confirmed service and location.",
        };
      }
      if (module.module_key === "competitor_analysis") {
        return {
          ...module,
          available: true,
          reason: "Provider-backed competitor discovery completed and the competitive set was confirmed.",
        };
      }
      return module;
    }),
    gaps: gaps.filter((gap) => !resolvedGaps.has(gap.gap_code)),
  };
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
