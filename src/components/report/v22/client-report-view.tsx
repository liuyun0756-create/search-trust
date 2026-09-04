import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { ArrowRight, CalendarDays, Check, Clock3, PackageCheck } from "lucide-react";

import { CompetitorGrid, LimitationsList, RoadmapTimeline, SectionHeading, formatReportDate } from "./report-v22-shared";

export function ClientReportView({ report }: { report: ClientReportV22ViewModel }) {
  return (
    <div className="space-y-16 pb-16 sm:space-y-24">
      <section id="decision" className="scroll-mt-28">
        <div className="relative overflow-hidden rounded-[30px] bg-[#a5d020] p-7 text-[#152014] sm:p-10">
          <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full border-[34px] border-white/20" aria-hidden="true" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#3c5018]">The decision</p>
          <h2 className="mt-5 max-w-4xl text-balance text-[34px] font-black leading-[1.03] tracking-[-0.055em] sm:text-[52px]">
            {report.clientSummary.headline}
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-[#657f1d]/20 md:grid-cols-2">
            <div className="bg-[#b5db3d] p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#50671b]">What is holding growth back</p>
              <p className="mt-3 text-base font-bold leading-7">{report.clientSummary.coreProblem}</p>
            </div>
            <div className="bg-[#b5db3d] p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#50671b]">The opportunity</p>
              <p className="mt-3 text-base font-bold leading-7">{report.clientSummary.opportunity}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="market" className="scroll-mt-28">
        <SectionHeading
          eyebrow="Market reality"
          title="The gap is visible in the competitive set."
          description={report.competitorAnalysis.comparisonSummary}
        />
        <CompetitorGrid competitors={report.competitorAnalysis.competitors} />
        {report.competitorAnalysis.limitations.map((limitation) => (
          <p key={limitation} className="mt-3 text-xs leading-5 text-[#7a8478]">Scope note: {limitation}</p>
        ))}
      </section>

      <section id="actions" className="scroll-mt-28">
        <SectionHeading eyebrow="Priority plan" title="Three moves, in the right order." description="Keep the sequence. Each action creates the conditions for the next one to work." />
        <div className="space-y-4">
          {report.actions.map((action) => (
            <article key={action.actionId} className="grid overflow-hidden rounded-[26px] border border-[#dfe5d9] bg-white md:grid-cols-[110px_1fr_220px]">
              <div className="flex items-center justify-center bg-[#1c251f] px-5 py-7 text-white md:flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Action</span>
                <span className="ml-2 text-4xl font-black tracking-[-0.08em] md:ml-0 md:mt-2">0{action.sequence}</span>
              </div>
              <div className="p-6 md:p-7">
                <p className="text-lg font-black leading-7 tracking-[-0.025em] text-[#1c251f]">{action.clientFacingExplanation}</p>
                <p className="mt-3 text-sm leading-6 text-[#657064]">{action.whyNow}</p>
                {action.requiredClientAssets.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {action.requiredClientAssets.map((asset) => (
                      <span key={asset} className="rounded-full bg-[#f0f4e7] px-3 py-1.5 text-xs font-bold text-[#536047]">{asset}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-row items-center justify-between gap-4 border-t border-[#e5e9e0] bg-[#fafbf8] p-6 md:flex-col md:items-start md:justify-center md:border-l md:border-t-0">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a9388]">Review by</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-black text-[#384337]"><CalendarDays className="h-4 w-4 text-[#8eb51b]" />{formatReportDate(action.reviewDate)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8dfd0] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#677362]">
                  <Clock3 className="h-3.5 w-3.5" /> {action.effort} effort
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="scroll-mt-28">
        <SectionHeading eyebrow="90-day sequence" title="A practical path from gap to proof." />
        <RoadmapTimeline phases={report.roadmap} />
      </section>

      <section id="client-inputs" className="scroll-mt-28">
        <div className="grid overflow-hidden rounded-[28px] bg-[#202a22] text-white lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex min-h-[260px] flex-col justify-between border-b border-white/10 p-7 lg:border-b-0 lg:border-r lg:p-9">
            <PackageCheck className="h-8 w-8 text-[#b8dd3c]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b8dd3c]">Client inputs</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.045em]">What we need from you.</h2>
            </div>
          </div>
          <div className="p-7 lg:p-9">
            <ul className="grid gap-3 sm:grid-cols-2">
              {report.clientSummary.requiredClientAssets.map((asset) => (
                <li key={asset} className="flex gap-3 rounded-2xl bg-white/[0.06] p-4 text-sm font-bold leading-6 text-white/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#b8dd3c]" aria-hidden="true" /> {asset}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
              <p className="text-sm text-white/60">Next progress review: <strong className="text-white">{formatReportDate(report.clientSummary.nextReviewDate)}</strong></p>
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#b8dd3c]">Ready for implementation <ArrowRight className="h-4 w-4" /></span>
            </div>
          </div>
        </div>
      </section>

      <section id="limitations" className="scroll-mt-28">
        <SectionHeading eyebrow="Reading this report" title="What this conclusion does—and does not—cover." />
        <LimitationsList limitations={report.limitations} />
      </section>
    </div>
  );
}
