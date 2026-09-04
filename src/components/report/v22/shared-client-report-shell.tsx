import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { Download, LockKeyhole } from "lucide-react";

import { ClientReportView } from "./client-report-view";
import { ReportContextPills, formatReportDate } from "./report-v22-shared";

export function SharedClientReportShell({ report, pdfUrl }: { report: ClientReportV22ViewModel; pdfUrl: string }) {
  return (
    <div className="min-h-screen bg-[#f4f1e8]">
      <header className="relative overflow-hidden bg-[#172019] px-5 pb-12 pt-7 text-white sm:px-8 sm:pb-16 lg:px-12">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1180px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55"><LockKeyhole className="h-4 w-4 text-[#b8dd3c]" /> Secure client report</div>
            <a href={pdfUrl} className="inline-flex items-center gap-2 rounded-full bg-[#a5d020] px-4 py-2.5 text-xs font-black text-[#172019] hover:bg-[#b8dd3c]"><Download className="h-4 w-4" /> Download PDF</a>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b8dd3c]">SearchTrust client report</p>
              <h1 className="mt-5 max-w-4xl text-balance text-[42px] font-black leading-[0.98] tracking-[-0.06em] sm:text-[62px] lg:text-[76px]">{report.header.businessName}</h1>
              <div className="mt-7"><ReportContextPills service={report.header.primaryService} location={report.header.location} /></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Generated</p><p className="mt-2 font-bold">{formatReportDate(report.header.generatedAt)}</p></div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12"><ClientReportView report={report} /></main>
    </div>
  );
}
