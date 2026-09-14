export interface VerifiedStartBinding {
  job_id: string;
  created: boolean;
  idempotent: boolean;
  parent_report_id: string;
  gsc_snapshot_id: string;
  ga4_snapshot_id: string;
  public_gbp_snapshot_id: string;
  audit_credits: number;
}

export interface VerifiedTaskRequest {
  schema_version: "v22_verified_task_request_v1";
  case_id: string;
  parent_report_id: string;
  gsc_snapshot_id: string;
  ga4_snapshot_id: string;
  public_gbp_snapshot_id: string;
  input_checksum: `sha256:${string}`;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseVerifiedStartBinding(value: unknown): VerifiedStartBinding | null {
  if (!isRecord(value)
    || !isUuid(value.job_id) || !isUuid(value.parent_report_id)
    || !isUuid(value.gsc_snapshot_id) || !isUuid(value.ga4_snapshot_id) || !isUuid(value.public_gbp_snapshot_id)
    || typeof value.created !== "boolean" || typeof value.idempotent !== "boolean" || value.created === value.idempotent
    || typeof value.audit_credits !== "number" || !Number.isSafeInteger(value.audit_credits) || value.audit_credits < 0) return null;
  return {
    job_id: value.job_id, created: value.created, idempotent: value.idempotent,
    parent_report_id: value.parent_report_id, gsc_snapshot_id: value.gsc_snapshot_id,
    ga4_snapshot_id: value.ga4_snapshot_id, public_gbp_snapshot_id: value.public_gbp_snapshot_id,
    audit_credits: value.audit_credits,
  };
}
