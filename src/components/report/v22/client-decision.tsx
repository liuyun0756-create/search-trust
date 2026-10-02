import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
export function ClientDecision({ decision }: { decision: ClientReportV22ViewModel["decision"] }) {
  return (
    <section id="decision" className="scroll-mt-28">
      <div className="flex h-full flex-col rounded-2xl bg-[#e6f1e2] p-6 text-[#1d2a22] sm:p-8">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#5b874b]"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#d0e6c9] text-[10px] tracking-normal">01</span>The core decision</p>
        <h2 className="mt-6 max-w-3xl text-balance text-[30px] font-black leading-[1.1] tracking-[-0.055em] sm:text-[39px]">
          {decision.headline}
        </h2>
        <div className="mt-auto grid gap-5 pt-8 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#668c5c]">Business impact</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#405a46]">{decision.businessImpact}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#668c5c]">Opportunity</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#405a46]">{decision.opportunity}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
