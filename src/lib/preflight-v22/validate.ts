import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import apiSchema from "../report-v22/contracts/api_v2.schema.json";

import type {
  CompetitorDiscoveryRequest,
  CompetitorDiscoveryRetryResponse,
  CompetitorDiscoveryStatusResponse,
  CompetitorDiscoveryTaskCreateResponse,
  PreflightRequest,
  PreflightResponse,
  ValidationResult,
} from "./contracts";

const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, removeAdditional: false, strict: true });
addFormats(ajv);

const definitions = apiSchema.$defs;
const root = (name: "PreflightRequest" | "PreflightResponse") => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $ref: `#/$defs/${name}`,
  $defs: definitions,
});

const uuid = { type: "string", format: "uuid" };
const timestamp = { type: "string", format: "date-time" };
const digest = { type: "string", pattern: "^sha256:[a-f0-9]{64}$" };
const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const discoveryStages = ["queued", "collecting_market", "ranking_candidates", "validating_supplements", "completed", "failed"];

const discoveryRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["case_id", "business_identity", "primary_service", "target_market", "queries"],
  properties: {
    case_id: uuid,
    business_identity: { $ref: "#/$defs/BusinessIdentity" },
    primary_service: { type: "string", minLength: 1, maxLength: 200 },
    target_market: { $ref: "#/$defs/TargetMarket" },
    queries: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    search_language: { type: "string", minLength: 2, maxLength: 12, pattern: "^[A-Za-z0-9-]+$" },
    search_device: { enum: ["desktop", "mobile"] },
    supplemental_website_urls: { type: "array", maxItems: 3, items: { type: "string", format: "uri" } },
  },
  $defs: definitions,
};

const candidate = { $ref: "#/$defs/CompetitorCandidate" };
const dataGap = { $ref: "#/$defs/DataGap" };
const discoveryResult = {
  type: "object",
  additionalProperties: false,
  required: ["discovery_id", "case_id", "input_digest", "candidate_digest", "market_snapshot_id", "market_snapshot_checksum", "candidates", "ready_for_confirmation", "data_gaps", "limitations", "created_at", "expires_at"],
  properties: {
    discovery_id: uuid, case_id: uuid, input_digest: digest, candidate_digest: digest,
    market_snapshot_id: uuid, market_snapshot_checksum: digest,
    candidates: { type: "array", maxItems: 6, items: candidate },
    ready_for_confirmation: { type: "boolean" },
    data_gaps: { type: "array", maxItems: 50, items: dataGap },
    limitations: { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 300 } },
    created_at: timestamp, expires_at: timestamp,
  },
};
const discoveryError = {
  type: "object", additionalProperties: false,
  required: ["error_code", "user_message", "retryable", "stage", "diagnostic_id"],
  properties: {
    error_code: { type: "string", pattern: "^[A-Z0-9_]+$", minLength: 1, maxLength: 120 },
    user_message: { type: "string", minLength: 1, maxLength: 500 },
    retryable: { type: "boolean" }, stage: { enum: discoveryStages }, diagnostic_id: uuid,
  },
};
const statusResponseSchema = {
  type: "object", additionalProperties: false,
  required: ["discovery_job_id", "status", "stage", "progress", "message", "result", "error", "created_at", "updated_at"],
  properties: {
    discovery_job_id: uuid,
    status: { enum: ["queued", "running", "succeeded", "failed"] },
    stage: { enum: discoveryStages },
    progress: { type: "integer", minimum: 0, maximum: 100 },
    message: { type: "string", minLength: 1, maxLength: 500 },
    result: nullable(discoveryResult), error: nullable(discoveryError), created_at: timestamp, updated_at: timestamp,
  },
  $defs: definitions,
};

const validatePreflightRequest = ajv.compile<PreflightRequest>(root("PreflightRequest"));
const validatePreflightResponseStructure = ajv.compile<PreflightResponse>(root("PreflightResponse"));
const validateDiscoveryRequest = ajv.compile<CompetitorDiscoveryRequest>(discoveryRequestSchema);
const validateDiscoveryCreate = ajv.compile<CompetitorDiscoveryTaskCreateResponse>({
  type: "object", additionalProperties: false, required: ["discovery_job_id", "status", "estimated_seconds"],
  properties: { discovery_job_id: uuid, status: { const: "queued" }, estimated_seconds: { type: "integer", minimum: 1, maximum: 1800 } },
});
const validateDiscoveryStatusStructure = ajv.compile<CompetitorDiscoveryStatusResponse>(statusResponseSchema);
const validateDiscoveryRetry = ajv.compile<CompetitorDiscoveryRetryResponse>({
  type: "object", additionalProperties: false, required: ["discovery_job_id", "status", "attempt_count"],
  properties: { discovery_job_id: uuid, status: { const: "queued" }, attempt_count: { type: "integer", minimum: 2 } },
});

function issues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((error) => ({ path: error.instancePath || "/", message: error.message ?? "Invalid value." }));
}

function structural<T>(validator: ValidateFunction<T>, value: unknown): ValidationResult<T> {
  return validator(value) ? { ok: true, value } : { ok: false, issues: issues(validator.errors) };
}

export const parsePreflightRequest = (value: unknown) => structural(validatePreflightRequest, value);
export function parsePreflightResponse(value: unknown): ValidationResult<PreflightResponse> {
  const parsed = structural(validatePreflightResponseStructure, value);
  if (!parsed.ok) return parsed;
  const expected = ["business_name", "phone", "address", "service_area"];
  const invalidIndex = parsed.value.identity_candidates.findIndex(
    (candidate) => candidate.field_comparisons.map((item) => item.field).join("|") !== expected.join("|"),
  );
  return invalidIndex === -1 ? parsed : {
    ok: false,
    issues: [{ path: `/identity_candidates/${invalidIndex}/field_comparisons`, message: "All four comparisons must be present in contract order." }],
  };
}
export function parseDiscoveryRequest(value: unknown): ValidationResult<CompetitorDiscoveryRequest> {
  const parsed = structural(validateDiscoveryRequest, value);
  if (!parsed.ok) return parsed;
  const queries = parsed.value.queries.map((query) => query.trim().toLocaleLowerCase());
  if (queries.some((query) => !query) || new Set(queries).size !== queries.length) {
    return { ok: false, issues: [{ path: "/queries", message: "Queries must be nonblank and unique." }] };
  }
  const domains = (parsed.value.supplemental_website_urls ?? []).map((url) => {
    try { return new URL(url).hostname.toLocaleLowerCase().replace(/^www\./, ""); } catch { return ""; }
  });
  if (new Set(domains).size !== domains.length) {
    return { ok: false, issues: [{ path: "/supplemental_website_urls", message: "Supplemental websites must use unique domains." }] };
  }
  return parsed;
}
export const parseDiscoveryCreateResponse = (value: unknown) => structural(validateDiscoveryCreate, value);
export function parseDiscoveryStatusResponse(value: unknown): ValidationResult<CompetitorDiscoveryStatusResponse> {
  const parsed = structural(validateDiscoveryStatusStructure, value);
  if (!parsed.ok) return parsed;
  const { status, stage, progress, result, error } = parsed.value;
  const valid = status === "succeeded"
    ? stage === "completed" && progress === 100 && result !== null && error === null
    : status === "failed"
      ? stage === "failed" && result === null && error !== null
      : result === null && error === null;
  return valid ? parsed : { ok: false, issues: [{ path: "/", message: "Discovery lifecycle fields are inconsistent." }] };
}
export const parseDiscoveryRetryResponse = (value: unknown) => structural(validateDiscoveryRetry, value);
