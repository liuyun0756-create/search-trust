import { beforeEach, expect, it, vi } from "vitest";
import { ImplementationRepository } from "./repository";
import fixture from "../review-reports/contracts/fixture.json";
import { initialReviewRevision } from "../review-reports/delivery";
import { canonicalDigest } from "../verified-analysis-v22/digest";
const mocks = vi.hoisted(() => ({
  multi: true,
  report: vi.fn(),
  revision: vi.fn(),
  legacy: vi.fn(),
  legacyRevision: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../review-intake/multi-round-config", () => ({
  isMultiRoundReviewsEnabled: () => mocks.multi,
}));
vi.mock("../review-reports/repository", () => ({
  ReviewDeliveryRepository: class {
    report = mocks.report;
    revision = mocks.revision;
  },
}));
vi.mock("../report-capability/repository", () => ({
  CapabilityRepository: class {
    loadCompletedReport = mocks.legacy;
    loadRevision = mocks.legacyRevision;
  },
}));
const r = fixture.reports.baseline,
  id = "12121212-1212-4212-8212-121212121212";
const args = [r.business.user_id, r.business.case_id, r.id, id] as const;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.multi = true;
  mocks.report.mockResolvedValue(r);
  mocks.revision.mockResolvedValue({
    id,
    revision: 1,
    status: "approved",
    content: {
      ...initialReviewRevision(r as never),
      status: "approved",
      actions: r.actions.map((a) => ({ ...a, title: "Approved wording" })),
    },
  });
});
it("binds implementation to the actual completed review checksum and approved wording", async () => {
  const db = { rpc: vi.fn(async () => ({ data: [], error: null })) };
  const view = await new ImplementationRepository(db as never).read(...args);
  expect(view.source.reportChecksum).toBe(canonicalDigest(r));
  expect(view.source.actions[0].title).toBe("Approved wording");
  expect(mocks.legacy).not.toHaveBeenCalled();
  expect(db.rpc).toHaveBeenCalledWith(
    "get_v22_implementation_records",
    expect.objectContaining({ p_report_id: r.id, p_delivery_revision_id: id }),
  );
});
it("does not expose a draft as implementation work", async () => {
  mocks.revision.mockResolvedValue({ status: "draft" });
  await expect(
    new ImplementationRepository({} as never).read(...args),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("keeps the old path when multi-round support is disabled", async () => {
  mocks.multi = false;
  mocks.legacy.mockResolvedValue(null);
  await expect(
    new ImplementationRepository({} as never).read(...args),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.report).not.toHaveBeenCalled();
  expect(mocks.legacy).toHaveBeenCalled();
});
it("does not silently fall back after an unreadable review result", async () => {
  mocks.report.mockRejectedValue(Error("unverified storage receipt"));
  await expect(
    new ImplementationRepository({} as never).read(...args),
  ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  expect(mocks.legacy).not.toHaveBeenCalled();
});
it("allows a genuine old report to use the existing revision reader", async () => {
  mocks.report.mockResolvedValue(null);
  mocks.legacy.mockResolvedValue({ ...r, schema_version: "2.2.2" });
  mocks.legacyRevision.mockResolvedValue(await mocks.revision());
  const db = { rpc: vi.fn(async () => ({ data: [], error: null })) };
  expect(
    (await new ImplementationRepository(db as never).read(...args)).source
      .actions,
  ).toHaveLength(r.actions.length);
  expect(mocks.legacyRevision).toHaveBeenCalled();
});
