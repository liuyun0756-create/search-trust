import Link from "next/link";
import type { ReportV22ViewModel } from "@/lib/report-v22/view-model";
import { ArrowLeft, BriefcaseBusiness, Eye, FileText, Sparkles } from "lucide-react";

import { AdvisorReportView } from "./advisor-report-view";
import { ClientReportView } from "./client-report-view";
import { ReportContextPills, formatReportDate } from "./report-v22-shared";
import { ReportV22Actions } from "./report-v22-actions";

const advisorNav = [
  ["Decision", "#decision"],
  ["Market", "#market"],
  ["Findings", "#findings"],
  ["Actions", "#actions"],
  ["30 / 60 / 90", "#roadmap"],
  ["Eight layers", "#layers"],
  ["Coverage", "#coverage"],
  ["Limitations", "#limitations"],
] as const;

const clientNav = [
  ["Decision", "#decision"],
  ["Market", "#market"],
  ["Actions", "#actions"],
  ["30 / 60 / 90", "#roadmap"],
  ["Client inputs", "#client-inputs"],
  ["Limitations", "#limitations"],
] as const;

export function ReportV22Shell({
  report,
  caseId,
  reportId,
}: {
  report: ReportV22ViewModel;
  caseId: string;
  reportId: string;
}) {
  const basePath = `/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}`;
  const navItems = report.mode === "advisor" ? advisorNav : clientNav;

  return (
    <div className="min-h-screen bg-[#172019] text-[#172019]">
      <header className="relative overflow-hidden border-b border-white/10 bg-[#172019] px-5 pb-12 pt-7 text-white sm:px-8 sm:pb-16 lg:px-12">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#a5d020]/10 blur-[90px]" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <Link href="/reports" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/55 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All reports
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex rounded-full border border-white/12 bg-black/15 p-1" aria-label="Report view">
              <Link
                href={`${basePath}?view=advisor`}
                aria-current={report.mode === "advisor" ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition-colors ${report.mode === "advisor" ? "bg-[#a5d020] text-[#142013]" : "text-white/55 hover:text-white"}`}
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" /> Advisor
              </Link>
              <Link
                href={`${basePath}?view=client`}
                aria-current={report.mode === "client" ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition-colors ${report.mode === "client" ? "bg-[#a5d020] text-[#142013]" : "text-white/55 hover:text-white"}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Client
              </Link>
            </div>
            <ReportV22Actions caseId={caseId} reportId={reportId} mode={report.mode} />
            {report.mode === "advisor" && process.env.GOOGLE_CONNECTIONS_ENABLED === "true" && (
              <Link href={`/cases/${encodeURIComponent(caseId)}/connections`} className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">Choose Google resources</Link>
            )}
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 text-[#b8dd3c]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="text-[11px] font-black uppercase tracking-[0.22em]">SearchTrust intelligence report</span>
              </div>
              <h1 className="max-w-4xl text-balance text-[42px] font-black leading-[0.98] tracking-[-0.06em] sm:text-[62px] lg:text-[76px]">
                {report.header.businessName}
              </h1>
              <div className="mt-7"><ReportContextPills service={report.header.primaryService} location={report.header.location} /></div>
            </div>
            <div className="grid min-w-[250px] grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-sm">
              <div className="bg-[#1d2820] p-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Report</p><p className="mt-2 font-bold">v{report.header.versionNumber} · {report.header.reportType === "prospect" ? "Prospect" : "Verified"}</p></div>
              <div className="bg-[#1d2820] p-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Generated</p><p className="mt-2 font-bold">{formatReportDate(report.header.generatedAt)}</p></div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-[#f4f1e8]">
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#dfe1d8] px-6 py-12 lg:block">
            <div className="sticky top-24">
              <div className="mb-8 flex items-center gap-2 text-[#263127]"><FileText className="h-4 w-4 text-[#8eb51b]" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">{report.mode} report</span></div>
              <nav aria-label="Report sections" className="space-y-1">
                {navItems.map(([label, href], index) => (
                  <a key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#788176] transition-colors hover:bg-white hover:text-[#273127]">
                    <span className="font-mono text-[9px] text-[#a0a89e] group-hover:text-[#8eb51b]">{String(index + 1).padStart(2, "0")}</span>{label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
            <div className="mx-auto max-w-[1060px]">
              {report.mode === "advisor" ? <AdvisorReportView report={report} /> : <ClientReportView report={report} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
