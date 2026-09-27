import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import prospectFixture from "../../../lib/report-v22/contracts/fixtures/prospect.json";
import verifiedFixture from "../../../lib/report-v22/contracts/fixtures/verified.json";
import type { SearchTrustReportV2_2 } from "../../../lib/report-v22/generated/types";
import { buildReportV22ViewModel } from "../../../lib/report-v22/view-model";

import { AdvisorReportView } from "./advisor-report-view";
import { ClientReportView } from "./client-report-view";
import { SharedClientReportShell } from "./shared-client-report-shell";

const fixture = prospectFixture as unknown as SearchTrustReportV2_2;

describe("v2.2 report views", () => {
  it("renders the client decision, three actions, roadmap, and client inputs", () => {
    const html = renderToStaticMarkup(
      <ClientReportView report={buildReportV22ViewModel(fixture, "client")} />,
    );

    expect(html).toContain("The core decision");
    expect(html).toContain("Prospect proposal");
    expect(html).toContain("These are recommended actions and planned checks.");
    expect(html).toContain("Planned result to verify");
    expect(html).toContain("Three actions, in the right order.");
    expect(html).toContain("Representative evidence");
    expect(html).toContain("Days 1–30");
    expect(html).toContain("What we need from you.");
    expect(html.match(/Priority<\/span>/g)).toHaveLength(3);
    expect(html).not.toContain("RULE-");
    expect(html).not.toContain("snapshot");
    expect(html).not.toContain("https://");
  });

  it("labels a connected-data report as a service action plan", () => {
    const html = renderToStaticMarkup(
      <ClientReportView report={buildReportV22ViewModel(verifiedFixture as unknown as SearchTrustReportV2_2, "client")} />,
    );
    expect(html).toContain("Service action plan");
    expect(html).toContain("Recommendations informed by connected client data");
  });

  it("renders advisor findings, eight layers, source health, and evidence controls", () => {
    const html = renderToStaticMarkup(
      <AdvisorReportView report={buildReportV22ViewModel(fixture, "advisor")} />,
    );

    expect(html).toContain("Three actions to review first.");
    expect(html).toContain(fixture.top_actions[0].why_now);
    expect(html).toContain("Client inputs required");
    expect(html.indexOf("Three actions to review first.")).toBeLessThan(
      html.indexOf("Diagnostic findings"),
    );
    expect(html).toContain("Diagnostic findings");
    expect(html).toContain("The eight layers of local trust.");
    expect(html).toContain("Coverage and source health");
    expect(html).toContain("sources");
    expect(html).toContain(fixture.findings[0].rule_id);
  });

  it("renders a public client shell without advisor controls or diagnostics", () => {
    const html = renderToStaticMarkup(
      <SharedClientReportShell
        report={buildReportV22ViewModel(fixture, "client")}
        token={"a".repeat(43)}
      />,
    );
    expect(html).toContain("Secure client report");
    expect(html).toContain("Shared report version");
    expect(html).toContain("v1 · Prospect proposal");
    expect(html).toContain("Download PDF");
    expect(html).not.toContain("Advisor");
    expect(html).not.toContain(fixture.findings[0].rule_id);
  });
});
