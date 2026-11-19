import type {ActionAdviceView} from "@/lib/report-capability/action-advice";
import {actionAdviceFields} from "@/lib/report-capability/action-advice-fields";

export function ActionAdviceSection({advice, technicalDetails}: {advice: ActionAdviceView; technicalDetails: boolean}) {
  return <section aria-label="Structured recommendation" className="mt-4 space-y-3">
    <dl className="space-y-3">
      {actionAdviceFields(advice).map(([label, lines]) => <div key={label}>
        <dt className="font-semibold">{label}</dt>
        <dd className="whitespace-pre-wrap break-words">{lines.join("\n")}</dd>
      </div>)}
    </dl>
    {advice.example ? <div><h4 className="font-semibold">Example copy</h4><p className="break-words">{advice.example}</p></div> : null}
    {advice.reference ? <div><h4 className="font-semibold">Quote from your website</h4>
      <blockquote className="break-words">{advice.reference.text}</blockquote>
      <a className="break-all underline" href={advice.reference.url}>{advice.reference.url}</a></div> : null}
    {technicalDetails && advice.technical ? <details>
      <summary>Advice evidence and validation</summary>
      {advice.technical.rejection ? <p>{advice.technical.rejection}</p> : null}
      <p className="break-all">{advice.technical.evidenceIds.join(", ")}</p>
      {advice.technical.source ? <p className="break-all">{advice.technical.source}</p> : null}
      {advice.technical.policy ? <p>{advice.technical.policy}</p> : null}
    </details> : null}
  </section>;
}
