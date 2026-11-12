import {KeywordVisibilitySection} from "./KeywordVisibilitySection";
import {clientActions} from "@/lib/report-capability/action-visibility";
import type { CapabilityReadingDocument as Document } from "@/lib/report-capability/reading-document";
import { evidenceFieldLabel, evidenceValue, readerLimits, readerLimitDetails, readerTarget, readerDate, readerScope, evidenceSourceLabel, evidenceScopes, findingLabels, readerFinding, contactCheckLabel } from "@/lib/report-capability/reader-copy";

export function CapabilityReportDocument({ document, technicalDetails = false }: { document: Document; technicalDetails?: boolean }) {
  const actions=technicalDetails ? document.actions : clientActions(document.actions);
  const target = (value: string) => technicalDetails ? value : readerTarget(value);
  const limitDetails = readerLimitDetails(document.limitations);
  return <article className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-[#dce6d9] bg-white p-5 text-[#1d2a22] sm:p-10">
    <header><h1 className="break-words text-3xl font-semibold tracking-tight">{document.title}</h1>
      <p className="mt-4 whitespace-pre-wrap break-words leading-7">{document.summary}</p>
      <p className="mt-4 rounded-xl bg-[#eaf2e6] p-4 font-medium">{actions.length ? `First proposed step: ${actions[0].title}` : "No change is proposed from this evidence. Review the diagnosis and unresolved checks."}</p></header>
    {document.keywordVisibility ? <KeywordVisibilitySection value={document.keywordVisibility} technicalDetails={technicalDetails}/> : null}
    {document.contactChecks?.length ? <section aria-label="Business details check" className="space-y-3">
      <h2 className="text-xl font-semibold">Business details check</h2>
      <ul className="space-y-2 text-sm">{document.contactChecks.map(check=><li key={check.field}>{contactCheckLabel(check)}</li>)}</ul>
    </section> : null}
    <section aria-label="Findings" className="space-y-5">{document.findings.map((finding) => { const labels=findingLabels(finding), copy=technicalDetails?finding:readerFinding(finding); return <div key={finding.id} className="rounded-xl bg-[#f3f7f2] p-5">
      <h2 className="break-all font-semibold">{target(finding.target)}</h2>
      <p aria-label="Finding classification" className="mt-2 text-sm font-medium">{labels.kind} · {labels.status}</p>
      <p className="mt-2 text-sm">Coverage for this finding</p>
      <ul aria-label="Finding coverage" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{labels.coverage.length ? labels.coverage.map(item=><li key={item}>{item}</li>) : <li>Coverage: Unlabelled</li>}</ul>
      <p className="mt-2 break-words">{copy.observed_fact}</p>
      <p className="mt-2 break-words">{copy.judgment}</p>
      <p className="mt-2 break-words text-sm">{copy.impact_path}</p>
      <p className="mt-3 break-words text-sm">{technicalDetails ? finding.comparison_scope : readerScope(finding.comparison_scope)} · {technicalDetails ? finding.observed_at : readerDate(finding.observed_at)}</p>
      <dl className="mt-4 space-y-2 text-sm">{document.evidence.filter((e) => finding.evidence_ids.includes(e.id)).map((e) => <div key={e.id}>
        <dt className="break-all font-semibold">{!technicalDetails ? `${evidenceSourceLabel(e.source_kind)} · ` : ""}{evidenceFieldLabel(e.field_path)} · {e.object}</dt><dd className="break-words">{evidenceValue(e.value)}{e.unit ? ` ${e.unit}` : ""} · {technicalDetails ? e.observed_at : readerDate(e.observed_at)}</dd>
      </div>)}</dl>
      {!technicalDetails ? <ul aria-label="Evidence scope" className="mt-2 space-y-1 text-sm">{evidenceScopes(document.evidence.filter(e => finding.evidence_ids.includes(e.id))).map(scope => <li key={scope}>{scope}</li>)}</ul> : null}
      {technicalDetails ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Inspect source references</summary>
        <dl className="mt-3 space-y-3">{document.evidence.filter(e => finding.evidence_ids.includes(e.id)).map(e => <div key={e.id}><dt className="break-all">{e.object}</dt><dd className="whitespace-pre-wrap break-all font-mono text-xs">{e.field_path}</dd></div>)}</dl>
      </details> : null}
      {finding.limitations.length ? <ul aria-label="Finding limits" className="mt-3 list-inside list-disc space-y-1 text-sm">{readerLimits(finding.limitations).map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul> : null}
    </div>; })}</section>
    <section aria-label="Action plan" className="space-y-5">
      <h2 className="text-xl font-semibold">{actions.length ? "Action plan" : "No action proposed yet"}</h2>
      {!actions.length ? <p>The available evidence does not support an action. Review the findings and limits before deciding what to investigate next.</p> : null}
      {actions.map((action) => <section key={action.id} className="rounded-xl border border-[#dce6d9] p-5">
        {technicalDetails && action.needsVerification ? <p className="mb-2 text-sm font-medium">Verify first · 建议先核实</p> : null}
        <h3 className="break-words font-semibold">{String(action.sequence).padStart(2, "0")} · {action.title}</h3>
        <p className="mt-2 whitespace-pre-wrap break-all text-sm">{target(action.target)}</p>
        {action.whyNow ? <aside className="mt-4 rounded-xl border border-[#dce6d9] bg-[#f3f7f2] p-4 text-sm">
          <p className="font-semibold">{action.whyNow.candidateSelection ? "Advisor-selected action" : action.whyNow.deliveryChanged ? `System recommendation · original position ${action.whyNow.systemPosition}` : "Why now"}</p>
          <p className="mt-2 leading-6">{action.whyNow.explanation}</p>
          {action.whyNow.deliveryChanged ? <p className="mt-2 leading-6">The delivery plan was edited. This rationale describes the original recommendation: {action.whyNow.systemTitle} · {target(action.whyNow.systemTarget)}</p> : null}
          <details className="mt-3">
            <summary className="cursor-pointer font-medium text-[#315a41] focus-visible:outline-2 focus-visible:outline-offset-4">Inspect the priority basis</summary>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div><dt className="font-semibold">Prerequisites</dt><dd className="mt-1 leading-6">{action.whyNow.prerequisites.join("; ") || "No explicit prerequisite action recorded."}</dd></div>
              <div><dt className="font-semibold">Business relevance</dt><dd className="mt-1 leading-6">{action.whyNow.business}</dd></div>
              <div><dt className="font-semibold">Evidence</dt><dd className="mt-1 leading-6">{action.whyNow.evidence}</dd></div>
              <div><dt className="font-semibold">Execution conditions</dt><dd className="mt-1 leading-6">{action.whyNow.execution}</dd></div>
            </dl>
            <p className="mt-4 font-semibold">Potential impact path</p>
            {action.whyNow.impactPaths.map((path,i) => <p key={i} className="mt-1 leading-6">{path}</p>)}
            <p className="mt-4 font-semibold">Checked scope</p>
            {[...new Set(action.whyNow.comparisonScopes.map(target))].map((scope,i) => <p key={i} className="mt-1 break-words leading-6">{scope}</p>)}
            {action.whyNow.limits.map((limit,i) => <p key={i} className="mt-4 leading-6 text-[#52685b]">{limit}</p>)}
            {technicalDetails ? <p className="mt-3 break-words text-xs text-[#52685b]">Rule: {action.whyNow.rulesVersion} · {action.whyNow.reasonCodes.join(" · ")}</p> : null}
          </details>
        </aside> : null}
        <ol className="mt-4 list-inside list-decimal space-y-2">{action.steps.map((step, i) => <li key={i} className="break-words">{target(step)}</li>)}</ol>
        <p className="mt-4 font-semibold">Completion checks</p><ul className="mt-2 list-inside list-disc">{action.completion.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
        <p className="mt-4 break-words text-sm">{action.review}</p>
        {action.materials.map((material) => <aside key={material.id} className="mt-5 rounded-xl bg-[#f3f7f2] p-4">
          <h4 className="break-words font-semibold">{material.title}</h4>
          <p className="mt-1 text-sm">{material.readiness === "requires_confirmation" ? "Confirm before publishing" : material.readiness === "ready_to_use" ? "Ready for your review" : "Execution instructions"}</p>
          <p className="mt-2 break-all text-sm">Material target: {target(material.target)}</p>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7">{material.body}</p>
          {material.confirmation_items.length ? <ul aria-label="Confirmation needed" className="mt-3 list-inside list-disc space-y-1 text-sm">{material.confirmation_items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul> : null}
        </aside>)}
      </section>)}
    </section>
    {document.clientNote ? <aside className="rounded-xl bg-[#f3f7f2] p-5"><h2 className="font-semibold">Note from your SEO</h2><p className="mt-2 whitespace-pre-wrap break-words">{document.clientNote}</p></aside> : null}
    <footer><h2 className="font-semibold">Review limits</h2><ul className="mt-2 space-y-2">{readerLimits(document.limitations, true).map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
      {limitDetails.length ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Technical details</summary>
        <ul aria-label="Detailed review limits" className="mt-3 space-y-3">{limitDetails.map((item, i) => <li key={i} className="whitespace-pre-wrap break-words">{item}</li>)}</ul>
      </details> : null}
    </footer>
  </article>;
}
