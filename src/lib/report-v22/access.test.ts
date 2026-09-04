import { describe, expect, it } from "vitest";

import prospectFixture from "./contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "./generated/types";
import { selectValidatedReportV22 } from "./access";

const report = prospectFixture as unknown as SearchTrustReportV2_2;
const caseId = report.identity.case_id;

describe("selectValidatedReportV22", () => {
  it("accepts a valid report only inside its stored Case", () => {
    const selected = selectValidatedReportV22({ case_id: caseId, report_v2_2: report }, caseId);
    expect(selected.ok).toBe(true);
  });

  it("hides reports stored under another Case", () => {
    const selected = selectValidatedReportV22({ case_id: "another-case", report_v2_2: report }, caseId);
    expect(selected).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a report whose embedded Case identity does not match", () => {
    const selected = selectValidatedReportV22({ case_id: "another-case", report_v2_2: report }, "another-case");
    expect(selected).toEqual({ ok: false, reason: "invalid" });
  });
});
