import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalDigest, canonicalJsonText } from "../verified-analysis-v22/digest";
import { validateReportV22 } from "../report-v22/validate";
import { validateAnalysisManifest, validateBusinessScope, validateCapabilityReport, validateDeliveryRevision } from "./validate";
import type { CapabilityReport } from "./generated/types";
import { buildApprovedCapabilityDelivery, validateSavedCapabilityRevision } from "./delivery";
import type { ApprovedCapabilityDelivery, SavedCapabilityRevision } from "./delivery";
import { capabilityWorkspaceItem } from "./workspace";

export class CapabilityPersistenceError extends Error {
  constructor(public readonly code: "CAPABILITY_INVALID" | "CAPABILITY_CONFLICT" | "CAPABILITY_UNAVAILABLE") {
    super(code === "CAPABILITY_CONFLICT" ? "This version changed. Reload before saving again." : "The report operation could not be completed.");
  }
}

function checkError(error: { code?: string } | null) {
  if (error) throw new CapabilityPersistenceError(error.code === "40001" ? "CAPABILITY_CONFLICT" : "CAPABILITY_UNAVAILABLE");
}

/** Construct only with the existing server-role client after authenticating the owner. */
export class CapabilityRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listCompletedReports(userId: string) {
    const { data, error } = await this.db.rpc("list_v22_completed_capability_reports", { p_user_id: userId });
    checkError(error);
    if (!Array.isArray(data)) throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
    try { return data.map((row: unknown) => capabilityWorkspaceItem(row, userId)); }
    catch { throw new CapabilityPersistenceError("CAPABILITY_INVALID"); }
  }

  async saveBusiness(userId: string, caseId: string, expectedRevision: number, value: unknown) {
    if (!validateBusinessScope(value) || value.user_id !== userId || value.case_id !== caseId
      || !Number.isInteger(expectedRevision) || expectedRevision < 0 || value.revision !== expectedRevision + 1) {
      throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    }
    const { data, error } = await this.db.rpc("save_v22_business_scope", {
      p_user_id: userId, p_case_id: caseId, p_expected_revision: expectedRevision, p_scope: value,
    }).single<Record<string, unknown>>();
    checkError(error);
    if (!data || data.id !== value.id || !validateBusinessScope(data.scope)
      || canonicalJsonText(data.scope) !== canonicalJsonText(value)) throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
    return data;
  }

  async freezeInput(userId: string, caseId: string, jobId: string, value: unknown, previousPayload?: unknown) {
    if (!validateAnalysisManifest(value) || value.user_id !== userId || value.case_id !== caseId || value.job_id !== jobId) {
      throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    }
    const { input_checksum: _checksum, ...content } = value;
    const { data, error } = await this.db.rpc("freeze_v22_analysis_manifest", {
      p_user_id: userId, p_case_id: caseId, p_job_id: jobId, p_manifest: value,
      p_canonical_content: canonicalJsonText(content),
      p_previous_canonical: previousPayload === undefined ? null : canonicalJsonText(previousPayload),
    }).single<Record<string, unknown>>();
    checkError(error);
    if (!data || !validateAnalysisManifest(data.payload) || data.payload.input_checksum !== value.input_checksum
      || canonicalJsonText(data.payload) !== canonicalJsonText(value)) throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
    return data.payload;
  }

  async storeReport(userId: string, caseId: string, value: unknown, runGeneration = 1): Promise<CapabilityReport> {
    const checked = validateCapabilityReport(value);
    if (!checked.ok || checked.report.input_manifest.user_id !== userId || checked.report.input_manifest.case_id !== caseId
      || !Number.isInteger(runGeneration) || runGeneration < 1) {
      throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    }
    const report = checked.report;
    if (report.changes.length) {
      const ref = report.input_manifest.previous_report!;
      let previous: unknown = await this.loadReport(userId, caseId, ref.report_id);
      if (!previous) {
        const { data, error } = await this.db.from("reports").select("report_v2_2")
          .eq("id", ref.report_id).eq("user_id", userId).eq("case_id", caseId).maybeSingle();
        checkError(error);
        previous = data?.report_v2_2;
      }
      const modern = validateCapabilityReport(previous);
      const legacy = validateReportV22(previous);
      const priorFindings = modern.ok ? new Map(modern.report.findings.map((f) => [f.id, canonicalDigest(f)]))
        : legacy.ok ? new Map(legacy.report.findings.map((f) => [f.finding_id, canonicalDigest(f)])) : null;
      const correctVersion = modern.ok ? modern.report.version === ref.version && modern.report.report_type === ref.report_type
        : legacy.ok && legacy.report.report_version.version_number === ref.version && legacy.report.report_version.report_type === ref.report_type
          && legacy.report.report_version.report_id === ref.report_id && legacy.report.identity.case_id === caseId;
      if (!priorFindings || !correctVersion || canonicalDigest(previous) !== ref.payload_checksum
        || report.changes.some((c) => priorFindings.get(c.finding_id) !== c.previous_fingerprint)) {
        throw new CapabilityPersistenceError("CAPABILITY_INVALID");
      }
    }
    const { data, error } = await this.db.rpc("store_v22_capability_report", {
      p_user_id: userId, p_case_id: caseId, p_job_id: report.id, p_payload: report, p_canonical_content: canonicalJsonText(report), p_run_generation: runGeneration,
    }).single<Record<string, unknown>>();
    checkError(error);
    if (!data || !validateCapabilityReport(data.payload).ok || canonicalJsonText(data.payload) !== canonicalJsonText(report)) throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
    return report;
  }

  async loadReport(userId: string, caseId: string, reportId: string): Promise<CapabilityReport | null> {
    const { data, error } = await this.db.from("capability_report_versions").select("id,user_id,case_id,payload")
      .eq("id", reportId).eq("user_id", userId).eq("case_id", caseId).maybeSingle();
    checkError(error);
    if (!data) return null;
    const checked = validateCapabilityReport(data.payload);
    if (!checked.ok || checked.report.id !== reportId || checked.report.input_manifest.user_id !== userId
      || checked.report.input_manifest.case_id !== caseId) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return checked.report;
  }

  /** Completed/consumed owner entitlement, never a fallback to a candidate. */
  async loadCompletedReport(userId: string, caseId: string, reportId: string): Promise<CapabilityReport | null> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (![userId, caseId, reportId].every((id) => uuid.test(id))) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    const { data, error } = await this.db.rpc("get_v22_completed_capability_report", {
      p_user_id: userId, p_case_id: caseId, p_report_id: reportId,
    }).maybeSingle<Record<string, unknown>>();
    checkError(error);
    if (!data) return null;
    const checked = validateCapabilityReport(data.payload);
    if (!checked.ok || data.id !== reportId || data.user_id !== userId || data.case_id !== caseId
      || data.schema_version !== "2.2.2" || checked.report.id !== reportId
      || checked.report.input_manifest.user_id !== userId || checked.report.input_manifest.case_id !== caseId
      || data.payload_checksum !== canonicalDigest(checked.report)) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return checked.report;
  }

  /** Shared owner delivery gate. A pinned ID must come from a server-side share
   * record, not an arbitrary public request. Public-token authorization remains
   * the share handler's responsibility. New exports omit revisionId.
   */
  async loadApprovedDelivery(userId: string, caseId: string, reportId: string, revisionId?: string): Promise<ApprovedCapabilityDelivery | null> {
    const report = await this.loadCompletedReport(userId, caseId, reportId);
    if (!report) return null;
    const saved = await this.loadRevision(userId, caseId, report, revisionId);
    if (!saved) return null;
    if (saved.status !== "approved") throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return buildApprovedCapabilityDelivery(report, saved);
  }

  async saveRevision(userId: string, caseId: string, report: CapabilityReport, value: unknown) {
    if (!validateDeliveryRevision(value, report) || value.user_id !== userId || value.case_id !== caseId) {
      throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    }
    const { data, error } = await this.db.rpc("save_v22_completed_report_revision", {
      p_user_id: userId, p_case_id: caseId, p_report_id: report.id, p_content: value,
    }).single<Record<string, unknown>>();
    checkError(error);
    if (!validateSavedCapabilityRevision(data, report) || data.revision !== value.expected_revision + 1
      || canonicalJsonText(data.content) !== canonicalJsonText(value)) throw new CapabilityPersistenceError("CAPABILITY_UNAVAILABLE");
    return data;
  }

  /** Raw owner-scoped revisions, not a paid-report/public-share entitlement.
   * No revisionId: latest state, including drafts that must block new delivery.
   * Pinned revisionId: exact historical state, never fall forward to latest.
   */
  async loadRevision(userId: string, caseId: string, report: CapabilityReport, revisionId?: string): Promise<SavedCapabilityRevision | null> {
    if (!validateCapabilityReport(report).ok || report.input_manifest.user_id !== userId || report.input_manifest.case_id !== caseId
      || (revisionId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(revisionId))) {
      throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    }
    let query = this.db.from("report_content_revisions").select("id,report_id,user_id,case_id,revision,status,approved_at,content")
      .eq("report_id", report.id).eq("user_id", userId).eq("case_id", caseId);
    query = revisionId ? query.eq("id", revisionId) : query.order("revision", { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();
    checkError(error);
    if (!data) return null;
    if (!validateSavedCapabilityRevision(data, report) || (revisionId && data.id !== revisionId)) throw new CapabilityPersistenceError("CAPABILITY_INVALID");
    return data;
  }
}
