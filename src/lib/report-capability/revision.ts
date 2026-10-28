import type { CapabilityReport, DeliveryRevision } from "./generated/types";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { validateCapabilityReport } from "./validate";

/** Server-side initial draft; unchanged approval is a first-class path. */
export function initialCapabilityRevision(report: CapabilityReport, expectedRevision = 0): DeliveryRevision {
  if (!validateCapabilityReport(report).ok || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Valid report and revision required");
  return {
    schema_version: "v22_delivery_revision_v1", report_id: report.id,
    user_id: report.input_manifest.user_id, case_id: report.input_manifest.case_id,
    expected_revision: expectedRevision, source_checksum: canonicalDigest(report), status: "draft",
    title: report.title, summary: report.summary, client_note: null,
    actions: structuredClone(report.actions).map(({ finding_ids: _findings, dependencies: _dependencies, ...action }) => action) as DeliveryRevision["actions"],
  };
}
