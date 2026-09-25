import Link from "next/link";
import { ArrowRight, Check, Clock3, Database, FileText, FolderOpen, Sparkles } from "lucide-react";

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
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${report ? "bg-[#a5d020] text-[#172019]" : "bg-[#edf0e8] text-[#8a9388]"}`}>
        {report ? <Check className="h-4 w-4" aria-hidden="true" /> : index}
      </div>
      <div className="min-w-0 pb-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-[#1c281e]">{title}</h3>
          {report ? <span className="rounded-full bg-[#eef4df] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#708b18]">Generated</span> : <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9aa198]">Next stage</span>}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-[#737d72]">{description}</p>
        {report ? (
          <Link href={reportHref(report)} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#536319] transition-colors hover:text-[#172019]">
            Open v{report.version} · {displayReportDate(report.generatedAt)} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : pendingHref ? (
          <Link href={pendingHref} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#536319] transition-colors hover:text-[#172019]">
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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#78931c]">Active client work</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#172019]">{cases.length} {cases.length === 1 ? "Case" : "Cases"}, {reportCount} report {reportCount === 1 ? "version" : "versions"}</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#737d72]">Each Case keeps the prospect diagnosis and later verified plan in one continuous client record.</p>
      </div>

      <div className="grid gap-6">
        {cases.map((item) => (
          <article key={item.caseId} className="overflow-hidden rounded-[30px] bg-white shadow-[0_20px_55px_rgba(35,48,36,0.07)] ring-1 ring-[#dfe3d9]">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eff3e7] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#61711f]"><FolderOpen className="h-3.5 w-3.5" aria-hidden="true" /> Client Case</span>
                  <span className="text-[10px] font-bold text-[#98a096]">Updated {displayReportDate(item.latestReport.generatedAt)}</span>
                </div>
                <h2 className="mt-6 text-balance text-3xl font-black tracking-[-0.05em] text-[#172019] sm:text-4xl">{item.businessName}</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#697368]">{item.service} · {item.market}</p>
                <p className="mt-1 break-all text-xs text-[#949b92]">{item.siteUrl}</p>

                <div className="mt-8 rounded-[22px] bg-[#f3f5ef] p-5">
                  <div className="flex items-center gap-2 text-[#60701f]"><Sparkles className="h-4 w-4" aria-hidden="true" /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Current working point</span></div>
                  <p className="mt-3 text-lg font-black leading-7 text-[#233025]">
                    {item.latestVerified
                      ? "Client evidence has been applied. Review the verified priorities before delivery."
                      : "The prospect diagnosis is ready. Review it now, then connect client evidence when the engagement begins."}
                  </p>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={reportHref(item.latestReport)} className="inline-flex items-center gap-2 rounded-full bg-[#172019] px-5 py-3 text-xs font-black text-white transition hover:bg-[#28352b]">
                    Open latest report <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {item.reports.length > 1 ? (
                    <details className="group w-full sm:w-auto">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#d8ded2] px-5 py-3 text-xs font-black text-[#536052] marker:content-none">View report history <FileText className="h-4 w-4" aria-hidden="true" /></summary>
                      <div className="mt-2 rounded-2xl border border-[#dce1d7] bg-white p-2 shadow-lg sm:w-[360px]">
                        {item.reports.map((report) => (
                          <Link key={report.reportId} href={reportHref(report)} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 text-xs hover:bg-[#f3f5ef]">
                            <span className="font-black text-[#283329]">{report.type === "prospect" ? "Prospect Analysis" : "Verified Action Plan"} · v{report.version}</span>
                            <span className="whitespace-nowrap text-[#8a9288]">{displayReportDate(report.generatedAt)}</span>
                          </Link>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>

              <div className="bg-[#edf2e8] p-6 sm:p-8 lg:p-10">
                <div className="mb-7 flex items-center gap-2 text-[#687465]"><Clock3 className="h-4 w-4" aria-hidden="true" /><span className="text-[10px] font-black uppercase tracking-[0.17em]">Case progression</span></div>
                <div className="relative">
                  <div className="absolute bottom-9 left-[17px] top-9 w-px bg-[#ced7c7]" aria-hidden="true" />
                  <Stage index="1" title="Prospect Analysis" description="Public evidence for a specific first client conversation." report={item.latestProspect} />
                  <Stage index="2" title="Verified Action Plan" description="Client performance data used to confirm, revise, or defer the first diagnosis." report={item.latestVerified} pendingHref={`/cases/${encodeURIComponent(item.caseId)}/connections`} />
                </div>
                <p className="mt-1 flex items-start gap-2 rounded-2xl bg-white/75 p-4 text-xs leading-5 text-[#6f796d]"><Database className="mt-0.5 h-4 w-4 shrink-0 text-[#809820]" aria-hidden="true" />Reports are generated versions. Client sharing and PDF export always act on the version you open.</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
