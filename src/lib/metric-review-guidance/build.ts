import type { ActionFacts } from "../review-reports/types";
import type { MetricReview, MetricReviewGuidance } from "./types";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { metricArithmeticValid } from "../comparison-checks/metric-reading";
import { relativePercent } from "../ga4-session-readings/contracts";

const next: Record<
  MetricReview["metric"],
  MetricReview["next_checks"][number]
> = {
  impressions: "review_demand_mix",
  clicks: "review_page_queries",
  ctr: "review_ctr_denominators",
  sessions: "review_session_measurement",
  key_events: "verify_event_history",
};
function card(
  metric: MetricReview["metric"],
  state: MetricReview["state"],
  reasons: string[] = [],
): MetricReview {
  const gate = {
    not_selected: "select_source",
    waiting: "wait_for_window",
    withheld: "resolve_source_limits",
    undefined: "obtain_impressions",
  } as const;
  return {
    metric,
    state,
    before: null,
    after: null,
    before_denominator: null,
    after_denominator: null,
    absolute_change: null,
    relative_change: null,
    percentage_point_change: null,
    notes: [],
    source_reasons: [...reasons],
    next_checks: [
      ...(state in gate ? [gate[state as keyof typeof gate]] : []),
      next[metric],
    ],
  };
}
function count(c: MetricReview, before: number, after: number) {
  Object.assign(c, {
    before,
    after,
    absolute_change: after - before,
    relative_change: before ? (after - before) / before : null,
  });
  if (!before) c.notes.push("ZERO_BASELINE");
  if (before === after) c.notes.push("UNCHANGED_COUNT");
  else if (Math.abs(after - before) === 1) c.notes.push("ONE_COUNT_DIFFERENCE");
}
/** Only call with owner-validated frozen facts. No writes, requests or decision changes. */
export function buildMetricReviewGuidance(
  a: ActionFacts,
): MetricReviewGuidance | null {
  try {
    const g = a.gsc,
      ga = a.ga4;
    if (
      g &&
      (g.scope.source !== "gsc" ||
        g.scope.channel !== "organic_search" ||
        !["property", "page", "query"].includes(g.scope.dimension) ||
        !metricArithmeticValid(g) ||
        (g.state !== "comparable" && g.reading.length))
    )
      return null;
    if (ga) {
      if (ga.scope.channel !== "organic_search") return null;
      if (ga.state === "available") {
        if (
          ga.before === null ||
          ga.after === null ||
          ga.reasons.length ||
          !Number.isSafeInteger(ga.before) ||
          !Number.isSafeInteger(ga.after) ||
          ga.before < 0 ||
          ga.after < 0 ||
          ga.difference !== ga.after - ga.before ||
          ga.relative_change_percent !== relativePercent(ga.before, ga.after)
        )
          return null;
      } else if (
        !ga.reasons.length ||
        [ga.before, ga.after, ga.difference, ga.relative_change_percent].some(
          (v) => v !== null,
        )
      )
        return null;
    }
    const metrics: MetricReview[] = [];
    for (const metric of ["impressions", "clicks", "ctr"] as const) {
      const state = !g
        ? "not_selected"
        : g.state === "comparable"
          ? "descriptive"
          : g.state === "waiting"
            ? "waiting"
            : "withheld";
      const c = card(metric, state, g?.reasons);
      if (state === "descriptive" && g) {
        const cb = g.metrics[0].before!,
          ca = g.metrics[0].after!,
          ib = g.metrics[1].before!,
          ia = g.metrics[1].after!;
        if (metric === "ctr") {
          Object.assign(c, {
            before: cb,
            after: ca,
            before_denominator: ib,
            after_denominator: ia,
            percentage_point_change: g.metrics[2].percentage_point_change,
          });
          if (!ib || !ia)
            Object.assign(c, {
              state: "undefined",
              notes: ["ZERO_IMPRESSIONS"],
              next_checks: ["obtain_impressions", next[metric]],
            });
          else if (BigInt(cb) * BigInt(ia) === BigInt(ca) * BigInt(ib))
            c.notes.push("UNCHANGED_CTR");
        } else
          count(
            c,
            metric === "impressions" ? ib : cb,
            metric === "impressions" ? ia : ca,
          );
      }
      metrics.push(c);
    }
    const state = !ga
      ? "not_selected"
      : ga.state === "available"
        ? "snapshot_only"
        : ga.reasons.includes("WINDOW_NOT_ELAPSED")
          ? "waiting"
          : "withheld";
    const sessions = card("sessions", state, ga?.reasons);
    if (ga)
      sessions.notes.push(
        "PROCESSING_NOT_ATTESTED",
        "MEASUREMENT_HISTORY_UNVERIFIED",
      );
    if (state === "snapshot_only" && ga) count(sessions, ga.before!, ga.after!);
    metrics.push(sessions);
    const events = card("key_events", ga ? "not_included" : "not_selected");
    events.notes = ["EVENT_VALUES_NOT_INCLUDED"];
    metrics.push(events);
    return {
      rules_version: "v22_metric_review_guidance_v1",
      facts_checksum: canonicalDigest(a),
      action_id: a.action_id,
      metrics: metrics as MetricReviewGuidance["metrics"],
      implementation_state: a.recorded_work.state,
      concurrent_changes: g?.concurrent_changes ?? "not_available",
      calibration_status: "not_calibrated",
      effect_conclusion: null,
      causal_attribution: false,
    };
  } catch {
    return null;
  }
}
