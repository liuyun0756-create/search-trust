import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import prospectFixture from "../../../lib/report-v22/contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "../../../lib/report-v22/generated/types";
import { buildReportV22ViewModel } from "../../../lib/report-v22/view-model";

import { AdvisorReportView } from "./advisor-report-view";
import { ClientReportView } from "./client-report-view";

const fixture = prospectFixture as unknown as SearchTrustReportV2_2;

describe("v2.2 report views", () => {
  it("renders the client decision, three actions, roadmap, and client inputs", () => {
    const html = renderToStaticMarkup(
      <ClientReportView report={buildReportV22ViewModel(fixture, "client")} />,
    );

    expect(html).toContain("The decision");
    expect(html).toContain("Three moves, in the right order.");
    expect(html).toContain("Days 1–30");
    expect(html).toContain("What we need from you.");
    expect(html.match(/Action<\/span>/g)).toHaveLength(3);
    expect(html).not.toContain("RULE-");
    expect(html).not.toContain("snapshot");
  });

  it("renders advisor findings, eight layers, source health, and evidence controls", () => {
    const html = renderToStaticMarkup(
      <AdvisorReportView report={buildReportV22ViewModel(fixture, "advisor")} />,
    );

    expect(html).toContain("Diagnostic findings");
    expect(html).toContain("The eight layers of local trust.");
    expect(html).toContain("Coverage and source health");
    expect(html).toContain("sources");
    expect(html).toContain(fixture.findings[0].rule_id);
  });
});
