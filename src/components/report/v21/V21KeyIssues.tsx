import type { KeyIssue } from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
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
      {issues.map((issue, index) => {
        const judgement = issue.judgement || issue.explanation;
        const explanation = sameText(issue.explanation, judgement) ? "" : issue.explanation;
        const impacts = uniqueContent(issue.impacts, [judgement, explanation, issue.why_it_matters]);
        const suggestions = uniqueContent(issueSuggestions(issue), [judgement, explanation, issue.why_it_matters]);
        return (
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
          <ContentBlock title="Judgement" value={judgement} emphasized />
          <ContentBlock title="Explanation" value={explanation} />
          {issue.why_it_matters && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="mb-1 text-[12px] font-black uppercase tracking-[0.12em] text-blue-500">Why it matters</p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-700">{issue.why_it_matters}</p>
            </div>
          )}
          {(impacts.length > 0 || suggestions.length > 0) && (
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ListBlock title="Impacts" values={impacts} />
              <ListBlock title="Suggestions" values={suggestions} />
            </div>
          )}
          <div className="space-y-3">
            <V21ActionItems
              actions={issue.recommended_actions}
              viewMode={viewMode}
              maxItems={showTechnical ? undefined : 2}
            />
          </div>
          </article>
        );
      })}
    </div>
  );
}

function ContentBlock({ title, value, emphasized = false }: { title: string; value?: string | null; emphasized?: boolean }) {
  if (!value) return null;
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{title}</p>
      <p className={`${emphasized ? "font-bold text-[#1A212B]" : "font-medium text-gray-600"} text-[14px] leading-relaxed`}>{value}</p>
    </div>
  );
}

function ListBlock({ title, values }: { title: string; values?: string[] | null }) {
  const items = safeList(values).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{title}</p>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function issueSuggestions(issue: KeyIssue): string[] {
  const explicit = safeList(issue.suggestions).filter(Boolean);
  if (explicit.length) return explicit;
  return safeList(issue.recommended_actions)
    .map((action) => action.task_title)
    .filter(Boolean);
}

function uniqueContent(values: string[] | null | undefined, excluded: Array<string | null | undefined>): string[] {
  const excludedKeys = new Set(excluded.filter((value): value is string => Boolean(value)).map(normalizeText));
  const seen = new Set<string>();
  return safeList(values).filter((value) => {
    const key = normalizeText(value);
    if (!key || excludedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameText(left?: string | null, right?: string | null): boolean {
  return Boolean(left && right && normalizeText(left) === normalizeText(right));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
