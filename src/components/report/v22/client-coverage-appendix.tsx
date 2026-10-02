import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { CheckCircle2, CircleOff } from "lucide-react";

export function ClientCoverageAppendix({ coverage }: { coverage: ClientReportV22ViewModel["coverageAppendix"] }) {
  return (
    <section id="coverage" className="scroll-mt-28 rounded-2xl border border-[#e3eae2] bg-white p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#668a50]">Coverage appendix</p><h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#1c251f]">A short note on what was checked.</h2></div>
        <div><div className="flex flex-wrap gap-2">{coverage.checkedSources.map((source) => <span key={source} className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5e9] px-3 py-2 text-xs font-bold text-[#537147]"><CheckCircle2 className="h-3.5 w-3.5" />{source}</span>)}{coverage.unavailableSources.map((source) => <span key={source} className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f1e9] px-3 py-2 text-xs font-bold text-[#786a55]"><CircleOff className="h-3.5 w-3.5" />{source} unavailable</span>)}</div><p className="mt-5 text-sm leading-6 text-[#697468]">{coverage.boundarySummary}</p></div>
      </div>
    </section>
  );
}
