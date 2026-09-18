import type { ClientEvidenceViewModel } from "@/lib/report-v22/view-model";
import { CheckCircle2 } from "lucide-react";

import { SectionHeading } from "./report-v22-shared";

export function ClientEvidenceCards({ cards }: { cards: ClientEvidenceViewModel[] }) {
  return (
    <section id="evidence" className="scroll-mt-28">
      <SectionHeading
        eyebrow="Representative evidence"
        title="What the decision is based on."
        description="A short, readable selection from the checked evidence—not the full technical trace."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card, index) => (
          <article key={`${card.sourceLabel}-${index}`} className="flex min-h-[290px] flex-col rounded-[26px] border border-[#dfe5d9] bg-[#fbfcf8] p-6 shadow-[0_16px_50px_rgba(28,42,27,0.045)]">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#eaf1d5] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#667f19]">{card.sourceLabel}</span>
              <span className="font-mono text-[11px] font-bold text-[#a2aaa0]">0{index + 1}</span>
            </div>
            <h3 className="mt-8 text-xl font-black tracking-[-0.035em] text-[#1b241c]">{card.subjectLabel ?? "Checked evidence"}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#4f5b4e]">{card.observation}</p>
            <div className="mt-auto border-t border-[#e5e9e0] pt-5">
              <p className="flex gap-2 text-sm leading-6 text-[#6a7568]"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#8bad20]" aria-hidden="true" />{card.decisionRelevance}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
