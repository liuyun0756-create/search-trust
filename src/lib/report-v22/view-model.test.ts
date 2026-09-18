import { describe, expect, it } from "vitest";

import prospectFixture from "./contracts/fixtures/prospect.json";
import verifiedFixture from "./contracts/fixtures/verified.json";
import type { SearchTrustReportV2_2 } from "./generated/types";
import { buildReportV22ViewModel } from "./view-model";

const prospect = prospectFixture as unknown as SearchTrustReportV2_2;
const verified = verifiedFixture as unknown as SearchTrustReportV2_2;

describe("buildReportV22ViewModel", () => {
  it("projects only client delivery in canonical action and roadmap order", () => {
    const view = buildReportV22ViewModel(prospect, "client");

    expect(view.actions.map((action) => action.sequence)).toEqual([1, 2, 3]);
    expect(view.roadmap.map((phase) => phase.label)).toEqual([
      "Days 1–30",
      "Days 31–60",
      "Days 61–90",
    ]);
    expect(view.evidenceCards).toHaveLength(3);
    expect(view.decision.headline).toBe(prospect.client_delivery.decision.headline);
  });

  it("does not serialize advisor-only diagnostics into the client projection", () => {
    const serialized = JSON.stringify(buildReportV22ViewModel(prospect, "client"));

    for (const privateKey of [
      "rule_id",
      "rule_version",
      "original_value",
      "normalized_value",
      "source_locator",
      "snapshot_id",
      "health_reasons",
      "findingIds",
      "competitorAnalysis",
      "clientSummary",
      "actionId",
      "caseId",
      "reportId",
      "siteUrl",
      "http://",
      "https://",
      "fn_",
      "ev_",
      "ac_",
    ]) {
      expect(serialized).not.toContain(privateKey);
    }
  });

  it("preserves evidence, rule details, source health, layers, and version changes for advisors", () => {
    const view = buildReportV22ViewModel(verified, "advisor");

    expect(view.evidence.length).toBeGreaterThan(0);
    expect(view.findings[0].rule_id).toBeTruthy();
    expect(view.layers).toHaveLength(8);
    expect(view.dataCoverage.sources.some((source) => source.snapshot_ids?.length)).toBe(true);
    expect(view.versionDiff.kind).toBe("upgrade");
    expect(view.versionDiff.entries?.length).toBeGreaterThan(0);
  });

  it("does not change the client projection when advisor-only competitor details change", () => {
    const changedAdvisorDetail = structuredClone(prospect);
    changedAdvisorDetail.competitor_analysis.competitors[0].business_name = "Advisor-only change";

    expect(buildReportV22ViewModel(changedAdvisorDetail, "client"))
      .toEqual(buildReportV22ViewModel(prospect, "client"));
  });
});
