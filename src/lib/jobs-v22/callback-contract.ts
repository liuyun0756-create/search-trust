export const JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export const JOB_STAGES = [
  "queued",
  "collecting_site",
  "collecting_market",
  "collecting_competitors",
  "building_evidence",
  "evaluating",
  "generating_copy",
  "validating",
  "persisting",
  "completed",
  "failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobStage = (typeof JOB_STAGES)[number];

export interface JobCallbackError {
  error_code: string;
  user_message: string;
  retryable: boolean;
  stage: JobStage;
  diagnostic_id: string;
}

export interface JobCallbackEvent {
  event_id: string;
  job_id: string;
  case_id: string;
  revision: number;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  attempt_count: number;
  heartbeat_at: string | null;
  completed_at: string | null;
  error: JobCallbackError | null;
  cost_counters: Record<string, number>;
  occurred_at: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,120}$/;
const EVENT_KEYS = new Set([
  "event_id", "job_id", "case_id", "revision", "status", "stage", "progress", "message",
  "attempt_count", "heartbeat_at", "completed_at", "error", "cost_counters", "occurred_at",
]);
const ERROR_KEYS = new Set(["error_code", "user_message", "retryable", "stage", "diagnostic_id"]);

export class JobCallbackValidationError extends Error {
  constructor() {
    super("Invalid v2.2 job callback payload.");
    this.name = "JobCallbackValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key)) && Object.keys(value).length === allowed.size;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function parseError(value: unknown): JobCallbackError | null {
  if (value === null) return null;
  if (!isRecord(value) || !exactKeys(value, ERROR_KEYS)) throw new JobCallbackValidationError();
  if (
    typeof value.error_code !== "string" || !ERROR_CODE_PATTERN.test(value.error_code) ||
    typeof value.user_message !== "string" || value.user_message.length < 1 || value.user_message.length > 500 ||
    typeof value.retryable !== "boolean" ||
    !JOB_STAGES.includes(value.stage as JobStage) ||
    typeof value.diagnostic_id !== "string" || !UUID_PATTERN.test(value.diagnostic_id)
  ) throw new JobCallbackValidationError();
  return value as unknown as JobCallbackError;
}

export function parseJobCallbackEvent(value: unknown): JobCallbackEvent {
  if (!isRecord(value) || !exactKeys(value, EVENT_KEYS)) throw new JobCallbackValidationError();
  if (
    typeof value.job_id !== "string" || !UUID_PATTERN.test(value.job_id) ||
    typeof value.case_id !== "string" || !UUID_PATTERN.test(value.case_id) ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
    !JOB_STATUSES.includes(value.status as JobStatus) ||
    !JOB_STAGES.includes(value.stage as JobStage) ||
    !Number.isInteger(value.progress) || Number(value.progress) < 0 || Number(value.progress) > 100 ||
    typeof value.message !== "string" || value.message.length < 1 || value.message.length > 500 ||
    !Number.isInteger(value.attempt_count) || Number(value.attempt_count) < 0 ||
    !(value.heartbeat_at === null || isTimestamp(value.heartbeat_at)) ||
    !(value.completed_at === null || isTimestamp(value.completed_at)) ||
    !isTimestamp(value.occurred_at) ||
    !isRecord(value.cost_counters) ||
    !Object.values(value.cost_counters).every((counter) => typeof counter === "number" && Number.isFinite(counter))
  ) throw new JobCallbackValidationError();

  const error = parseError(value.error);
  const revision = Number(value.revision);
  if (value.event_id !== `${value.job_id}:${revision}`) throw new JobCallbackValidationError();

  if (value.status === "succeeded") {
    if (value.stage !== "completed" || value.progress !== 100 || value.completed_at === null || error !== null) {
      throw new JobCallbackValidationError();
    }
  } else if (value.status === "failed") {
    if (value.stage !== "failed" || value.completed_at === null || error === null) {
      throw new JobCallbackValidationError();
    }
  } else if (value.completed_at !== null || error !== null) {
    throw new JobCallbackValidationError();
  }

  return { ...value, revision, error } as JobCallbackEvent;
}

