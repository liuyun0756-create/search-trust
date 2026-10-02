import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { CircleDot, Flag, PackageCheck } from "lucide-react";

import { SectionHeading, formatReportDate } from "./report-v22-shared";

export function ClientRoadmap({ report }: { report: ClientReportV22ViewModel }) {
  return (
    <section id="roadmap" className="scroll-mt-28">
      <SectionHeading eyebrow={report.deliveryPlanEdited ? "Reviewed sequence" : "90-day sequence"} title={report.deliveryPlanEdited ? "The SEO-approved plan and timing." : "A practical path from decision to proof."} />
      <div className="grid gap-3 lg:grid-cols-3">
        {report.roadmap.map((phase, index) => <article key={phase.period} className="rounded-2xl border border-[#e3eae2] bg-white p-6"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e7f2e2] text-xs font-black text-[#67974c]">0{index + 1}</div><p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#6f9659]">{phase.label}</p><h3 className="mt-2 text-lg font-black leading-6 tracking-[-0.035em]">{phase.objective}</h3><div className="mt-5"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8a9b8d]">Planned result to verify</p><p className="mt-2 flex gap-2 text-xs leading-5 text-[#657767]"><Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#78a962]" />{phase.expectedResult}</p></div></article>)}
      </div>
      <div id="client-inputs" className="mt-4 grid scroll-mt-28 gap-6 rounded-2xl bg-[#e9f3e6] p-6 lg:grid-cols-[0.82fr_1.18fr] lg:p-8">
        <div><PackageCheck className="h-6 w-6 text-[#6c9d58]" /><p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#628d51]">Client inputs</p><h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.045em] text-[#24382a]">What we need from you.</h2></div>
        <div><ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{report.clientInputs.map((asset) => <li key={asset} className="flex gap-2 text-sm font-semibold leading-6 text-[#4e6854]"><CircleDot className="mt-1.5 h-3 w-3 shrink-0 text-[#77a861]" />{asset}</li>)}</ul>{report.deliveryPlanEdited && <p className="mt-4 text-xs leading-5 text-[#718675]">These inputs come from the original report and should be confirmed against the SEO-edited work scope.</p>}<div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-[#68806c]">{report.deliveryPlanEdited ? "Review timing is specified for each action above." : <>Planned progress review: <strong className="text-[#315239]">{formatReportDate(report.nextReviewDate)}</strong></>}</p><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#648d54]">Scope and inputs to confirm</span></div></div>
      </div>
    </section>
  );
}
