import { editableVisibility } from "./action-visibility";
import { projectCapabilityReport } from "./projection";
import type { CapabilityRepository } from "./repository";
import { initialCapabilityRevision } from "./revision";
import { deliveryOrderConstraints } from "./order";
import { observationWarnings } from "./reader-copy";

/** Completed entitlement precedes any report or revision content read. */
export async function loadCapabilityOwnerDocument(
  repository: Pick<CapabilityRepository, "loadCompletedReport" | "loadRevision">,
  userId: string, caseId: string, reportId: string, clientView: boolean,
) {
  const report = await repository.loadCompletedReport(userId, caseId, reportId);
  if (!report) return null;
  const revision = await repository.loadRevision(userId, caseId, report);
  const approved = clientView && revision?.status === "approved" ? revision : null;
  return {
    document: projectCapabilityReport(report, approved?.content, !!approved),
    observationWarnings: observationWarnings(report),
    version: report.version,
    identityReviewAvailable: report.report_type === "prospect"
      && ["v22_capability_public_v13", "v22_capability_public_v14", "v22_capability_public_v15", "v22_capability_public_v16", "v22_capability_public_v17", "v22_capability_public_v18", "v22_capability_public_v20"].includes(report.input_manifest.ruleset_version),
    generatedAt: report.generated_at,
    approvedRevision: approved?.revision ?? null,
    hasApproved: revision?.status === "approved",
    implementationRevisionId: report.report_type === "verified_execution" && revision?.status === "approved" ? revision.id : null,
    pendingDraft: revision?.status === "draft",
    deliveryRevision: revision?.revision ?? 0,
    deliveryStatus: revision?.status ?? "original",
    candidateReport: ["2.2.7", "2.2.8", "2.2.9", "2.2.10", "2.2.11", "2.2.12", "2.2.13", "2.2.15"].includes(report.schema_version) ? report : undefined,
    orderConstraints: deliveryOrderConstraints(report),
    editable: revision ? editableVisibility(report,{ ...revision.content, expected_revision: revision.revision }) : initialCapabilityRevision(report),
  };
}
