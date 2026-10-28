import type { projectCapabilityReport } from "./projection";

type FullDocument = ReturnType<typeof projectCapabilityReport>;

/** Display fields only. Does not need owner IDs, snapshot IDs or a manifest. */
export type CapabilityReadingDocument = Pick<FullDocument,
  "title" | "summary" | "clientNote" | "actionState" | "limitations" | "actions"
> & {
  evidence: Pick<FullDocument["evidence"][number],
    "id" | "object" | "field_path" | "value" | "unit" | "observed_at"
  >[];
  findings: Pick<FullDocument["findings"][number],
    "id" | "target" | "observed_fact" | "judgment" | "impact_path" |
    "comparison_scope" | "observed_at" | "evidence_ids" | "limitations"
  >[];
};
