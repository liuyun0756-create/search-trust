import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/report.schema.json";
import fixture from "./contracts/fixture.json";
import { canonicalDigest } from "../verified-analysis-v22/digest";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const valid = ajv.compile(schema);

describe("formal Verified review report contracts", () => {
  it.each(Object.entries(fixture.reports))("accepts backend %s with matching hashes", (_name, report) => {
    expect(valid(report), JSON.stringify(valid.errors)).toBe(true);
    const { checksum, ...body } = report;
    expect(canonicalDigest(body)).toBe(checksum);
    expect(report.report_type).toBe("verified_execution");
    expect(report.schema_version).toBe("2.2.3");
    expect(report.delivery_state).toBe("requires_delivery_review");
    expect(report.input_reference.input_checksum).toBe(report.content.input_checksum);
  });
  it("retains a full zero-action diagnosis under the one-credit policy", () => {
    const report = fixture.reports.zero_actions;
    expect(report.actions).toEqual([]);
    expect(report.action_state).toBe("no_next_actions");
    expect(report.content.prior_diagnosis.findings.length).toBeGreaterThan(0);
    expect(report.settlement_policy).toBe("one_credit_per_completed_analysis");
  });
  it.each(["schema_version", "report_type", "delivery_state", "settlement_policy"])("rejects unsupported %s", (field) => {
    expect(valid({ ...fixture.reports.baseline, [field]: "unsupported" })).toBe(false);
  });
});
