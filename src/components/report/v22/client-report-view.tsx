import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";

import { ClientCoverageAppendix } from "./client-coverage-appendix";
import { ClientDecision } from "./client-decision";
import { ClientEvidenceCards } from "./client-evidence-cards";
import { ClientPriorityActions } from "./client-priority-actions";
import { ClientRoadmap } from "./client-roadmap";

export function ClientReportView({ report }: { report: ClientReportV22ViewModel }) {
  return (
    <div className="space-y-16 pb-16 sm:space-y-24">
      <ClientDecision decision={report.decision} />
      <ClientEvidenceCards cards={report.evidenceCards} />
      <ClientPriorityActions actions={report.actions} />
      <ClientRoadmap report={report} />
      <ClientCoverageAppendix coverage={report.coverageAppendix} />
    </div>
  );
}
