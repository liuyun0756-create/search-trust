import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { groupReportsByCase, ReportCaseWorkspace, type ReportWorkspaceItem } from "./report-case-workspace";

const reports: ReportWorkspaceItem[] = [
  {
    caseId: "case-one",
    reportId: "verified-one",
    businessName: "Northstar Dental",
    siteUrl: "https://northstar.example",
    market: "Austin, Texas",
    service: "Emergency dentistry",
    type: "verified_execution",
    version: 2,
    generatedAt: "2026-09-20T12:00:00.000Z",
  },
  {
    caseId: "case-one",
    reportId: "prospect-one",
    businessName: "Northstar Dental",
    siteUrl: "https://northstar.example",
    market: "Austin, Texas",
    service: "Emergency dentistry",
    type: "prospect",
    version: 1,
    generatedAt: "2026-09-10T12:00:00.000Z",
  },
  {
    caseId: "case-two",
    reportId: "prospect-two",
    businessName: "Harbor Legal",
    siteUrl: "https://harbor.example",
    market: "Seattle, Washington",
    service: "Business law",
    type: "prospect",
    version: 1,
    generatedAt: "2026-09-22T12:00:00.000Z",
  },
];

describe("ReportCaseWorkspace", () => {
  it("groups generated reports into continuous client Cases", () => {
    const cases = groupReportsByCase(reports);

    expect(cases).toHaveLength(2);
    expect(cases[0].caseId).toBe("case-two");
    expect(cases[1].latestProspect?.reportId).toBe("prospect-one");
    expect(cases[1].latestVerified?.reportId).toBe("verified-one");
  });

  it("shows the real next step without claiming an ungenerated verified plan", () => {
    const html = renderToStaticMarkup(<ReportCaseWorkspace cases={groupReportsByCase(reports)} />);

    expect(html).toContain("Client Case");
    expect(html).toContain("Prospect Analysis");
    expect(html).toContain("Verified Action Plan");
    expect(html).toContain("Connect client evidence");
    expect(html).toContain("Client evidence has been applied");
    expect(html).toContain("Client sharing and PDF export always act on the version you open");
    expect(html).toContain('href="/cases/case-two/reports/prospect-two"');
    expect(html).toContain('href="/cases/case-one/reports/verified-one"');
    expect(html).toContain('href="/cases/case-two/connections"');
  });
});
