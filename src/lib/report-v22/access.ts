import type { Report } from "../../types/database";
import type { SearchTrustReportV2_2 } from "./generated/types";
import { validateReportV22 } from "./validate";

type StoredReportV22 = Pick<Report, "case_id" | "report_v2_2">;

export type SelectReportV22Result =
  | { ok: true; report: SearchTrustReportV2_2 }
  | { ok: false; reason: "not_found" | "invalid" };

export function selectValidatedReportV22(
  storedReport: StoredReportV22 | null,
  caseId: string,
): SelectReportV22Result {
  if (!storedReport || storedReport.case_id !== caseId || !storedReport.report_v2_2) {
    return { ok: false, reason: "not_found" };
  }

  const validation = validateReportV22(storedReport.report_v2_2);
  if (!validation.ok || validation.report.identity.case_id !== caseId) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, report: validation.report };
}
