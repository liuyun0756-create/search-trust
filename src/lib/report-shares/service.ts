import type { Report, ReportShare } from "../../types/database";
import { selectValidatedReportV22 } from "../report-v22/access";
import { buildReportV22ViewModel, type ClientReportV22ViewModel } from "../report-v22/view-model";
import { createReportShareToken, hashReportShareToken, isReportShareToken } from "./tokens";

export type PublicShareRecord = Pick<ReportShare, "id" | "created_at" | "expires_at" | "revoked_at">;

export interface ReportShareRepository {
  findOwnedReport(userId: string, caseId: string, reportIdentifier: string): Promise<Report | null>;
  list(userId: string, caseId: string, reportId: string): Promise<PublicShareRecord[]>;
  resolve(tokenHash: string, accessedAt: string): Promise<{ report: Report; share: ReportShare } | null>;
  revoke(userId: string, caseId: string, reportId: string, shareId: string, revokedAt: string): Promise<boolean>;
  rotate(input: {
    caseId: string;
    expiresAt: string;
    reportId: string;
    tokenHash: string;
    userId: string;
  }): Promise<PublicShareRecord>;
}

export class ReportShareNotFoundError extends Error {
  constructor() {
    super("Report share was not found.");
    this.name = "ReportShareNotFoundError";
  }
}

export class ReportShareService {
  constructor(
    private readonly repository: ReportShareRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createToken: () => string = createReportShareToken,
  ) {}

  async create(userId: string, caseId: string, reportIdentifier: string) {
    const report = await this.requireOwnedReport(userId, caseId, reportIdentifier);
    const token = this.createToken();
    if (!isReportShareToken(token)) throw new Error("Share token generator returned an invalid token.");
    const expiresAt = new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const share = await this.repository.rotate({
      caseId,
      expiresAt,
      reportId: report.id,
      tokenHash: hashReportShareToken(token),
      userId,
    });
    return { ...share, token };
  }

  async list(userId: string, caseId: string, reportIdentifier: string) {
    const report = await this.requireOwnedReport(userId, caseId, reportIdentifier);
    return this.repository.list(userId, caseId, report.id);
  }

  async revoke(userId: string, caseId: string, reportIdentifier: string, shareId: string) {
    const report = await this.requireOwnedReport(userId, caseId, reportIdentifier);
    const revoked = await this.repository.revoke(userId, caseId, report.id, shareId, this.now().toISOString());
    if (!revoked) throw new ReportShareNotFoundError();
  }

  async resolve(token: string): Promise<{ report: ClientReportV22ViewModel; share: PublicShareRecord }> {
    if (!isReportShareToken(token)) throw new ReportShareNotFoundError();
    const resolved = await this.repository.resolve(hashReportShareToken(token), this.now().toISOString());
    if (!resolved || resolved.share.view_mode !== "client") throw new ReportShareNotFoundError();
    const selected = selectValidatedReportV22(resolved.report, resolved.share.case_id);
    if (!selected.ok) throw new ReportShareNotFoundError();
    return {
      report: buildReportV22ViewModel(selected.report, "client"),
      share: {
        id: resolved.share.id,
        created_at: resolved.share.created_at,
        expires_at: resolved.share.expires_at,
        revoked_at: resolved.share.revoked_at,
      },
    };
  }

  private async requireOwnedReport(userId: string, caseId: string, reportIdentifier: string) {
    const report = await this.repository.findOwnedReport(userId, caseId, reportIdentifier);
    const selected = selectValidatedReportV22(report, caseId);
    if (!report || !selected.ok) throw new ReportShareNotFoundError();
    return report;
  }
}
