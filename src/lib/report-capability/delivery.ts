import type { CapabilityReport, DeliveryRevision } from "./generated/types";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { projectCapabilityReport } from "./projection";
import { canonicalDigest } from "../verified-analysis-v22/digest";

export type SavedCapabilityRevision = {
  id: string; report_id: string; user_id: string; case_id: string; revision: number;
  status: "draft" | "approved"; approved_at: string | null; content: DeliveryRevision;
};
export type ApprovedCapabilityDelivery = {
  reportId: string; revisionId: string; revision: number; contentChecksum: string;
  reportType: CapabilityReport["report_type"]; reportVersion: number;
  evaluatedAt: string; siteUrl: string; service: string; market: string;
  document: ReturnType<typeof projectCapabilityReport>;
};

export function validateSavedCapabilityRevision(value: unknown, report: CapabilityReport): value is SavedCapabilityRevision {
  if (!validateCapabilityReport(report).ok || !value || typeof value !== "object") return false;
  const saved = value as Partial<SavedCapabilityRevision>;
  const m = report.input_manifest;
  return validateDeliveryRevision(saved.content, report) && saved.report_id === report.id
    && saved.user_id === m.user_id && saved.case_id === m.case_id
    && typeof saved.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(saved.id)
    && saved.status === saved.content.status && saved.revision === saved.content.expected_revision + 1
    && (saved.status === "approved" ? typeof saved.approved_at === "string" && Number.isFinite(Date.parse(saved.approved_at)) : saved.approved_at === null);
}

/** Server-only workflow: pass a persisted owner-scoped row, never browser input.
 * New exports/shares must use the latest approved row. Existing shares must
 * load their pinned revision ID, not silently resolve the latest revision.
 */
export function buildApprovedCapabilityDelivery(report: CapabilityReport, saved: SavedCapabilityRevision): ApprovedCapabilityDelivery {
  if (!validateSavedCapabilityRevision(saved, report) || saved.status !== "approved") throw new Error("Approved persisted report revision required");
  const m = report.input_manifest;
  return {
    reportId: report.id, revisionId: saved.id, revision: saved.revision,
    contentChecksum: canonicalDigest(saved.content), reportType: report.report_type, reportVersion: report.version,
    evaluatedAt: m.evaluated_at, siteUrl: m.business.site_url, service: m.business.primary_service, market: m.business.target_market,
    document: projectCapabilityReport(report, saved.content),
  };
}
