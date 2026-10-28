"use client";
import {useId} from "react";
import type {ComparisonView} from "@/lib/comparison-checks/types";
import {buildMetricReading, resolutionNumber} from "@/lib/comparison-checks/metric-reading";
import {checkStates} from "@/lib/comparison-checks/copy";

const count = (n: number) => n.toLocaleString("en-US");
export function MetricReadingGuide({result}: {result: ComparisonView["result"]}) {
  const heading = useId(), guide = buildMetricReading(result);
  if (!guide) return <p role="alert">These values could not be checked consistently. Reopen the saved comparison before interpreting them.</p>;
  const blocked = guide.state === "unavailable";
  return <section aria-labelledby={heading} className="space-y-3 rounded-xl border border-[#dce6d9] bg-[#f7f9f5] p-4">
    <header><h5 id={heading} className="text-sm font-semibold">What these numbers can support</h5><p className="mt-1 text-xs">Reading aid · saved result unchanged. Numerical resolution is not confidence or proof of an SEO effect.</p></header>
    {blocked ? <div className="rounded-lg bg-white p-3 text-sm"><p className="font-semibold">{checkStates[result.state]} · no trend interpretation</p><p className="mt-1">{result.state === "waiting"
      ? "Wait for the full after period and its data. Then run a new check; this saved check will not update itself."
      : "Resolve the date, source or scope issues listed above before interpreting a change. Do not substitute zero for missing observations."}</p></div>
      : <div className="grid gap-3 lg:grid-cols-3">{guide.metrics.map(m => <div key={m.metric} className="min-w-0 space-y-2 rounded-lg border border-[#dce6d9] bg-white p-3 text-xs">
        <h6 className="text-sm font-semibold">{m.metric === "ctr" ? "CTR · check the denominator" : m.metric === "clicks" ? "Clicks · count first" : "Impressions · visibility, not visits"}</h6>
        <p className="break-words font-semibold">{m.metric === "ctr"
          ? `${count(m.before_count)} / ${count(m.before_denominator!)} → ${count(m.after_count)} / ${count(m.after_denominator!)} clicks / impressions`
          : `${count(m.before_count)} → ${count(m.after_count)} ${m.metric}`}</p>
        {m.metric === "ctr" ? <>
          <p>{m.notes.includes("ZERO_IMPRESSIONS") ? "A period has no impressions. Its CTR and a CTR change cannot be calculated." : "CTR uses total clicks divided by total impressions in each period."}</p>
          <p>A one-click difference at fixed impressions changes CTR by {m.before_rate_step_pp === null ? "an undefined amount" : `${resolutionNumber(m.before_rate_step_pp)} pp`} before and {m.after_rate_step_pp === null ? "an undefined amount" : `${resolutionNumber(m.after_rate_step_pp)} pp`} after.</p>
          {m.notes.includes("UNCHANGED_CTR") ? <p>The ratios are equal; that does not establish no effect or equal traffic volume.</p> : null}
          <p className="border-t border-[#edf1e9] pt-2">Next: check the same page/query mix and search context before explaining the rate change.</p>
        </> : <>
          {m.relative_step_pp === null ? <p>The baseline is zero. Use the absolute difference; a percentage increase is undefined.</p>
            : <p>With the baseline fixed at {count(m.before_count)}, one {m.metric === "clicks" ? "click" : "impression"} of difference in the after total moves relative change by {resolutionNumber(m.relative_step_pp)} percentage points.</p>}
          {m.notes.includes("ONE_COUNT_DIFFERENCE") ? <p className="font-semibold">The entire observed difference is one {m.metric === "clicks" ? "click" : "impression"}. A percentage alone can obscure its scale.</p> : null}
          {m.notes.includes("UNCHANGED_COUNT") ? <p>Equal totals do not establish that the work had no effect.</p> : null}
          <p className="border-t border-[#edf1e9] pt-2">{m.metric === "clicks" ? "Next: review the absolute difference and another comparable period before describing a sustained trend." : "Next: review demand and the search mix. Impressions are not visits, enquiries or revenue."}</p>
        </>}
      </div>)}</div>}
    <details className="text-xs"><summary className="cursor-pointer font-semibold">How this reading aid is calculated</summary><p className="mt-2">Count resolution: 100 ÷ baseline count, in percentage points of relative change. CTR resolution: 100 ÷ impressions, in percentage points of CTR, separately for each period. These are arithmetic steps, not error bars, a sample-size pass mark or a significance test. Larger counts do not automatically qualify an effect claim.</p><p className="mt-2 break-words">Reading rules: {guide.ruleset_version}. The original comparison and its saved rules are unchanged.</p></details>
  </section>;
}
