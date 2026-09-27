import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { CLIENT_DELIVERY_STATUS, clientDeliveryLanguage } from "@/lib/report-v22/delivery-language";

import { ClientCoverageAppendix } from "./client-coverage-appendix";
import { ClientDecision } from "./client-decision";
import { ClientEvidenceCards } from "./client-evidence-cards";
import { ClientPriorityActions } from "./client-priority-actions";
import { ClientRoadmap } from "./client-roadmap";

export function ClientReportView({ report }: { report: ClientReportV22ViewModel }) {
  const delivery = clientDeliveryLanguage(report.header.reportType);
  return (
    <div className="space-y-16 pb-16 sm:space-y-24">
      <div className="rounded-2xl bg-white px-5 py-4 text-sm leading-6 text-[#4e5b4d] sm:flex sm:items-start sm:justify-between sm:gap-8 sm:px-6">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6e891b]">{delivery.stage}</p><p className="mt-1 font-bold text-[#243026]">{delivery.context}</p></div>
        <p className="mt-3 max-w-xl text-[#687466] sm:mt-0">{CLIENT_DELIVERY_STATUS}</p>
      </div>
      {report.actions.some((action) => action.reviewedPlan?.scopeChanged) && <p className="rounded-2xl bg-[#fff4e3] px-5 py-4 text-sm font-semibold leading-6 text-[#765823]">The SEO has revised the scope of at least one action. The original observations remain available, but they do not automatically validate the new scope; confirm it before implementation.</p>}
      <ClientDecision decision={report.decision} />
      <ClientEvidenceCards cards={report.evidenceCards} />
      <ClientPriorityActions actions={report.actions} />
      <ClientRoadmap report={report} />
      <ClientCoverageAppendix coverage={report.coverageAppendix} />
    </div>
  );
}
