import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import requestSchema from "./runtime-contracts/request.schema.json";
import completedSchema from "./runtime-contracts/completed.schema.json";
import dispatchSchema from "./runtime-contracts/dispatch.schema.json";

export type CapabilityTaskEnvelope = {
  schema_version: "v22_capability_request_envelope_v1";
  capability_request: { case_id: string; manifest_id: string; input_checksum: string; report_type: "prospect" | "verified_execution" };
};
export type CompletedCapabilityTask = {
  schema_version: "v22_capability_task_status_v1"; job_id: string; revision: number; run_generation: number;
  status: "succeeded"; stage: "completed"; progress: 100; message: string;
  report_reference: { report_id: string; case_id: string; schema_version: "2.2.2"; report_type: "prospect" | "verified_execution"; payload_checksum: string };
  created_at: string; deadline_at: string; updated_at: string;
};
const ajv = new Ajv2020({ strict: true, coerceTypes: false, useDefaults: false });
addFormats(ajv);
const request = ajv.compile<CapabilityTaskEnvelope>(requestSchema);
const completed = ajv.compile<CompletedCapabilityTask>(completedSchema);
export type CapabilityDispatch = {
  schema_version: "v22_capability_dispatch_v1"; user_id: string; case_id: string; job_id: string;
  idempotency_key: string; request: CapabilityTaskEnvelope; status: "queued" | "running" | "succeeded";
  run_generation: number; revision: number; attempt_count: number; cost_counters: Record<string, number>;
  created_at: string; deadline_at: string; completion: CompletedCapabilityTask | null;
};
const dispatch = ajv.compile<CapabilityDispatch>(dispatchSchema);

export const validateCapabilityTaskEnvelope = (value: unknown): value is CapabilityTaskEnvelope => request(value);
/** A completion reference is not an entitlement; loadCompletedReport still
 * checks owner and settlement before reading, editing or delivering a report.
 */
export function validateCompletedCapabilityTask(value: unknown): value is CompletedCapabilityTask {
  return completed(value) && value.job_id === value.report_reference.report_id
    && Date.parse(value.deadline_at) > Date.parse(value.created_at) && Date.parse(value.updated_at) >= Date.parse(value.created_at);
}

/** Server-side receipt. Do not send owner IDs, idempotency keys or costs to the browser. */
export function validateCapabilityDispatch(value: unknown): value is CapabilityDispatch {
  if (!dispatch(value) || value.case_id !== value.request.capability_request.case_id
    || Date.parse(value.deadline_at) <= Date.parse(value.created_at)
    || (value.status === "succeeded") !== (value.completion !== null)) return false;
  const c = value.completion;
  return !c || (validateCompletedCapabilityTask(c) && c.job_id === value.job_id
    && c.report_reference.case_id === value.case_id && c.report_reference.report_type === value.request.capability_request.report_type
    && c.run_generation === value.run_generation && Date.parse(c.created_at) === Date.parse(value.created_at)
    && Date.parse(c.deadline_at) === Date.parse(value.deadline_at));
}
