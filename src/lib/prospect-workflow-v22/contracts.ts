export interface ProspectWorkflowReservation {
  workflow_id: string;
  discovery_job_id: string;
  charge_state: "reserved" | "consumed" | "compensated";
  created: boolean;
  idempotent: boolean;
  credit_balance: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function parseProspectWorkflowReservation(value: unknown): ProspectWorkflowReservation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isUuid(row.workflow_id) || !isUuid(row.discovery_job_id)
    || !["reserved", "consumed", "compensated"].includes(String(row.charge_state))
    || typeof row.created !== "boolean" || typeof row.idempotent !== "boolean"
    || row.created === row.idempotent
    || !Number.isSafeInteger(row.credit_balance) || (row.credit_balance as number) < 0) return null;
  return row as unknown as ProspectWorkflowReservation;
}
