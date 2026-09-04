import { describe, expect, it } from "vitest";

import prospectFixture from "./contracts/fixtures/prospect.json";
import verifiedFixture from "./contracts/fixtures/verified.json";
import type { SearchTrustReportV2_2 } from "./generated/types";
import { buildReportV22ViewModel } from "./view-model";

const prospect = prospectFixture as unknown as SearchTrustReportV2_2;
const verified = verifiedFixture as unknown as SearchTrustReportV2_2;

describe("buildReportV22ViewModel", () => {
  it("keeps the three actions and 30/60/90 roadmap in canonical order", () => {
    const view = buildReportV22ViewModel(prospect, "client");

    expect(view.actions.map((action) => action.sequence)).toEqual([1, 2, 3]);
    expect(view.roadmap.map((phase) => phase.label)).toEqual([
      "Days 1–30",
      "Days 31–60",
      "Days 61–90",
    ]);
    expect(view.competitorAnalysis.competitors).toHaveLength(3);
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

  it("supports the contract minimum of one confirmed competitor", () => {
    const oneCompetitor = structuredClone(prospect);
    oneCompetitor.competitor_analysis.competitors = [prospect.competitor_analysis.competitors[0]];

    const view = buildReportV22ViewModel(oneCompetitor, "client");
    expect(view.competitorAnalysis.competitors).toHaveLength(1);
  });
});
