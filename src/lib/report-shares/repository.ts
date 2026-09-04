import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Report, ReportShare } from "../../types/database";
import { findUserReportByIdentifier } from "../server/reportLookup";
import type { PublicShareRecord, ReportShareRepository } from "./service";

const SHARE_COLUMNS = "id,user_id,case_id,report_id,token_hash,view_mode,expires_at,revoked_at,last_accessed_at,created_at";
const PUBLIC_SHARE_COLUMNS = "id,created_at,expires_at,revoked_at";

export class SupabaseReportShareRepository implements ReportShareRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findOwnedReport(userId: string, caseId: string, reportIdentifier: string): Promise<Report | null> {
    const { data, error } = await findUserReportByIdentifier(this.supabase, userId, reportIdentifier);
    if (error) throw error;
    return data?.case_id === caseId ? data : null;
  }

  async rotate(input: { caseId: string; expiresAt: string; reportId: string; tokenHash: string; userId: string }): Promise<PublicShareRecord> {
    const { data: shareId, error } = await this.supabase.rpc("rotate_v22_report_share", {
      p_user_id: input.userId,
      p_case_id: input.caseId,
      p_report_id: input.reportId,
      p_token_hash: input.tokenHash,
      p_expires_at: input.expiresAt,
    });
    if (error || !shareId) throw error ?? new Error("Share rotation returned no record.");
    const { data, error: readError } = await this.supabase
      .from("report_shares")
      .select(PUBLIC_SHARE_COLUMNS)
      .eq("id", shareId)
      .eq("user_id", input.userId)
      .single();
    if (readError || !data) throw readError ?? new Error("Created share was not found.");
    return data as PublicShareRecord;
  }

  async list(userId: string, caseId: string, reportId: string): Promise<PublicShareRecord[]> {
    const { data, error } = await this.supabase
      .from("report_shares")
      .select(PUBLIC_SHARE_COLUMNS)
      .eq("user_id", userId)
      .eq("case_id", caseId)
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PublicShareRecord[];
  }

  async revoke(userId: string, caseId: string, reportId: string, shareId: string, revokedAt: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("report_shares")
      .update({ revoked_at: revokedAt })
      .eq("id", shareId)
      .eq("user_id", userId)
      .eq("case_id", caseId)
      .eq("report_id", reportId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async resolve(tokenHash: string, accessedAt: string): Promise<{ report: Report; share: ReportShare } | null> {
    const { data: shareData, error: shareError } = await this.supabase
      .from("report_shares")
      .select(SHARE_COLUMNS)
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", accessedAt)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!shareData) return null;
    const share = shareData as ReportShare;

    const { data: reportData, error: reportError } = await this.supabase
      .from("reports")
      .select("*")
      .eq("id", share.report_id)
      .eq("user_id", share.user_id)
      .eq("case_id", share.case_id)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!reportData) return null;

    await this.supabase.from("report_shares").update({ last_accessed_at: accessedAt }).eq("id", share.id);
    return { report: reportData as Report, share };
  }
}
