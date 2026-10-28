import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedReviewReport } from "../review-reports/types";
import { uuid } from "../review-reports/delivery";
import { parseReportDifference } from "./contracts";
export class ReportDifferenceRepository {
  constructor(private readonly db: SupabaseClient) {}
  async read(userId: string, caseId: string, report: VerifiedReviewReport) {
    if (
      ![userId, caseId, report.id].every(uuid) ||
      report.business.user_id !== userId ||
      report.business.case_id !== caseId
    )
      throw new Error("REVIEW_DIFFERENCE_UNAVAILABLE");
    const { data, error } = await this.db.rpc(
      "get_v22_review_report_difference",
      { p_user_id: userId, p_case_id: caseId, p_report_id: report.id },
    );
    if (error || data === undefined)
      throw new Error("REVIEW_DIFFERENCE_UNAVAILABLE");
    return data === null ? null : parseReportDifference(data, report);
  }
}
