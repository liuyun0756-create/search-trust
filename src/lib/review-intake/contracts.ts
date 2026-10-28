import { uuid } from "../implementation-records/contracts";
import type { Identity } from "../review-decisions/types";
export type Selection = {
  job_id: string;
  review_id: string;
  review_checksum: string;
  decision_id: string;
  decision_checksum: string;
};
export type Command =
  | { operation: "start"; selection: Selection; confirmed: true }
  | { operation: "status"; job_id: string }
  | { operation: "find"; review_id: string; decision_id: string };
export type ReviewJob = {
  schema_version: "v22_review_job_v1";
  job_id: string;
  user_id: string;
  case_id: string;
  base_report_id: string;
  selection: Selection;
  input_checksum: string;
  revision: number;
  run_generation: number;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  deadline_at: string;
  updated_at: string;
  report_id: string | null;
  credit_state: "reserved" | "consumed" | "compensated";
  error_code: "TECHNICAL_FAILURE" | null;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, k: string[]) =>
  Object.keys(v).length === k.length && k.every((x) => x in v);
const hash = (v: unknown) =>
  typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v);
export function selection(v: unknown): v is Selection {
  return (
    record(v) &&
    keys(v, [
      "job_id",
      "review_id",
      "review_checksum",
      "decision_id",
      "decision_checksum",
    ]) &&
    [v.job_id, v.review_id, v.decision_id].every(uuid) &&
    hash(v.review_checksum) &&
    hash(v.decision_checksum)
  );
}
export function command(v: unknown): v is Command {
  if (!record(v)) return false;
  if (v.operation === "start")
    return (
      keys(v, ["operation", "selection", "confirmed"]) &&
      v.confirmed === true &&
      selection(v.selection)
    );
  if (v.operation === "status")
    return keys(v, ["operation", "job_id"]) && uuid(v.job_id);
  return (
    v.operation === "find" &&
    keys(v, ["operation", "review_id", "decision_id"]) &&
    uuid(v.review_id) &&
    uuid(v.decision_id)
  );
}
export function reviewJob(
  v: unknown,
  identity: Identity,
  c: Command,
): v is ReviewJob {
  if (
    !record(v) ||
    !keys(v, [
      "schema_version",
      "job_id",
      "user_id",
      "case_id",
      "base_report_id",
      "selection",
      "input_checksum",
      "revision",
      "run_generation",
      "status",
      "created_at",
      "deadline_at",
      "updated_at",
      "report_id",
      "credit_state",
      "error_code",
    ]) ||
    v.schema_version !== "v22_review_job_v1" ||
    !uuid(v.job_id) ||
    !selection(v.selection) ||
    !hash(v.input_checksum)
  )
    return false;
  if (
    v.user_id !== identity.ownerId ||
    v.case_id !== identity.caseId ||
    v.base_report_id !== identity.reportId ||
    v.selection.job_id !== v.job_id
  )
    return false;
  if (
    ![v.revision, v.run_generation].every(
      (x) => Number.isSafeInteger(x) && Number(x) >= 1,
    )
  )
    return false;
  const dates = [v.created_at, v.deadline_at, v.updated_at];
  if (
    !dates.every(
      (x) =>
        typeof x === "string" && /Z$/.test(x) && Number.isFinite(Date.parse(x)),
    )
  )
    return false;
  if (Date.parse(String(v.deadline_at)) <= Date.parse(String(v.created_at)))
    return false;
  const chosen = v.selection;
  if (
    c.operation === "start" &&
    Object.keys(c.selection).some(
      (k) => c.selection[k as keyof Selection] !== chosen[k as keyof Selection],
    )
  )
    return false;
  if (c.operation === "status" && v.job_id !== c.job_id) return false;
  if (
    c.operation === "find" &&
    (v.selection.review_id !== c.review_id ||
      v.selection.decision_id !== c.decision_id)
  )
    return false;
  if (!["queued", "running", "succeeded", "failed"].includes(String(v.status)))
    return false;
  return (
    v.report_id === (v.status === "succeeded" ? v.job_id : null) &&
    v.credit_state ===
      (v.status === "succeeded"
        ? "consumed"
        : v.status === "failed"
          ? "compensated"
          : "reserved") &&
    v.error_code === (v.status === "failed" ? "TECHNICAL_FAILURE" : null)
  );
}
