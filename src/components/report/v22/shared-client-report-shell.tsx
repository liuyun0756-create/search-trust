"use client";

import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { clientDeliveryLanguage } from "@/lib/report-v22/delivery-language";
import { Download, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { ClientReportView } from "./client-report-view";
import { ReportContextPills, formatReportDate } from "./report-v22-shared";

export function SharedClientReportShell({ report, token }: { report: ClientReportV22ViewModel; token: string }) {
  const delivery = clientDeliveryLanguage(report.header.reportType);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  async function downloadPdf() {
    if (downloading) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const response = await fetch("/api/share/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("PDF_DOWNLOAD_FAILED");
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "SearchTrust-Client-Report.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#1d2a22]">
      <header className="border-b border-[#e5ebe4] bg-white px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0eb] py-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#697d6e]"><LockKeyhole className="h-4 w-4 text-[#78a760]" /> Secure client report</div>
            <div className="text-right">
              <button type="button" disabled={downloading} onClick={() => void downloadPdf()} className="inline-flex items-center gap-2 rounded-lg bg-[#26432e] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#365d40] disabled:cursor-wait disabled:opacity-70"><Download className="h-4 w-4" /> {downloading ? "Preparing PDF…" : "Download PDF"}</button>
              {downloadFailed ? <p className="mt-2 text-xs font-bold text-[#a24b31]" role="status">PDF download failed. Please try again.</p> : null}
            </div>
          </div>
          <div className="grid gap-6 py-9 sm:py-11 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#668a50]">{delivery.stage} · version {report.header.versionNumber}</p>
              <h1 className="mt-3 max-w-4xl text-balance text-[38px] font-black leading-[1.05] tracking-[-0.06em] sm:text-[50px] lg:text-[58px]">{report.header.businessName}</h1>
              <div className="mt-4"><ReportContextPills service={report.header.primaryService} location={report.header.location} /></div>
            </div>
            <div className="text-sm md:text-right"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#96a299]">Shared report version</p><p className="mt-1 font-bold text-[#334439]">v{report.header.versionNumber} · {delivery.stage}</p><p className="mt-1 text-xs text-[#829086]">Generated {formatReportDate(report.header.generatedAt)}</p></div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-9 sm:px-8 sm:py-11 lg:px-12"><ClientReportView report={report} /></main>
    </div>
  );
}
