import Link from "next/link";
import { ArrowRight, Check, FileText, FolderOpen } from "lucide-react";

export type ReportWorkspaceItem = {
  caseId: string;
  reportId: string;
  businessName: string;
  siteUrl: string;
  market: string;
  service: string;
  type: "prospect" | "verified_execution";
  version: number;
  generatedAt: string;
};

export type ReportCaseGroup = {
  caseId: string;
  businessName: string;
  siteUrl: string;
  market: string;
  service: string;
  reports: ReportWorkspaceItem[];
  latestReport: ReportWorkspaceItem;
  latestProspect?: ReportWorkspaceItem;
  latestVerified?: ReportWorkspaceItem;
};

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function displayReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function groupReportsByCase(reports: ReportWorkspaceItem[]): ReportCaseGroup[] {
  const grouped = new Map<string, ReportWorkspaceItem[]>();

  for (const report of reports) {
    const caseReports = grouped.get(report.caseId) ?? [];
    caseReports.push(report);
    grouped.set(report.caseId, caseReports);
  }

  return [...grouped.entries()]
    .map(([caseId, caseReports]) => {
      const ordered = [...caseReports].sort((a, b) => timestamp(b.generatedAt) - timestamp(a.generatedAt));
      const latestReport = ordered[0];
      return {
        caseId,
        businessName: latestReport.businessName,
        siteUrl: latestReport.siteUrl,
        market: latestReport.market,
        service: latestReport.service,
        reports: ordered,
        latestReport,
        latestProspect: ordered.find((report) => report.type === "prospect"),
        latestVerified: ordered.find((report) => report.type === "verified_execution"),
      };
    })
    .sort((a, b) => timestamp(b.latestReport.generatedAt) - timestamp(a.latestReport.generatedAt));
}

function reportHref(report: ReportWorkspaceItem) {
  return `/cases/${encodeURIComponent(report.caseId)}/reports/${encodeURIComponent(report.reportId)}`;
}

function Stage({
  index,
  title,
  description,
  report,
  pendingHref,
}: {
  index: string;
  title: string;
  description: string;
  report?: ReportWorkspaceItem;
  pendingHref?: string;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${report ? "bg-[#dcefd4] text-[#356b3c]" : "bg-white text-[#89988a]"}`}>
        {report ? <Check className="h-4 w-4" aria-hidden="true" /> : index}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#213629]">{title}</h3>
          <span className={`text-[10px] font-semibold ${report ? "text-[#4a8651]" : "text-[#89988a]"}`}>{report ? "Generated" : "Next stage"}</span>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-[#718073]">{description}</p>
        {report ? (
          <Link href={reportHref(report)} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#356b3c] transition-colors hover:text-[#213629] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356b3c]">
            Open v{report.version} · {displayReportDate(report.generatedAt)} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : pendingHref ? (
          <Link href={pendingHref} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#356b3c] transition-colors hover:text-[#213629] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356b3c]">
            Connect client evidence <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ReportCaseWorkspace({ cases }: { cases: ReportCaseGroup[] }) {
  const reportCount = cases.reduce((total, item) => total + item.reports.length, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]">Active client work</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#1d2a22]">{cases.length} {cases.length === 1 ? "Case" : "Cases"}, {reportCount} report {reportCount === 1 ? "version" : "versions"}</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#718073]">Each Case keeps the prospect diagnosis and later verified plan in one continuous client record.</p>
      </div>

      <div className="grid gap-4">
        {cases.map((item) => (
          <article key={item.caseId} className="overflow-hidden rounded-2xl border border-[#e3eae2] bg-white">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#57805b]"><FolderOpen className="h-3.5 w-3.5" aria-hidden="true" /> Client Case</span>
                  <span className="text-xs text-[#91a093]">Updated {displayReportDate(item.latestReport.generatedAt)}</span>
                </div>
                <h2 className="mt-5 text-balance text-2xl font-bold tracking-[-0.045em] text-[#1d2a22] sm:text-[30px]">{item.businessName}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#647466]">{item.service} · {item.market}</p>
                <p className="mt-0.5 break-all text-xs text-[#8b998d]">{item.siteUrl}</p>

                <div className="mt-6 rounded-xl bg-[#f2f7f1] px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#59805d]">Current working point</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#2b4431]">
                    {item.latestVerified
                      ? "Client evidence has been applied. Review the verified priorities before delivery."
                      : "The prospect diagnosis is ready. Review it now, then connect client evidence when the engagement begins."}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={reportHref(item.latestReport)} className="inline-flex items-center gap-2 rounded-lg bg-[#26432e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356b3c]">
                    Open latest report <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {item.reports.length > 1 ? (
                    <details className="group w-full sm:w-auto">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[#dfe7dc] px-4 py-2.5 text-sm font-semibold text-[#42614a] marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356b3c]">View report history <FileText className="h-4 w-4" aria-hidden="true" /></summary>
                      <div className="mt-2 rounded-xl border border-[#dfe7dc] bg-white p-1.5 shadow-[0_8px_24px_rgba(30,60,37,0.08)] sm:w-[360px]">
                        {item.reports.map((report) => (
                          <Link key={report.reportId} href={reportHref(report)} className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 text-xs hover:bg-[#f2f7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#356b3c]">
                            <span className="font-semibold text-[#2b4431]">{report.type === "prospect" ? "Prospect Analysis" : "Verified Action Plan"} · v{report.version}</span>
                            <span className="whitespace-nowrap text-[#8b998d]">{displayReportDate(report.generatedAt)}</span>
                          </Link>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>

              <div className="bg-[#f3f7f2] p-6 sm:p-8">
                <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d8870]">Case progression</p>
                <div className="space-y-7">
                  <Stage index="1" title="Prospect Analysis" description="Public evidence for a specific first client conversation." report={item.latestProspect} />
                  <Stage index="2" title="Verified Action Plan" description="Client performance data used to confirm, revise, or defer the first diagnosis." report={item.latestVerified} pendingHref={`/cases/${encodeURIComponent(item.caseId)}/connections`} />
                </div>
                <p className="mt-7 text-xs leading-5 text-[#788879]">Reports are generated versions. Client sharing and PDF export always act on the version you open.</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
