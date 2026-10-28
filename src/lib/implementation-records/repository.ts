import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMultiRoundReviewsEnabled } from "../review-intake/multi-round-config";
import { ReviewDeliveryRepository } from "../review-reports/repository";
import { CapabilityRepository } from "../report-capability/repository";
import {
  canonicalDigest,
  canonicalJsonText,
} from "../verified-analysis-v22/digest";
import {
  parseEntries,
  parseImplementationRecord,
  parseImplementationView,
  uuid,
  type ImplementationSource,
  type ImplementationView,
} from "./contracts";

export class ImplementationError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "CONFLICT" | "UNAVAILABLE",
  ) {
    super(code);
  }
}
export class ImplementationRepository {
  constructor(private db: SupabaseClient) {}
  private async source(user: string, caseId: string, reportId: string) {
    if (isMultiRoundReviewsEnabled()) {
      const reviews = new ReviewDeliveryRepository(this.db);
      try {
        const report = await reviews.report(user, caseId, reportId);
        if (report) return { report, review: true as const };
      } catch {
        throw new ImplementationError("UNAVAILABLE");
      }
    }
    const report = await new CapabilityRepository(this.db).loadCompletedReport(
      user,
      caseId,
      reportId,
    );
    return report ? { report, review: false as const } : null;
  }
  async approvedVersions(user: string, caseId: string, reportId: string) {
    if (![user, caseId, reportId].every(uuid))
      throw new ImplementationError("NOT_FOUND");
    const source = await this.source(user, caseId, reportId);
    if (!source || source.report.report_type !== "verified_execution")
      return [];
    const { data, error } = await this.db
      .from("report_content_revisions")
      .select("id,revision")
      .eq("user_id", user)
      .eq("case_id", caseId)
      .eq("report_id", reportId)
      .eq("status", "approved")
      .order("revision", { ascending: false })
      .limit(100);
    if (
      error ||
      !Array.isArray(data) ||
      data.some(
        (row) =>
          !uuid(row.id) ||
          !Number.isSafeInteger(row.revision) ||
          row.revision < 1,
      )
    )
      throw new ImplementationError("UNAVAILABLE");
    return data as { id: string; revision: number }[];
  }
  async read(
    user: string,
    caseId: string,
    reportId: string,
    revisionId: string,
  ): Promise<ImplementationView> {
    if (![user, caseId, reportId, revisionId].every(uuid))
      throw new ImplementationError("NOT_FOUND");
    const reports = new CapabilityRepository(this.db);
    const selected = await this.source(user, caseId, reportId);
    if (!selected || selected.report.report_type !== "verified_execution")
      throw new ImplementationError("NOT_FOUND");
    const report = selected.report;
    const delivery = selected.review
      ? await new ReviewDeliveryRepository(this.db).revision(
          user,
          caseId,
          selected.report,
          revisionId,
        )
      : await reports.loadRevision(user, caseId, selected.report, revisionId);
    if (!delivery || delivery.status !== "approved")
      throw new ImplementationError("NOT_FOUND");
    const source: ImplementationSource = {
      userId: user,
      caseId,
      reportId,
      reportChecksum: canonicalDigest(report),
      deliveryRevisionId: delivery.id,
      deliveryRevision: delivery.revision,
      actions: delivery.content.actions.map((a) => ({
        id: a.id,
        title: a.title,
        target: a.target,
      })),
    };
    const { data, error } = await this.db.rpc(
      "get_v22_implementation_records",
      {
        p_user_id: user,
        p_case_id: caseId,
        p_report_id: reportId,
        p_delivery_revision_id: revisionId,
      },
    );
    if (error)
      throw new ImplementationError(
        error.message === "IMPLEMENTATION_SOURCE_NOT_FOUND"
          ? "NOT_FOUND"
          : "UNAVAILABLE",
      );
    const view = parseImplementationView(
      {
        source,
        history: Array.isArray(data) ? data.map((r) => r.payload) : null,
      },
      caseId,
      reportId,
      revisionId,
    );
    if (
      !view ||
      view.history.some(
        ({ checksum, ...content }) => canonicalDigest(content) !== checksum,
      )
    )
      throw new ImplementationError("UNAVAILABLE");
    return view;
  }
  async save(
    user: string,
    caseId: string,
    reportId: string,
    revisionId: string,
    expected: number,
    value: unknown,
  ) {
    const current = await this.read(user, caseId, reportId, revisionId);
    const now = new Date(),
      entries = parseEntries(value, current.source, now);
    if (
      !entries ||
      !Number.isSafeInteger(expected) ||
      expected < 0 ||
      expected >= 2147483646
    )
      throw new ImplementationError("INVALID");
    const s = current.source;
    const content = {
      schema_version: "v22_implementation_record_v1",
      id: current.history[0]?.id ?? randomUUID(),
      user_id: user,
      case_id: caseId,
      report_id: reportId,
      report_checksum: s.reportChecksum,
      delivery_revision_id: revisionId,
      delivery_revision: s.deliveryRevision,
      revision: expected + 1,
      recorded_at: now.toISOString(),
      entries,
    };
    const payload = { ...content, checksum: canonicalDigest(content) };
    const { data, error } = await this.db.rpc(
      "save_v22_implementation_record",
      {
        p_user_id: user,
        p_case_id: caseId,
        p_report_id: reportId,
        p_delivery_revision_id: revisionId,
        p_expected_revision: expected,
        p_payload: payload,
        p_canonical_content: canonicalJsonText(content),
      },
    );
    if (error)
      throw new ImplementationError(
        error.code === "40001"
          ? "CONFLICT"
          : error.message === "IMPLEMENTATION_INVALID"
            ? "INVALID"
            : error.message === "IMPLEMENTATION_SOURCE_NOT_FOUND"
              ? "NOT_FOUND"
              : "UNAVAILABLE",
      );
    const view = await this.read(user, caseId, reportId, revisionId);
    // Check the exact SQL acknowledgement, not merely a later concurrent read.
    if (
      !parseImplementationRecord(data, current.source) ||
      canonicalDigest(data.entries) !== canonicalDigest(entries) ||
      data.revision !== expected + 1 ||
      data.checksum !==
        canonicalDigest(
          Object.fromEntries(
            Object.entries(data).filter(([key]) => key !== "checksum"),
          ),
        )
    )
      throw new ImplementationError("UNAVAILABLE");
    if (view.history[0]?.revision !== data.revision)
      throw new ImplementationError("CONFLICT");
    if (view.history[0].checksum !== data.checksum)
      throw new ImplementationError("UNAVAILABLE");
    return view;
  }
}
