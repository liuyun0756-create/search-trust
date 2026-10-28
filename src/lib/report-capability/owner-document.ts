import { projectCapabilityReport } from "./projection";
import type { CapabilityRepository } from "./repository";
import { initialCapabilityRevision } from "./revision";
import { deliveryOrderConstraints } from "./order";

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
    document: projectCapabilityReport(report, approved?.content),
    version: report.version,
    generatedAt: report.generated_at,
    approvedRevision: approved?.revision ?? null,
    hasApproved: revision?.status === "approved",
    implementationRevisionId: report.report_type === "verified_execution" && revision?.status === "approved" ? revision.id : null,
    pendingDraft: revision?.status === "draft",
    deliveryRevision: revision?.revision ?? 0,
    deliveryStatus: revision?.status ?? "original",
    orderConstraints: deliveryOrderConstraints(report),
    editable: revision ? { ...revision.content, expected_revision: revision.revision } : initialCapabilityRevision(report),
  };
}
