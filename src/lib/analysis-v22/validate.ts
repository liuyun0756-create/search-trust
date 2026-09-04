import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import apiSchema from "../report-v22/contracts/api_v2.schema.json";
import { validateReportV22 } from "../report-v22";
import type { AnalyzeRequest, TaskCreateResponse, TaskStatusResponse, ValidationResult } from "./contracts";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true });
addFormats(ajv);
const definitions = apiSchema.$defs;
const root = (name: "AnalyzeRequest" | "TaskCreateResponse" | "TaskStatusResponse") => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $ref: `#/$defs/${name}`,
  $defs: definitions,
});
const analyze = ajv.compile<AnalyzeRequest>(root("AnalyzeRequest"));
const create = ajv.compile<TaskCreateResponse>(root("TaskCreateResponse"));
const status = ajv.compile<TaskStatusResponse>(root("TaskStatusResponse"));

function issues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((error) => ({ path: error.instancePath || "/", message: error.message ?? "Invalid value." }));
}

function structural<T>(validator: ValidateFunction<T>, value: unknown): ValidationResult<T> {
  return validator(value) ? { ok: true, value } : { ok: false, issues: issues(validator.errors) };
}

export function parseAnalyzeRequest(value: unknown): ValidationResult<AnalyzeRequest> {
  const parsed = structural(analyze, value);
  if (!parsed.ok) return parsed;
  const queries = parsed.value.queries.map((query) => query.trim().toLocaleLowerCase());
  if (queries.some((query) => !query) || new Set(queries).size !== queries.length) {
    return { ok: false, issues: [{ path: "/queries", message: "Queries must be nonblank and unique." }] };
  }
  return parsed;
}

export const parseTaskCreateResponse = (value: unknown) => structural(create, value);

export function parseTaskStatusResponse(value: unknown): ValidationResult<TaskStatusResponse> {
  const parsed = structural(status, value);
  if (!parsed.ok) return parsed;
  const { status: state, stage, progress, report, error } = parsed.value;
  const lifecycleValid = state === "succeeded"
    ? stage === "completed" && progress === 100 && report !== null && error === null
    : state === "failed"
      ? stage === "failed" && report === null && error !== null
      : report === null && error === null;
  if (!lifecycleValid) return { ok: false, issues: [{ path: "/", message: "Task lifecycle fields are inconsistent." }] };
  if (report) {
    const validation = validateReportV22(report);
    if (!validation.ok) return { ok: false, issues: validation.errors.map(({ path, message }) => ({ path: `/report${path}`, message })) };
  }
  return parsed;
}
