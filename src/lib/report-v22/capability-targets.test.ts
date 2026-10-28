import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import acceptance from "../../../docs/superpowers/fixtures/v22-capability-p0/acceptance-cases.json";
import prospect from "../../../docs/superpowers/fixtures/v22-capability-p0/prospect-target.json";
import firstService from "../../../docs/superpowers/fixtures/v22-capability-p0/first-service-target.json";
import review from "../../../docs/superpowers/fixtures/v22-capability-p0/implementation-review-target.json";
import contractManifest from "./contracts/manifest.json";

// These checks guard the quality specifications themselves. They DO NOT prove
// the future P1–P5 features work, or accept these targets as runtime ReportV22.
describe("P0 quality target integrity (not workflow acceptance)", () => {
  it("keeps Q01–Q16 explicit, unique and unaccepted until implementation evidence exists", () => {
    expect(acceptance.runtime_contract).toBe(false);
    expect(acceptance.cases.map((item) => item.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `Q${String(i + 1).padStart(2, "0")}`),
    );
    expect(acceptance.issue_classes).toEqual(["missing_data", "missing_rule", "generic_expression"]);
    expect(acceptance.quality_dimensions).toHaveLength(8);
    for (const item of acceptance.cases) {
      expect(item.acceptance_status).toBe("target_not_yet_accepted");
      expect(item.variants.map((variant) => variant.variant)).toEqual(item.required_variants);
      expect(new Set(item.required_variants).size).toBe(item.required_variants.length);
      for (const variant of item.variants) {
        expect(Object.keys(variant.input).length).toBeGreaterThan(0);
        expect(Object.keys(variant.expected).length).toBeGreaterThan(0);
      }
    }
  });

  it("pins existing executable report fixtures without changing their contract", () => {
    for (const name of ["fixtures/prospect.json", "fixtures/verified.json"] as const) {
      const bytes = readFileSync(path.resolve("src/lib/report-v22/contracts", name));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(contractManifest.files[name]);
    }
    expect(contractManifest.contract_version).toBe("2.2.1");
  });

  it.each([prospect, firstService, review])("keeps $id traceable and separated from real acceptance", (report) => {
    expect(report.classification).toBe("synthetic_quality_target");
    expect(report.runtime_contract).toBe(false);
    expect(report.acceptance_status).toBe("target_not_yet_accepted");
    expect(new URL(report.identity.site).hostname.endsWith(".invalid")).toBe(true);
    expect(report.optional_editing).toBe(true);
    expect(report.original_evidence_immutable).toBe(true);
    expect(report.client_inputs.length).toBeGreaterThan(0);
    const ids = new Set(report.sources.map((source) => source.id));
    expect(ids.size).toBe(report.sources.length);
    for (const source of report.sources) {
      expect(source.case_id).toBe(report.identity.case_id);
      expect(Date.parse(source.observed_at)).toBeLessThanOrEqual(Date.parse(report.evaluated_at));
    }
    for (const item of [report.summary, ...report.findings, ...report.actions]) {
      expect(item.evidence_ids.length).toBeGreaterThan(0);
      for (const id of item.evidence_ids) expect(ids.has(id)).toBe(true);
    }
    expect(report.actions.length).toBeGreaterThan(0);
    expect(report.actions.length).toBeLessThanOrEqual(3);
    for (const action of report.actions) {
      expect(action.target.length).toBeGreaterThan(0);
      expect(action.steps.length).toBeGreaterThan(0);
      expect(action.material.text.length).toBeGreaterThan(0);
      expect(action.done.length).toBeGreaterThan(0);
      expect(action.review.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes public-only acquisition from direct first service", () => {
    expect(prospect.sources.some((source) => ["gsc", "ga4"].includes(source.kind))).toBe(false);
    expect(firstService.prospect_report_id).toBeNull();
    expect(firstService.previous_report_id).toBeNull();
    expect(firstService.historical_diff).toBe(false);
    expect(firstService.analysis_credits).toBe(1);
    expect(firstService.hidden_prospect_charge).toBe(0);
    expect(firstService.delivery.edited).toBe(false);
    expect(firstService.delivery.pdf_revision).toBe(firstService.delivery.approved_revision);
    expect(firstService.delivery.share_revision).toBe(firstService.delivery.approved_revision);
    expect(firstService.delivery.client_revision).toBe(firstService.delivery.approved_revision);
  });

  it("keeps review arithmetic separate from implementation verification and outcome eligibility", () => {
    const days = (period: { start: string; end: string }) => (Date.parse(period.end) - Date.parse(period.start)) / 86_400_000 + 1;
    expect(days(review.comparison.before)).toBe(28);
    expect(days(review.comparison.after)).toBe(28);
    expect(review.comparison.before.end < review.implementation.date).toBe(true);
    expect(review.comparison.after.start > review.implementation.date).toBe(true);
    expect(review.comparison.after.end < review.comparison.cutoff).toBe(true);
    expect(review.implementation.page_check).toBe("not_performed");
    expect(review.comparison.status).toBe("eligibility_pending");
    expect(review.comparison.eligibility_rule_version).toBeNull();
    expect(review.comparison.effect_conclusion).toBeNull();
    expect(review.comparison.causal_attribution).toBe(false);
    expect(review.recommendation_change.changed).toBe(false);
    for (const metric of review.comparison.metrics) {
      if (metric.unit === "ratio") {
        expect(metric.delta_percentage_points).toBeCloseTo((metric.after - metric.before) * 100);
      } else {
        expect(metric.absolute_delta).toBe(metric.after - metric.before);
        expect(metric.relative_delta).toBeCloseTo((metric.after - metric.before) / metric.before);
      }
    }
  });

  it("records confirmed D1 without enabling the unimplemented path or changing technical-failure returns", () => {
    const zero = acceptance.cases.find((item) => item.id === "Q16")!.variants[0];
    expect(zero.input).toMatchObject({ analysis_status: "succeeded", reason: "insufficient_evidence_for_actions" });
    expect(zero.expected).toMatchObject({
      settlement: "charge_one_credit",
      diagnostic_report_delivered: true,
      credits_consumed: 1,
      credits_returned: 0,
      paid_path_enabled: false,
      filler_actions: 0,
    });
    const failure = acceptance.cases.find((item) => item.id === "Q13")!.variants
      .find((item) => item.variant === "technical_failure_replay")!;
    expect(failure.expected).toMatchObject({ credits_returned: 1, terminal_state: "failed" });
    expect(firstService.actions).toHaveLength(2);
    expect(prospect.actions).toHaveLength(1);
  });
});
