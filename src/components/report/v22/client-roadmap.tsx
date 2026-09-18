import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { ArrowRight, Check, Flag, PackageCheck } from "lucide-react";

import { SectionHeading, formatReportDate } from "./report-v22-shared";

export function ClientRoadmap({ report }: { report: ClientReportV22ViewModel }) {
  return (
    <section id="roadmap" className="scroll-mt-28">
      <SectionHeading eyebrow="90-day sequence" title="A practical path from decision to proof." />
      <div className="relative grid gap-4 lg:grid-cols-3">
        <div className="absolute left-[16.666%] right-[16.666%] top-7 hidden h-px bg-[#cdd9b0] lg:block" />
        {report.roadmap.map((phase, index) => <article key={phase.period} className="relative rounded-[25px] border border-[#dfe5d9] bg-white p-6 pt-9"><div className="absolute -top-1 left-6 flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-[#f4f1e8] bg-[#a5d020] text-base font-black">{index + 1}</div><p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#759017]">{phase.label}</p><h3 className="mt-3 text-xl font-black leading-7 tracking-[-0.035em]">{phase.objective}</h3><p className="mt-6 flex gap-2 border-t border-[#e8ebe4] pt-5 text-sm leading-6 text-[#606c5f]"><Flag className="mt-1 h-4 w-4 shrink-0 text-[#8eb51b]" />{phase.expectedResult}</p></article>)}
      </div>
      <div id="client-inputs" className="mt-8 grid overflow-hidden rounded-[28px] bg-[#202a22] text-white lg:grid-cols-[0.82fr_1.18fr]">
        <div className="flex min-h-[240px] flex-col justify-between border-b border-white/10 p-7 lg:border-b-0 lg:border-r lg:p-9"><PackageCheck className="h-8 w-8 text-[#b8dd3c]" /><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b8dd3c]">Client inputs</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.045em]">What we need from you.</h2></div></div>
        <div className="p-7 lg:p-9"><ul className="grid gap-3 sm:grid-cols-2">{report.clientInputs.map((asset) => <li key={asset} className="flex gap-3 rounded-2xl bg-white/[0.06] p-4 text-sm font-bold leading-6 text-white/85"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#b8dd3c]" />{asset}</li>)}</ul><div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6"><p className="text-sm text-white/60">Next progress review: <strong className="text-white">{formatReportDate(report.nextReviewDate)}</strong></p><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#b8dd3c]">Ready for implementation <ArrowRight className="h-4 w-4" /></span></div></div>
      </div>
    </section>
  );
}
