import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { CLIENT_DELIVERY_STATUS, clientDeliveryLanguage } from "@/lib/report-v22/delivery-language";
import { Check } from "lucide-react";

import { ClientCoverageAppendix } from "./client-coverage-appendix";
import { ClientDecision } from "./client-decision";
import { ClientEvidenceCards } from "./client-evidence-cards";
import { ClientPriorityActions } from "./client-priority-actions";
import { ClientRoadmap } from "./client-roadmap";

export function ClientReportView({ report }: { report: ClientReportV22ViewModel }) {
  const delivery = clientDeliveryLanguage(report.header.reportType);
  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-col gap-2 px-1 text-xs leading-5 text-[#68786d] sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#658c52]">{delivery.stage}</p><p className="mt-1 font-bold text-[#304436]">{delivery.context}</p></div>
        <p className="max-w-xl">{CLIENT_DELIVERY_STATUS}</p>
      </div>
      {report.actions.some((action) => action.reviewedPlan?.scopeChanged) && <p className="rounded-2xl bg-[#fff4e3] px-5 py-4 text-sm font-semibold leading-6 text-[#765823]">The SEO has revised the scope of at least one action. The original observations remain available, but they do not automatically validate the new scope; confirm it before implementation.</p>}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.72fr)_minmax(245px,0.83fr)]">
        <ClientDecision decision={report.decision} />
        <aside className="flex flex-col rounded-2xl border border-[#e3eae2] bg-white p-6 sm:p-7" aria-labelledby="client-confirmation-title">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#668a50]">Before work begins</p>
          <h2 id="client-confirmation-title" className="mt-5 text-xl font-black leading-tight tracking-[-0.045em] text-[#223329]">What needs your confirmation?</h2>
          <p className="mt-2 text-xs leading-5 text-[#758377]">These inputs keep the recommendation tied to the actual business.</p>
          <ul className="mt-auto space-y-2.5 pt-6">
            {report.clientInputs.slice(0, 3).map((input) => <li key={input} className="flex gap-2 text-xs leading-5 text-[#526d58]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#77a95b]" aria-hidden="true" />{input}</li>)}
          </ul>
          {report.clientInputs.length > 3 && <a href="#client-inputs" className="mt-4 text-xs font-bold text-[#5b8751] hover:underline">See all client inputs</a>}
        </aside>
      </div>
      <ClientEvidenceCards cards={report.evidenceCards} />
      <ClientPriorityActions actions={report.actions} />
      <ClientRoadmap report={report} />
      <ClientCoverageAppendix coverage={report.coverageAppendix} />
    </div>
  );
}
