import fixture from "../review-decisions/contracts/fixture.json";
import type { Revision } from "../review-decisions/types";
import type { ReviewJob, Command } from "./contracts";
export const revision = fixture.revision as Revision;
export const identity = {
  ownerId: revision.user_id,
  caseId: revision.case_id,
  reportId: revision.report_id,
};
export const start: Command = {
  operation: "start",
  confirmed: true,
  selection: {
    job_id: "12121212-1212-4212-8212-121212121212",
    review_id: revision.review_id,
    review_checksum: revision.bundle_checksum,
    decision_id: revision.id,
    decision_checksum: revision.checksum,
  },
};
export function job(): ReviewJob {
  if (start.operation !== "start") throw Error();
  return {
    schema_version: "v22_review_job_v1",
    job_id: start.selection.job_id,
    user_id: identity.ownerId,
    case_id: identity.caseId,
    base_report_id: identity.reportId,
    selection: { ...start.selection },
    input_checksum: "sha256:" + "a".repeat(64),
    revision: 1,
    run_generation: 1,
    status: "queued",
    created_at: "2026-10-27T00:00:00Z",
    deadline_at: "2026-10-27T00:20:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    report_id: null,
    credit_state: "reserved",
    error_code: null,
  };
}
