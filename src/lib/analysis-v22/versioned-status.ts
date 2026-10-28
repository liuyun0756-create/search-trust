import type { TaskStatusResponse, ValidationResult } from "./contracts";
import { parseTaskStatusResponse } from "./validate";
import { validateCompletedCapabilityTask, type CompletedCapabilityTask } from "../report-capability/runtime";

export type VersionedTaskStatus = TaskStatusResponse | (CompletedCapabilityTask & { database_report_id?: string | null });

/** Polling and streaming share this parser; do not cast an unknown event to a task. */
export function parseVersionedTaskStatus(value: unknown, jobId: string, caseId: string): ValidationResult<VersionedTaskStatus> {
  const invalid: ValidationResult<VersionedTaskStatus> = { ok: false, issues: [{ path: "/", message: "The task response is invalid." }] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const { database_report_id: databaseReportId, ...payload } = value as Record<string, unknown>;
  if (databaseReportId !== undefined && databaseReportId !== null
    && (typeof databaseReportId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseReportId))) return invalid;
  if ("schema_version" in payload) {
    if (!validateCompletedCapabilityTask(payload) || payload.job_id !== jobId || payload.report_reference.case_id !== caseId
      || (databaseReportId != null && databaseReportId !== payload.report_reference.report_id)) return invalid;
    return { ok: true, value: { ...payload, database_report_id: databaseReportId as string | null | undefined } };
  }
  const parsed = parseTaskStatusResponse(payload);
  if (!parsed.ok || parsed.value.job_id !== jobId
    || (parsed.value.report && parsed.value.report.identity.case_id !== caseId)) return invalid;
  return { ok: true, value: { ...parsed.value, database_report_id: databaseReportId as string | null | undefined } };
}

export function completedReportId(task: VersionedTaskStatus): string | null {
  if (task.status !== "succeeded") return null;
  return "report_reference" in task ? task.report_reference.report_id : task.database_report_id ?? null;
}
