import type { ClientEvidenceViewModel } from "@/lib/report-v22/view-model";
import { CheckCircle2 } from "lucide-react";

import { SectionHeading } from "./report-v22-shared";

export function ClientEvidenceCards({ cards }: { cards: ClientEvidenceViewModel[] }) {
  return (
    <section id="evidence" className="scroll-mt-28 rounded-2xl border border-[#e3eae2] bg-white p-6 sm:p-8">
      <SectionHeading
        eyebrow="Representative evidence"
        title="What the decision is based on."
        description="A short, readable selection from the checked evidence—not the full technical trace."
      />
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map((card, index) => (
          <article key={`${card.sourceLabel}-${index}`} className="flex min-h-[215px] flex-col rounded-xl bg-[#f3f7f1] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#668e58]">{card.sourceLabel}</span>
              <span className="font-mono text-[10px] font-bold text-[#a0aea1]">0{index + 1}</span>
            </div>
            <h3 className="mt-5 text-base font-black tracking-[-0.035em] text-[#24362a]">{card.subjectLabel ?? "Checked evidence"}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#4f6353]">{card.observation}</p>
            <div className="mt-auto pt-5">
              <p className="flex gap-2 text-xs leading-5 text-[#738576]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7fab66]" aria-hidden="true" />{card.decisionRelevance}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
