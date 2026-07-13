import type { KeyIssue } from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
import { V21EvidenceList } from "./V21EvidenceList";
import { formatLayerKey, getPriorityTone, safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21KeyIssues({
  keyIssues,
  viewMode = "analyst",
}: {
  keyIssues?: KeyIssue[] | null;
  viewMode?: V21ViewMode;
}) {
  const issues = safeList(keyIssues);
  const showTechnical = isAnalystView(viewMode);

  if (issues.length === 0) {
    return (
      <div className="rounded-[22px] border border-gray-100 bg-gray-50/60 p-8 text-center">
        <p className="text-[14px] font-bold text-gray-400">No structured key issues available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {issues.map((issue, index) => (
        <article key={issue.id || index} className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${getPriorityTone(issue.severity)}`}>
              {issue.severity}
            </span>
            <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-500">
              {formatLayerKey(issue.affected_layer)}
            </span>
          </div>
          <h3 className="mb-3 text-[20px] font-black tracking-tight text-[#1A212B]">{issue.issue_title}</h3>
          <p className="mb-4 text-[14px] font-medium leading-relaxed text-gray-600">{issue.explanation}</p>
          {issue.why_it_matters && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="mb-1 text-[12px] font-black uppercase tracking-[0.12em] text-blue-500">Why it matters</p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-700">{issue.why_it_matters}</p>
            </div>
          )}
          <div className="space-y-3">
            <V21EvidenceList evidenceItems={issue.evidence_items} viewMode={viewMode} density="compact" />
            <V21ActionItems
              actions={issue.recommended_actions}
              viewMode={viewMode}
              maxItems={showTechnical ? undefined : 2}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
