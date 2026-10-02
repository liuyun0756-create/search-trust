import Link from "next/link";
import type { ReportV22ViewModel } from "@/lib/report-v22/view-model";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CircleDot, Eye, FileText } from "lucide-react";

import { AdvisorReportView } from "./advisor-report-view";
import { ClientReportView } from "./client-report-view";
import { ReportContextPills, formatReportDate } from "./report-v22-shared";
import { ReportV22Actions } from "./report-v22-actions";
import { DeliveryPlanEditor, type DeliveryPlanPageState } from "./delivery-plan-editor";

const advisorNav = [
  ["Decision", "#decision"],
  ["Priority actions", "#actions"],
  ["Market", "#market"],
  ["Findings", "#findings"],
  ["30 / 60 / 90", "#roadmap"],
  ["Eight layers", "#layers"],
  ["Coverage", "#coverage"],
  ["Limitations", "#limitations"],
] as const;

const clientNav = [
  ["Decision", "#decision"],
  ["Evidence", "#evidence"],
  ["Priorities", "#actions"],
  ["30 / 60 / 90", "#roadmap"],
  ["Client inputs", "#client-inputs"],
  ["Coverage", "#coverage"],
] as const;

export function ReportV22Shell({
  report,
  caseId,
  reportId,
  deliveryPlan,
}: {
  report: ReportV22ViewModel;
  caseId: string;
  reportId: string;
  deliveryPlan: DeliveryPlanPageState;
}) {
  const basePath = `/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}`;
  const navItems = report.mode === "advisor" ? advisorNav : clientNav;
  const isProspect = report.header.reportType === "prospect";
  const stageLabel = isProspect ? "01 / Win the work" : "02 / Serve the client";
  const reportLabel = isProspect ? "Prospect Analysis" : "Verified Action Plan";
  const alternateMode = report.mode === "advisor" ? "client" : "advisor";

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#1d2a22]">
      <header className="border-b border-[#e5ebe4] bg-white px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0eb] py-4">
            <Link href="/reports" className="inline-flex items-center gap-2 text-xs font-bold text-[#6d7d71] transition-colors hover:text-[#24412d]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Cases &amp; reports
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-xl bg-[#f1f4ef] p-1" aria-label="Report view">
              <Link
                href={`${basePath}?view=advisor`}
                aria-current={report.mode === "advisor" ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${report.mode === "advisor" ? "bg-white text-[#233b2a] shadow-[0_1px_4px_rgba(28,48,33,0.10)]" : "text-[#758279] hover:text-[#263b2b]"}`}
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" /> SEO work view
              </Link>
              <Link
                href={`${basePath}?view=client`}
                aria-current={report.mode === "client" ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${report.mode === "client" ? "bg-white text-[#233b2a] shadow-[0_1px_4px_rgba(28,48,33,0.10)]" : "text-[#758279] hover:text-[#263b2b]"}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Client preview
              </Link>
            </div>
            <ReportV22Actions caseId={caseId} reportId={reportId} mode={report.mode} versionNumber={report.header.versionNumber} deliveryStatus={deliveryPlan.status} />
            {report.mode === "advisor" && process.env.GOOGLE_CONNECTIONS_ENABLED === "true" && (
              <Link href={`/cases/${encodeURIComponent(caseId)}/connections`} className="rounded-lg border border-[#dfe7dd] bg-white px-3 py-2 text-xs font-semibold text-[#4f6554] transition hover:border-[#b9ccb4] hover:bg-[#f7faf5]">Manage client evidence</Link>
            )}
            </div>
          </div>

          <div className="grid gap-6 py-9 sm:py-11 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[#668a50]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9bc96f]" aria-hidden="true" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">{stageLabel} · {reportLabel}</span>
              </div>
              <h1 className="max-w-4xl text-balance text-[38px] font-black leading-[1.05] tracking-[-0.06em] sm:text-[50px] lg:text-[58px]">
                {report.header.businessName}
              </h1>
              <div className="mt-4"><ReportContextPills service={report.header.primaryService} location={report.header.location} /></div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:justify-end md:text-right">
              <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#96a299]">Report version</p><p className="mt-1 font-bold text-[#334439]">v{report.header.versionNumber} · {reportLabel}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#96a299]">Generated</p><p className="mt-1 font-bold text-[#334439]">{formatReportDate(report.header.generatedAt)}</p></div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-[#f7faf7]">
        <div className="border-b border-[#e7ece6] bg-[#fbfcfa]">
          <div className="mx-auto max-w-[1440px] px-5 py-4 sm:px-8 lg:px-12">
            {report.mode === "advisor" ? (
              <div className="grid gap-5 md:grid-cols-[190px_1fr_auto] md:items-center">
                <div className="flex items-start gap-3">
                  <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-[#78a760]" aria-hidden="true" />
                  <div><p className="text-sm font-black text-[#243026]">Review before delivery</p><p className="mt-1 text-[11px] leading-5 text-[#788176]">Report version {report.header.versionNumber} · Plan {deliveryPlan.status === "original" ? "original" : `revision ${deliveryPlan.revision} (${deliveryPlan.status})`}</p></div>
                </div>
                <ol className="grid gap-2 sm:grid-cols-3">
                  <li className="text-[11px] font-bold text-[#66776a]"><span className="mr-2 font-mono text-[10px] text-[#78a760]">01</span>Check the decision</li>
                  <li className="text-[11px] font-bold text-[#66776a]"><span className="mr-2 font-mono text-[10px] text-[#78a760]">02</span>Review three actions</li>
                  <li className="text-[11px] font-bold text-[#66776a]"><span className="mr-2 font-mono text-[10px] text-[#78a760]">03</span>Verify evidence &amp; limits</li>
                </ol>
                <Link href={`${basePath}?view=${alternateMode}`} className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-[#5d711c] transition hover:text-[#172019]">Preview client report <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3"><Eye className="mt-0.5 h-5 w-5 shrink-0 text-[#78a760]" aria-hidden="true" /><div><p className="text-sm font-black text-[#243026]">Client preview · version {report.header.versionNumber} · {deliveryPlan.status === "draft" ? "Unapproved plan draft" : deliveryPlan.status === "approved" ? `Approved plan revision ${deliveryPlan.revision}` : "Original recommendation"}</p><p className="mt-1 text-xs leading-5 text-[#788176]">This changes the level of detail, not the facts or limitations. Nothing is sent automatically.{deliveryPlan.status === "draft" ? " Sharing and client PDF are paused until you approve this plan." : ""}</p></div></div>
                <Link href={`${basePath}?view=${alternateMode}`} className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-[#5d711c] transition hover:text-[#172019]">Return to SEO work view <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[#e7ebe4] bg-[#f1f4ef] px-4 py-10 lg:block">
            <div className="sticky top-8">
              <div className="mb-6 flex items-center gap-2 px-3 text-[#35483a]"><FileText className="h-4 w-4 text-[#7ead5b]" /><span className="text-[10px] font-black uppercase tracking-[0.16em]">{report.mode === "advisor" ? "SEO work view" : "Client preview"}</span></div>
              <nav aria-label="Report sections" className="space-y-1">
                {navItems.map(([label, href], index) => (
                  <a key={href} href={href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-[#758279] transition-colors hover:bg-[#e6eee2] hover:text-[#2a4834]">
                    <span className="font-mono text-[10px] text-[#95a795] group-hover:text-[#729b5e]">{String(index + 1).padStart(2, "0")}</span>{label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 px-5 py-9 sm:px-8 sm:py-11 lg:px-10 xl:px-12">
            <div className="mx-auto max-w-[1100px]">
              {report.mode === "advisor" && <DeliveryPlanEditor caseId={caseId} reportId={reportId} initialState={deliveryPlan} />}
              {report.mode === "advisor" ? <AdvisorReportView report={report} /> : <ClientReportView report={report} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
