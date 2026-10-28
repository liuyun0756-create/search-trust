import type {ComparisonView} from "./types";
import type {MetricReading, MetricReadingGuide} from "./metric-reading-types";

export const metricReadingVersion = "v22_metric_resolution_v1";
type Result = ComparisonView["result"];
const equalReasons = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Existing contract semantics only; no volume threshold or inferred effect.
 * Called after schema validation. The gateway separately checks the digest.
 */
export function metricArithmeticValid(r: Pick<Result, "state" | "metrics">): boolean {
  if (r.state !== "comparable") return r.metrics.length === 0;
  if (r.metrics.map(m => m.metric).join() !== "clicks,impressions,ctr") return false;
  const [clicks, impressions, ctr] = r.metrics;
  const values = [clicks.before, clicks.after, impressions.before, impressions.after];
  if (values.some(n => n === null || !Number.isSafeInteger(n) || n < 0)) return false;
  const [cb, ca, ib, ia] = values as number[];
  if (cb > ib || ca > ia) return false;
  for (const m of [clicks, impressions]) {
    const a = m.before!, b = m.after!;
    if (m.unit !== "count" || m.state !== "comparable" || m.absolute_change !== b - a
      || m.relative_change !== (a ? (b - a) / a : null) || m.percentage_point_change !== null
      || !equalReasons(m.reasons, a ? [] : ["ZERO_BASELINE_NO_RELATIVE_CHANGE"])) return false;
  }
  const a = ib ? cb / ib : null, b = ia ? ca / ia : null;
  const delta = a !== null && b !== null ? b - a : null;
  return ctr.unit === "ratio" && ctr.state === (delta === null ? "insufficient" : "comparable")
    && ctr.before === a && ctr.after === b && ctr.absolute_change === delta && ctr.relative_change === null
    && ctr.percentage_point_change === (delta === null ? null : delta * 100)
    && equalReasons(ctr.reasons, delta === null ? ["ZERO_IMPRESSIONS_NO_CTR"] : []);
}

/** Read-only aid bound to the saved checksum, never merged into a saved result. */
export function buildMetricReading(r: Result): MetricReadingGuide | null {
  if (!metricArithmeticValid(r)) return null;
  const metrics: MetricReading[] = [];
  if (r.state === "comparable") {
    const [clicks, impressions] = r.metrics;
    for (const m of [clicks, impressions]) {
      const before = m.before!, after = m.after!, notes: MetricReading["notes"] = [];
      if (before === 0) notes.push("ZERO_BASELINE");
      if (before === after) notes.push("UNCHANGED_COUNT");
      else if (Math.abs(after - before) === 1) notes.push("ONE_COUNT_DIFFERENCE");
      metrics.push({metric: m.metric, before_count: before, after_count: after, before_denominator: null, after_denominator: null,
        relative_step_pp: before ? 100 / before : null, before_rate_step_pp: null, after_rate_step_pp: null, notes});
    }
    const cb = clicks.before!, ca = clicks.after!, ib = impressions.before!, ia = impressions.after!;
    metrics.push({metric: "ctr", before_count: cb, after_count: ca, before_denominator: ib, after_denominator: ia,
      relative_step_pp: null, before_rate_step_pp: ib ? 100 / ib : null, after_rate_step_pp: ia ? 100 / ia : null,
      notes: !ib || !ia ? ["ZERO_IMPRESSIONS"] : BigInt(cb) * BigInt(ia) === BigInt(ca) * BigInt(ib) ? ["UNCHANGED_CTR"] : []});
  }
  return {schema_version: "v22_metric_reading_v1", ruleset_version: metricReadingVersion, comparison_checksum: r.checksum,
    state: metrics.length ? "descriptive_only" : "unavailable", blocked_reasons: [...r.reasons], metrics: metrics as MetricReadingGuide["metrics"],
    inference_status: "not_calibrated", calibrated_threshold: null, effect_conclusion: null, causal_attribution: false};
}

export function resolutionNumber(value: number): string {
  // Never render a positive granularity as 0.00. It is resolution, not confidence.
  return value > 0 && value < .01 ? value.toExponential(2) : value.toLocaleString("en-US", {maximumFractionDigits: 2});
}
