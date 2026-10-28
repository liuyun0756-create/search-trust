import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReportDifferenceRepository } from "./repository";
import { parseReviewReport } from "../review-reports/delivery";
import fixture from "./contracts/fixture.json";
vi.mock("server-only", () => ({}));
it("reads only the owner route, distinguishes absence from failure, and never writes", async () => {
  const c = fixture.cases.baseline,
    r = parseReviewReport(c.report),
    rpc = vi.fn().mockResolvedValue({ data: c.difference, error: null });
  const repo = new ReportDifferenceRepository({
    rpc,
  } as unknown as SupabaseClient);
  expect(await repo.read(r.business.user_id, r.business.case_id, r)).toEqual(
    c.difference,
  );
  expect(rpc).toHaveBeenCalledWith("get_v22_review_report_difference", {
    p_user_id: r.business.user_id,
    p_case_id: r.business.case_id,
    p_report_id: r.id,
  });
  rpc.mockResolvedValueOnce({ data: null, error: null });
  expect(await repo.read(r.business.user_id, r.business.case_id, r)).toBeNull();
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "private storage detail" },
  });
  await expect(
    repo.read(r.business.user_id, r.business.case_id, r),
  ).rejects.toThrow("REVIEW_DIFFERENCE_UNAVAILABLE");
  const count = rpc.mock.calls.length;
  await expect(
    repo.read(r.business.case_id, r.business.case_id, r),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(count);
  expect(
    rpc.mock.calls.every((c) => c[0] === "get_v22_review_report_difference"),
  ).toBe(true);
});
