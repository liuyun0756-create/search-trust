import type { ClientActionViewModel } from "@/lib/report-v22/view-model";
import { CalendarDays, CircleDot, Clock3 } from "lucide-react";

import { SectionHeading, formatReportDate } from "./report-v22-shared";

export function ClientPriorityActions({ actions }: { actions: ClientActionViewModel[] }) {
  return (
    <section id="actions" className="scroll-mt-28 rounded-2xl border border-[#e3eae2] bg-white p-6 sm:p-8">
      <SectionHeading eyebrow="Priority plan" title="Three actions, in the right order." description="Each action has a clear reason, finish line, and review date." />
      <div className="space-y-7">
        {actions.map((action) => (
          <article key={action.sequence} className="grid gap-4 border-t border-[#e9eee8] pt-7 first:border-t-0 first:pt-0 sm:grid-cols-[36px_minmax(0,1fr)] lg:grid-cols-[36px_minmax(0,1fr)_220px] lg:gap-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e7f2e2] text-xs font-black text-[#67974c]">
              0{action.sequence}
            </div>
            <div>
              <h3 className="text-[18px] font-black leading-6 tracking-[-0.035em] text-[#213228]">{action.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#68776b]">{action.whyNow}</p>
              {action.reviewedPlan && <div className="mt-4 space-y-1.5 text-xs leading-5 text-[#506553]"><p><strong>Reviewed scope:</strong> {action.reviewedPlan.target}</p><p><strong>Work:</strong> {action.reviewedPlan.steps || "Execution details to confirm"}</p><p><strong>Complete when:</strong> {action.reviewedPlan.completion || "Completion standard to confirm"}</p><p><strong>Owner:</strong> {action.reviewedPlan.owner || "To confirm"}</p><p><strong>Review:</strong> {action.reviewedPlan.review || "Review approach to confirm"}</p>{action.reviewedPlan.scopeChanged && <p className="rounded-lg bg-[#fff4e3] p-3 font-bold text-[#795a22]">The SEO changed this action’s scope. The original evidence does not by itself verify the new scope.</p>}</div>}
              <div className="mt-4 rounded-lg bg-[#f3f7f1] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#758a76]">Planned result to verify</p>
                <p className="mt-1.5 text-xs font-bold leading-5 text-[#405845]">{action.expectedResult}</p>
              </div>
            </div>
            <div className="sm:col-start-2 lg:col-auto lg:pl-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2 lg:space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#617864]"><Clock3 className="h-3.5 w-3.5 text-[#79a962]" />{action.effort} effort</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#617864]"><CalendarDays className="h-3.5 w-3.5 text-[#79a962]" />{action.reviewedPlan?.schedule || formatReportDate(action.reviewDate)}</span>
              </div>
              {action.requiredClientAssets.length ? <div className="mt-4"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8a9a8d]">Client inputs needed</p><ul className="mt-2 space-y-1.5">{action.requiredClientAssets.map((asset) => <li key={asset} className="flex gap-2 text-xs leading-5 text-[#6b7b6e]"><CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-[#7eab63]" />{asset}</li>)}</ul></div> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
