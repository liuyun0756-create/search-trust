import { describe, expect, it } from "vitest";

import prospectFixture from "../report-v22/contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "../report-v22/generated/types";
import type { Report, ReportShare } from "../../types/database";
import { ReportShareNotFoundError, ReportShareService, type PublicShareRecord, type ReportShareRepository } from "./service";
import { createReportShareToken, hashReportShareToken, isReportShareToken } from "./tokens";

const reportV22 = prospectFixture as unknown as SearchTrustReportV2_2;
const now = new Date("2026-09-04T00:00:00.000Z");
const token = "a".repeat(43);
const report = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  case_id: reportV22.identity.case_id,
  report_v2_2: reportV22,
} as Report;

class FakeRepository implements ReportShareRepository {
  rotated: Parameters<ReportShareRepository["rotate"]>[0] | null = null;
  revoked: Parameters<ReportShareRepository["revoke"]> | null = null;
  resolved: { report: Report; share: ReportShare } | null = null;

  async findOwnedReport(userId: string, caseId: string) {
    return userId === report.user_id && caseId === report.case_id ? report : null;
  }
  async rotate(input: Parameters<ReportShareRepository["rotate"]>[0]): Promise<PublicShareRecord> {
    this.rotated = input;
    return { id: "share-1", created_at: now.toISOString(), expires_at: input.expiresAt, revoked_at: null };
  }
  async list() { return []; }
  async revoke(...args: Parameters<ReportShareRepository["revoke"]>) { this.revoked = args; return true; }
  async resolve() { return this.resolved; }
}

describe("report share tokens", () => {
  it("uses 256 bits of URL-safe randomness and stores a one-way digest", () => {
    const first = createReportShareToken();
    const second = createReportShareToken();
    expect(isReportShareToken(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(hashReportShareToken(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashReportShareToken(first)).not.toContain(first);
  });
});

describe("ReportShareService", () => {
  it("rotates a 30-day client share without persisting its plaintext token", async () => {
    const repository = new FakeRepository();
    const service = new ReportShareService(repository, () => now, () => token);
    const created = await service.create(report.user_id, report.case_id!, report.id);

    expect(created.token).toBe(token);
    expect(repository.rotated).toMatchObject({
      userId: report.user_id,
      caseId: report.case_id,
      reportId: report.id,
      tokenHash: hashReportShareToken(token),
      expiresAt: "2026-10-04T00:00:00.000Z",
    });
    expect(JSON.stringify(repository.rotated)).not.toContain(token);
  });

  it("always resolves public shares to the client projection", async () => {
    const repository = new FakeRepository();
    repository.resolved = {
      report,
      share: {
        id: "share-1",
        user_id: report.user_id,
        case_id: report.case_id!,
        report_id: report.id,
        token_hash: hashReportShareToken(token),
        view_mode: "client",
        created_at: now.toISOString(),
        expires_at: "2026-10-04T00:00:00.000Z",
        revoked_at: null,
        last_accessed_at: null,
      },
    };
    const service = new ReportShareService(repository, () => now);
    const resolved = await service.resolve(token);
    const serialized = JSON.stringify(resolved.report);

    expect(resolved.report.mode).toBe("client");
    expect(serialized).not.toContain("rule_id");
    expect(serialized).not.toContain("original_value");
    expect(serialized).not.toContain("snapshot_id");
  });

  it("rejects malformed, missing, and cross-Case shares as not found", async () => {
    const repository = new FakeRepository();
    const service = new ReportShareService(repository, () => now, () => token);
    await expect(service.resolve("guessable")).rejects.toBeInstanceOf(ReportShareNotFoundError);
    await expect(service.resolve(token)).rejects.toBeInstanceOf(ReportShareNotFoundError);
    await expect(service.create(report.user_id, "wrong-case", report.id)).rejects.toBeInstanceOf(ReportShareNotFoundError);
  });
});
