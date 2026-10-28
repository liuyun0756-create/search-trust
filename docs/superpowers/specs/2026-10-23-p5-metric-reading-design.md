# P5 metric-specific interpretation and calibration preparation

Authority: the user approved option 1 on 2026-10-23: validate metric-specific qualifications with directed samples, preserve old comparisons, and do not automatically conclude that SEO worked. This document records that accepted boundary. No deployment, new provider request, charge, effect threshold or statistical significance claim.

## Design

Keep `v22_comparison_descriptive_v1` and all frozen requests/results byte-compatible. Add a separate, pure, versioned reading guide derived from the already validated comparison. Label it as a reading aid, not a saved conclusion. It contains only existing counts, denominators, exact arithmetic resolution and comparison checksum. Backend reference implementation and frontend implementation share generated schema/vectors; the UI derives it without another request. No new database column, migration, flag, PDF/share promise or change to report generation.

For clicks and impressions, retain absolute counts and absolute/relative change. If baseline is positive, one count of difference in the after total changes relative change by `100 / baseline` percentage points. With zero baseline, that sensitivity and relative change are undefined, not infinity. Equal totals do not prove no effect; a difference of exactly one count is identified literally, not as a statistically validated low-volume class.

For CTR, retain both click/impression fractions. One click of difference at fixed impressions has resolution `100 / impressions` percentage points for each window separately. At 0%/100% this describes the size of a feasible one-click step, not an instruction to add an impossible click. Zero impressions make that period's CTR/resolution undefined. Do not average daily CTR, use click-count thresholds for CTR, or equate impression volume with visits/leads. No claim of sufficient sample size, confidence interval, significance, stable trend or causality.

Fail closed if metric units, integer counts, null handling, deltas, ratios or reasons disagree with the existing mathematical contract, even if a payload has been re-signed. The old engine produces the same values and checksums; this is validation of existing semantics, not a new calculation rule for old records. Invalid material yields no reading guide and is rejected by the owner response parser. A non-comparable result has no per-metric values; retain source/date/scope reasons and actionable next checks. GA4 remains withheld under current qualification rules.

## Directed validation, not fabricated calibration

Include 1→2 and 100→200 (same relative percentage, different numerical resolution); 0→positive, positive→0, unchanged, very large counts, zero impressions, unequal denominators and unchanged CTR with changed volume. Exercise a matrix across counts and denominators and verify monotonic resolution, scaling and bounded ratios. Synthetic vectors validate arithmetic and failure behavior; they cannot establish a real-world statistical adequacy threshold. Record that distinction in a calibration-status document, retaining `pending_metric_specific_calibration` and null effect conclusion. Representative real-data calibration remains an explicit release gap, not silently marked complete.

## UI and tests

Below observed values, a three-card reading aid shows raw count/fraction, granularity explanation and next review action. Neutral styling: no green success badge, inferred outcome or automatic charge/collection. Display ruleset version and explain that the saved check is unchanged. Missing/blocked comparisons show a short next-step guide, without fabricated metric cards. Mobile cards stack; use semantic headings and accessible details for supporting explanations.

Test backend arithmetic/invalid inputs/immutability, generated dual-end parity, strict frontend parsing, actual component/browser low-base/zero/blocked states, old contracts, build and existing database paths. Reuse the established intercepted TypeScript browser harness: it already mounts actual components and the owner BFF, so no separate Python server is needed. Skills used: brainstorming for accepted design boundary, React best-practice checklist and webapp-testing for regression/visual checks. `writing-plans` is unavailable; execution steps are recorded below instead. Existing dirty work is preserved; no automatic commit.

## Execution steps and self-review

1. Pure backend reading schema/reference function plus directed test matrix.
2. Deterministic exporter and frontend semantic parity with invalid-input tests.
3. Reading-aid component and integration/browser checks, preserving original result exports.
4. Full checks, calibration status, verification and progress ledger updates.

Self-review: no invented thresholds; no interpretation upgrades from large numbers; all sources/old rules and billing unchanged; no placeholders or automatic feature enablement. These steps implement the approved option, not an additional product capability.

## Primary definitions checked 2026-10-23

- [Search Console metrics](https://support.google.com/webmasters/answer/7576553?hl=en): clicks/impressions and CTR = clicks / impressions; aggregation depends on dimension.
- [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query): PT date ranges, omitted dates and top-row limitations. A missing row is not manufactured as zero by this feature.
