import { validateReportV22 } from "../report-v22/validate";
import { validateCapabilityReport } from "./validate";

/** Explicit dispatch: never fills historical reports with invented new fields. */
export function readVersionedReport(value: unknown) {
  const legacy = validateReportV22(value);
  if (legacy.ok) return { ok: true, version: "2.2.1", report: legacy.report } as const;
  const capability = validateCapabilityReport(value);
  if (capability.ok) return { ok: true, version: "2.2.2", report: capability.report } as const;
  return { ok: false, code: "REPORT_CONTRACT_INVALID" } as const;
}
