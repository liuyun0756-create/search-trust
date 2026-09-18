import type { ClientActionViewModel } from "@/lib/report-v22/view-model";
import { CalendarDays, Check, Clock3 } from "lucide-react";

import { SectionHeading, formatReportDate } from "./report-v22-shared";

export function ClientPriorityActions({ actions }: { actions: ClientActionViewModel[] }) {
  return (
    <section id="actions" className="scroll-mt-28">
      <SectionHeading eyebrow="Priority plan" title="Three actions, in the right order." description="Each action has a clear reason, finish line, and review date." />
      <div className="space-y-4">
        {actions.map((action) => (
          <article key={action.sequence} className="grid overflow-hidden rounded-[28px] border border-[#dfe5d9] bg-white lg:grid-cols-[104px_1fr_260px]">
            <div className="flex items-center bg-[#1b251e] px-6 py-5 text-white lg:flex-col lg:justify-center lg:px-4">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">Priority</span>
              <span className="ml-3 text-4xl font-black tracking-[-0.08em] text-[#b8dd3c] lg:ml-0 lg:mt-2">0{action.sequence}</span>
            </div>
            <div className="p-6 sm:p-7">
              <h3 className="text-[22px] font-black leading-7 tracking-[-0.035em] text-[#1c251f]">{action.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#657064]">{action.whyNow}</p>
              <div className="mt-5 rounded-2xl bg-[#f2f5ec] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#778476]">Expected result</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#3f4b3f]">{action.expectedResult}</p>
              </div>
            </div>
            <div className="border-t border-[#e5e9e0] bg-[#fafbf8] p-6 lg:border-l lg:border-t-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8dfd0] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#677362]"><Clock3 className="h-3.5 w-3.5" />{action.effort} effort</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4d594c]"><CalendarDays className="h-4 w-4 text-[#8eb51b]" />{formatReportDate(action.reviewDate)}</span>
              </div>
              {action.requiredClientAssets.length ? <div className="mt-6 border-t border-[#e4e9df] pt-5"><p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#8a9388]">Client inputs</p><ul className="mt-3 space-y-2">{action.requiredClientAssets.map((asset) => <li key={asset} className="flex gap-2 text-xs font-semibold leading-5 text-[#596457]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8eb51b]" />{asset}</li>)}</ul></div> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
