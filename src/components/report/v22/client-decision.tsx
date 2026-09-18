import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { ArrowDownRight, MoveUpRight } from "lucide-react";

export function ClientDecision({ decision }: { decision: ClientReportV22ViewModel["decision"] }) {
  return (
    <section id="decision" className="scroll-mt-28">
      <div className="relative overflow-hidden rounded-[34px] bg-[#a5d020] px-6 py-8 text-[#162016] sm:px-10 sm:py-11 lg:px-12">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-white/18" aria-hidden="true" />
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#435817]">The core decision</p>
        <h2 className="relative mt-6 max-w-4xl text-balance text-[36px] font-black leading-[0.98] tracking-[-0.06em] sm:text-[56px]">
          {decision.headline}
        </h2>
        <div className="relative mt-10 grid gap-px overflow-hidden rounded-[22px] bg-[#66831a]/20 lg:grid-cols-2">
          <div className="bg-[#b5db3d] p-6 sm:p-7">
            <ArrowDownRight className="h-5 w-5 text-[#526d13]" aria-hidden="true" />
            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.18em] text-[#526d13]">Business impact</p>
            <p className="mt-3 text-[16px] font-bold leading-7">{decision.businessImpact}</p>
          </div>
          <div className="bg-[#b5db3d] p-6 sm:p-7">
            <MoveUpRight className="h-5 w-5 text-[#526d13]" aria-hidden="true" />
            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.18em] text-[#526d13]">Opportunity</p>
            <p className="mt-3 text-[16px] font-bold leading-7">{decision.opportunity}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
