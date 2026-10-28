# P5 metric calibration status — 2026-10-23

## Decision

**Arithmetic interpretation accepted locally; empirical effect qualification NOT calibrated.** No universal minimum count, confidence label or significance threshold is approved. `effect_eligibility` remains `pending_metric_specific_calibration` in comparable saved results. `effect_conclusion` remains null; causal attribution remains false. This document does not close P5-02.

The new `v22_metric_resolution_v1` guide is derived at read time, bound to the original checksum and explicitly separate from the saved `v22_comparison_descriptive_v1` record. It is not a new report, stored finding, provider result or credit-consuming operation.

## Directed arithmetic matrix

Sixteen exported, synthetic vectors plus parameterized denominator/count tests. These are constructed mathematical cases, **not** collected customer data, source-backed case studies, measured results or empirical calibration. Their source metadata comes from controlled existing fixtures and must not be represented as observations of those counts.

| Directed case | What can be displayed | What it does not establish |
|---|---|---|
| Clicks 1→2 vs 100→200 | Both +100%; one-count resolution 100 vs 1 percentage point of relative change | Neither is automatically significant, stable or caused by implementation |
| Baseline 0→positive | Absolute counts; relative change and relative resolution undefined | Not infinite growth or automatic success |
| Positive→0 | Absolute loss and valid relative change; original counts retained | Not proof that SEO harmed the page |
| Both periods zero / a zero impression denominator | No CTR for the zero-impression period; no CTR change | Missing denominator is not a measured zero CTR |
| Equal counts | Literal equality | No-effect conclusion |
| CTR 10/200→40/800 | Same 5% ratio, different traffic volume; resolution 0.5 vs 0.125 pp | Equal ratios do not imply equal volume or no effect |
| Same clicks, changed impressions | Two original fractions and separate denominator resolution | Not a click-count-based CTR pass mark |
| CTR at 100% | One-click step size at fixed impressions, without suggesting impossible extra clicks | No unbounded or guaranteed rate increase |
| Very large / maximum safe counts | Positive resolution stays positive in UI; exact integer ratio equality check | Large volume alone does not qualify an effect claim |
| Missing GSC source / restricted GA4 | No per-metric trend cards; source/scope/date next checks retained | No synthetic zeros or permission to mix channels |
| Re-signed inconsistent values | Owner gateway rejects wrong units, counts, deltas, ratios, reasons and order | A checksum alone is not evidence of mathematical validity |

The reference tests additionally cover 12 baseline counts and 25 before/after denominator combinations. The frontend matches the backend's 16 exported vectors exactly. Ratio equality uses integer cross-products to avoid false equality from rounded floating-point division. These checks validate implementation of formulas, not the validity of a statistical model.

## What is still required before empirical qualification

1. Use authorized, representative observations with provenance and independently checked date/scope/aggregation completeness. No production data was requested or collected in this batch.
2. Define the intended descriptive claim separately for clicks, impressions and CTR; do not reuse a single count threshold. Distinguish arithmetic resolution from uncertainty and from causality.
3. Evaluate sparse/dense pages, seasonal demand, changing query mix, implementation overlaps and source omissions. Aggregate totals alone cannot determine these factors or a defensible minimum sample size.
4. Predefine an evaluation and review protocol, assess false-positive/false-negative behavior on held-out cases, document supported and unsupported situations, and freeze any accepted rule with its provenance/version. This batch selects no target error rate or acceptance threshold without evidence.
5. Publish any future qualified interpretation separately/versioned without rewriting historical comparisons. Continue withholding causal attribution unless a separately justified design supports it.

Until then: show counts, denominators and limits; preserve pending qualification. Next safe implementation work remains GA4 completeness/channel/event-history qualification and controlled page checks. Attachments and newly charged Verified reviews also remain open. D1 remains unchanged: a normally completed diagnosis with no justified actions delivers, consumes one point and is not refunded.
