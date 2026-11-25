import { describe, expect, it } from "vitest";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { buildApprovedCapabilityDelivery } from "./delivery";
import v21 from "./fixtures/identity-inheritance-v21/report.json";
import v22 from "./fixtures/customer-reviews-v22/report.json";
import { initialCapabilityRevision } from "./revision";
import { validateCapabilityReport } from "./validate";

describe("shared client projection used by shares and PDF", () => {
  it.each([
    ["v21", v21, "sha256:4b598d3fd1a4908d748b953d4b7708c645de5b4c19b1f40dd5f0aeb0312002a3"],
    ["v22", v22, "sha256:3096bad75051920bad94c4b5f6bc2b6a0b6dbdc760c19ebb2300e373ad24772f"],
  ] as const)("keeps %s projection byte-identical to main 1911f38", (_name, raw, baseline) => {
    const checked = validateCapabilityReport(raw);
    if (!checked.ok) throw new Error("Invalid saved report fixture");
    const report = checked.report;
    const content = initialCapabilityRevision(report);
    content.status = "approved";
    const manifest = report.input_manifest;
    const delivery = buildApprovedCapabilityDelivery(report, {
      id: "00000000-0000-4000-8000-000000009999",
      report_id: report.id, user_id: manifest.user_id, case_id: manifest.case_id,
      revision: 1, status: "approved", approved_at: report.generated_at, content,
    });
    expect(canonicalDigest(delivery.document)).toBe(baseline);
  });
});
