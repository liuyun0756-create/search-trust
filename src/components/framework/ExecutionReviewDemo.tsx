"use client";

import { useState } from "react";
import { createExecutionDraft, formatDemoMetric, getReviewMetrics, reviewScenarios, serializeExecutionDraft, type ReviewScenario, type ReviewScope } from "./execution-demo-data";

const changes = [
  ["Service introduction", "A general description of the service.", "Confirmed services and service areas are explained."],
  ["Service process", "No explanation of what happens after contact.", "A client-confirmed service process is included."],
  ["Contact guidance", "The next step is unclear.", "The information to provide and the enquiry route are explained."],
];

export function ExecutionReviewDemo() {
  const [scope, setScope] = useState<ReviewScope>("search");
  const [scenario, setScenario] = useState<ReviewScenario>("positive");
  const metrics = getReviewMetrics(scope, scenario);
  const selection = reviewScenarios[scenario];
  const button = (active: boolean) => `min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526c16] ${active ? "border-[#172018] bg-[#172018] text-white" : "border-[#cbd3c0] bg-white text-[#263226] hover:bg-[#eef3e5]"}`;

  return (
    <div className="mt-8">
      <div className="border-y border-[#cbd3c0] bg-[#e9eddf] p-5 sm:p-7">
        <p className="text-xs font-bold uppercase leading-6 tracking-[0.15em] text-[#526c16]">Comparison demo · Simulated data, not a client result</p>
        <dl className="mt-4 grid gap-5 text-sm leading-7 sm:grid-cols-2 lg:grid-cols-3">
          {[["Work target", "The air conditioning repair service page."], ["Changes in this example", "Service explanation, service process and contact guidance."], ["Implementation date", "To be confirmed by the SEO; no real implementation date is recorded."], ["Comparison windows", "Selected periods before and after implementation. This demo uses simulated periods, not actual dates."], ["Data status", selection.status]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="mt-1 text-[#586452]">{value}</dd></div>)}
        </dl>
      </div>

      <div className="mt-9">
        <h4 className="text-xl font-semibold leading-8">First, confirm what was actually changed.</h4>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#586452]">Changed sections are shown below. This is a fixed illustration—not a published version of your edited demo draft.</p>
        <div className="mt-5 divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">{changes.map(([label, before, after]) => <div key={label} className="py-5"><h5 className="text-sm font-bold">{label}</h5><div className="mt-3 grid gap-4 md:grid-cols-2"><div className="border-l-2 border-[#cbd3c0] pl-4"><p className="text-xs font-bold uppercase tracking-wider text-[#586452]">Before</p><p className="mt-2 text-base leading-7 text-[#586452]">{before}</p></div><div className="border-l-2 border-[#637e16] bg-[#edf2e2] px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-[#526c16]">After · Illustrated change</p><p className="mt-2 text-base leading-7">{after}</p></div></div></div>)}</div>
        <details className="mt-5 border border-[#d8ddcf] bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#526c16]">View full content</summary>
          <p className="mt-4 text-sm leading-7 text-[#586452]">The service-page heading is unchanged. Bracketed fields in the example copy still represent client-confirmed information to insert; no real business details or publication are implied.</p>
          <div className="mt-5 grid gap-7 md:grid-cols-2"><div><h5 className="text-sm font-bold">Before · Fictional content</h5><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#586452]">{"Air conditioning repair\n\nWe provide air conditioning repair services. Contact us for more information."}</p></div><div><h5 className="text-sm font-bold">After · Example copy</h5><p className="mt-3 text-sm leading-7 text-[#586452]">Air conditioning repair</p><pre className="mt-3 whitespace-pre-wrap break-words font-[inherit] text-sm leading-7 text-[#586452]">{serializeExecutionDraft(createExecutionDraft())}</pre></div></div>
        </details>
      </div>

      <section aria-labelledby="execution-metrics-title" className="mt-10 border border-[#d8ddcf] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase leading-6 tracking-[0.15em] text-[#526c16]">Simulated data · Air conditioning repair service page</p>
        <h4 id="execution-metrics-title" className="mt-3 text-xl font-semibold leading-8">Then check how the relevant performance changed.</h4>
        <div className="mt-6 space-y-5">
          <div role="group" aria-label="Metric scope"><p className="mb-2 text-sm font-bold">Metric scope</p><div className="flex flex-wrap gap-2">{([['search', 'Search performance'], ['onsite', 'On-site behavior']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} className={button(scope === value)} onClick={() => setScope(value)}>{label}</button>)}</div></div>
          <div role="group" aria-label="Demo scenario"><p className="mb-2 text-sm font-bold">Demo scenario</p><div className="flex flex-wrap gap-2">{(Object.keys(reviewScenarios) as ReviewScenario[]).map((value) => <button key={value} type="button" aria-pressed={scenario === value} className={button(scenario === value)} onClick={() => setScenario(value)}>{reviewScenarios[value].label}</button>)}</div></div>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <figure className="min-w-0 bg-[#f3f4ed] p-4 sm:p-5">
            <figcaption className="text-sm font-semibold">Simulated period comparison · {selection.label}</figcaption>
            <p className="mt-2 text-xs leading-6 text-[#586452]">Each metric has its own zero-based scale. Compare the two periods within a metric, not across different metrics. Exact values are in the table.</p>
            <div aria-hidden="true" className="mt-5 space-y-6">{metrics.map((metric) => {
              const max = Math.max(metric.before, metric.after ?? metric.before, 1);
              return <div key={metric.label}><p className="text-sm font-semibold">{metric.label}</p><div className="mt-3"><p className="mb-1 text-xs text-[#586452]">Before · {formatDemoMetric(metric.before, metric.percentage)}</p><div className="h-3 border border-[#889575] bg-[#d9dfce]" style={{ width: `${metric.before / max * 100}%` }} /></div><div className="mt-3"><p className="mb-1 text-xs text-[#586452]">After · {formatDemoMetric(metric.after, metric.percentage)}</p>{metric.after === null ? <p className="border border-dashed border-[#a8b498] p-2 text-xs leading-5 text-[#586452]">No comparable later-period data</p> : <div className="h-3 bg-[#526c16]" style={{ width: `${metric.after / max * 100}%` }} />}</div></div>;
            })}</div>
          </figure>
          <div className="min-w-0">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="mb-4 text-left text-sm font-semibold">{scope === "search" ? "Search performance" : "On-site behavior"} · Simulated values</caption>
              <thead className="sr-only sm:not-sr-only sm:table-header-group"><tr className="border-b border-[#d8ddcf]"><th scope="col" className="w-[31%] py-3 pr-2">Metric</th><th scope="col" className="py-3 pr-2">Before</th><th scope="col" className="py-3 pr-2">After</th><th scope="col" className="py-3">Change</th></tr></thead>
              <tbody>{metrics.map((metric) => <tr key={metric.label} className="block border-b border-[#d8ddcf] py-3 sm:table-row"><th scope="row" className="block py-2 text-left font-semibold sm:table-cell sm:py-4 sm:pr-3">{metric.label}</th>{[["Before", formatDemoMetric(metric.before, metric.percentage)], ["After", formatDemoMetric(metric.after, metric.percentage)], ["Change", metric.change]].map(([label, value]) => <td key={label} className="flex justify-between gap-4 py-2 text-[#586452] sm:table-cell sm:py-4 sm:pr-2"><span aria-hidden="true" className="font-medium sm:hidden">{label}</span><span className="text-right sm:text-left">{value}</span></td>)}</tr>)}</tbody>
            </table>
            {scope === "onsite" && <p className="mt-4 text-sm leading-7 text-[#586452]">Example key events are event counts—not completed sales or counts of qualified leads.</p>}
          </div>
        </div>
        <div role="status" aria-live="polite" className="mt-6 border-l-2 border-[#637e16] pl-4"><p className="text-sm font-bold">{selection.label}</p><p className="mt-2 max-w-3xl text-base leading-7 text-[#586452]">{selection.explanation}</p></div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#586452]">The comparison describes changes. It does not establish that this page edit caused them. Scenario switches use local simulated data and do not call a live data source.</p>
      </section>
    </div>
  );
}
