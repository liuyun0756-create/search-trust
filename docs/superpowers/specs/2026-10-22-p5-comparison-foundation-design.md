# P5-02 comparison foundation

Authority: accepted P5 master plan and user instruction to continue. This is a bounded comparison foundation, not permission to open paid review or claim calibrated effects. Existing approved design supplies the workflow; no production flag, migration, provider call or deployment is part of this slice.

## Investigated constraints

GSC `gsc_sync_v1` has final-state daily property rows, separate 90-day single-dimension breakdowns and source timezone America/Los_Angeles. GA4 has host-filtered all-traffic daily and 90-day aggregate reports, but no organic channel, page-by-date intersection, historical event-definition or definitive completeness watermark. Existing health/binding/checksum validators must be reused. A former baseline may have expired since a legitimate earlier collection; that does not change its immutable content, whereas the new observation must be current and healthy.

## Implement now

1. Pure backend window planner with 7/14/28/90-day equal windows (default 28). Convert the entire user-reported implementation day into the source timezone and exclude every overlapping calendar date. Date-only inputs cannot establish a time within that day. Before ends before the earliest overlap; after starts after the last overlap. Handle leap years, DST and unsupported/nonexistent local dates explicitly.
2. Strict internal comparison request/result bound to exact implementation reference, selected action, explicit scope, source snapshots/checksums, evaluation time and versioned descriptive rules. No public endpoint accepts supplied snapshots. A future owner-scoped resolver must freeze/authenticate these inputs before generation.
3. Exact-source GSC daily property comparisons only with every expected date present, no duplicates/truncation, final data, matched property/binding, valid checksum/health, compatible aggregation and fresh current observation. Separate page/query/device/country comparisons require a full exact requested period; never combine unrelated breakdowns, extrapolate 90-day aggregates or treat missing rows as zero. Only one observed dimension can be selected. Page/query/device/country comparisons do not authorize unsupported intersections.
4. Calculate observed clicks/impressions, absolute and relative deltas; zero baseline has no relative percentage; derive CTR from summed clicks/impressions and use percentage-point delta, never average row CTR. Do not calculate effect labels, significance or revenue. Low-volume effect policy stays pending until representative metric-specific calibration exists.
5. GA4 adapter verifies existing saved metadata but remains blocked where finality, exact periods, channel or event-definition cannot be established. Do not sum daily session estimates into an invented exact aggregate. Do not rename all sessions as organic or key events as leads. No effect output for GA4 in this slice.
6. Free owner UI preview from the **saved** implementation revision: window length, before/after dates in implementation timezone, excluded day, time elapsed vs waiting, and explicit source-alignment/data-qualification pending. It must not use unsaved edits, claim data readiness, create jobs or consume credits. Source-specific windows can exclude more dates when timezones differ.

## States and limits

`waiting`: full after window has not elapsed or current collection does not reach it; `insufficient`: coverage/rows/denominator missing; `not_comparable`: incompatible identities, dimensions, aggregation, metadata or unsupported completeness; `comparable`: descriptive GSC values only. Every result keeps effect conclusion null and calibrated effect eligibility pending. Seasonality, other concurrent changes (unknown unless supplied), multiple saved actions and self-reported implementation are limitations, never removed by positive numbers. Invalid ownership/checksum/forged health raises an input error, not a normal insufficient result.

## Tests and deferred work

Tests: rising/falling/unchanged values, zero baseline/zero impressions, missing/duplicate dates, 90-vs-28-day mismatch, same/different properties and bindings, expired current vs historical snapshots, unsupported combined dimensions, changed URL, GA4 restrictions/definitions/finality, multiple actions, boundary timezones/DST/leap dates, frozen checksum determinism and UI save/date correction/reload. Export additive backend contract and test vectors to FE and check parity. Run existing report/credit regressions, build and mobile checks.

Deferred: immutable comparison persistence, authenticated snapshot resolver, requested-window/provider collection, metric-specific effect calibration, GA4 completeness qualification, paid review generation/PDF/share and controlled page check. Existing review SQL guard and all actual flags remain unchanged.

## Primary references checked 2026-10-22

- [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query): source date timezone, dimensions, final data and missing/top rows.
- [GA4 reporting data expectations](https://developers.google.com/analytics/devguides/reporting/data/v1/reporting-data-expectations): approximation, metadata, query matching and processing changes.
- [GA4 freshness](https://support.google.com/analytics/answer/11198161?hl=en): processing delay is not a definitive source watermark.
