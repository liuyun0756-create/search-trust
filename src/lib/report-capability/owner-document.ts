import { editableVisibility } from "./action-visibility";
import { projectCapabilityReport } from "./projection";
import type { CapabilityRepository } from "./repository";
import { initialCapabilityRevision } from "./revision";
import { deliveryOrderConstraints } from "./order";
import { observationWarnings } from "./reader-copy";
import { supportsIdentityReview } from "@/lib/identity-review/view";

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
    identityReviewAvailable: supportsIdentityReview(report.report_type, report.input_manifest.ruleset_version),
    identityInheritance: report.input_manifest.identity_inheritance ?? undefined,
    prospect: report.report_type === "prospect",
    generatedAt: report.generated_at,
    approvedRevision: approved?.revision ?? null,
    hasApproved: revision?.status === "approved",
    implementationRevisionId: report.report_type === "verified_execution" && revision?.status === "approved" ? revision.id : null,
    pendingDraft: revision?.status === "draft",
    deliveryRevision: revision?.revision ?? 0,
    deliveryStatus: revision?.status ?? "original",
    candidateReport: ["2.2.7", "2.2.8", "2.2.9", "2.2.10", "2.2.11", "2.2.12", "2.2.13", "2.2.15", "2.2.16", "2.2.17"].includes(report.schema_version) ? report : undefined,
    orderConstraints: deliveryOrderConstraints(report),
    editable: revision ? editableVisibility(report,{ ...revision.content, expected_revision: revision.revision }) : initialCapabilityRevision(report),
  };
}
