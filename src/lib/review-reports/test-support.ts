import fixture from "./contracts/fixture.json";
import {initialReviewRevision,parseReviewReport,type SavedReviewRevision} from "./delivery";
export function deliveryFixture(zero=false){
  const report=parseReviewReport(structuredClone(zero?fixture.reports.zero_actions:fixture.reports.baseline));
  const content=initialReviewRevision(report);content.status="approved";
  const saved:SavedReviewRevision={id:"72000000-0000-4000-8000-000000000001",report_id:report.id,user_id:content.user_id,case_id:content.case_id,
    revision:1,status:"approved",approved_at:"2026-12-19T08:00:00Z",content};return {report,saved};
}
