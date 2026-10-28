import type { MetricReview } from "./types";
export const metricNames: Record<MetricReview["metric"], string> = {
  impressions: "Search impressions",
  clicks: "Search clicks",
  ctr: "Click-through rate",
  sessions: "Organic sessions",
  key_events: "Key events",
};
export const stateNames: Record<MetricReview["state"], string> = {
  not_selected: "Source not selected",
  waiting: "Wait for the window",
  withheld: "Resolve source limits",
  undefined: "No usable denominator",
  descriptive: "Counts available",
  snapshot_only: "Snapshot counts only",
  not_included: "Event values not included",
};
export const nextChecks: Record<MetricReview["next_checks"][number], string> = {
  review_demand_mix:
    "Review demand and the query, country and device mix before attributing visibility changes to this work.",
  review_page_queries:
    "Inspect the same page and relevant queries. Check another comparable period before calling the movement a sustained trend.",
  review_ctr_denominators:
    "Read clicks and impressions together. Check whether the query mix, position or search-result presentation changed.",
  review_session_measurement:
    "Check landing-page scope, organic channel, tagging and consent changes across both periods before explaining the session movement.",
  verify_event_history:
    "Verify the event name, business meaning, counting method and configuration history in both periods before comparing key events.",
  select_source:
    "Select a saved observation for this action in the evidence workspace.",
  wait_for_window:
    "Wait for the complete after window, then collect and review a new observation. This saved snapshot will stay unchanged.",
  resolve_source_limits:
    "Resolve the source issues below before using these values to judge the work. Missing values are not zero.",
  obtain_impressions:
    "Keep the clicks and impression counts visible. A period with zero impressions has no defined CTR.",
};
export const noteCopy: Record<MetricReview["notes"][number], string> = {
  ZERO_BASELINE:
    "The baseline is zero. An absolute difference is available; percentage growth is undefined.",
  UNCHANGED_COUNT:
    "The totals are equal. That does not prove the work had no effect.",
  ONE_COUNT_DIFFERENCE:
    "The entire difference is one count. A percentage alone can overstate its scale.",
  ZERO_IMPRESSIONS:
    "At least one period has zero impressions. No CTR change is calculated.",
  UNCHANGED_CTR:
    "The two ratios are equal. Their traffic volumes may still differ.",
  PROCESSING_NOT_ATTESTED:
    "Processing completeness is not confirmed; these are the counts saved at collection time.",
  MEASUREMENT_HISTORY_UNVERIFIED:
    "Historical measurement consistency is not confirmed. Sessions are not enquiries or revenue.",
  EVENT_VALUES_NOT_INCLUDED:
    "This review does not include qualified key-event values. Session counts cannot supply them, and an event is not automatically a qualified lead.",
};
