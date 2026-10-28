# P5 GA4 exact-window collection and qualification foundation

Authority: user approved the proposed first step on 2026-10-23. Implement the internal collection/qualification foundation now; owner confirmation, durable task storage and UI are the next slice. The prior discussion covered alternatives and explicitly rejected merely relaxing old comparison restrictions. This document records the accepted scope rather than requesting another design cycle. No commit, deployment, actual flag change, real provider request or credit operation.

## Accepted boundaries and implementation decisions

Keep ordinary `ga4_sync_v1`, its two adjacent 90-day periods, the existing GSC collector and `v22_comparison_descriptive_v1` untouched. Add a distinct exact GA4 envelope so new material cannot silently be consumed as an old trusted snapshot. Reuse the implementation-calendar planner, provider request/error/response-size controls and Redis cost ledger.

Plan binds owner, Case, report, approved delivery, implementation checksum, selected action, GA4 property/binding, confirmed lowercase hostname scope, IANA property timezone, optional exact landing path and 7/14/28/90-day windows. The caller must resolve these from an authorized saved record/resource; this internal function does not implement authorization. Natural search is fixed to sessionDefaultChannelGroup = Organic Search plus web/platform and hostname filters. A landing path is filtered in every report rather than searched for in a top-row list. No query strings, arbitrary dimension combinations, URLs or caller-supplied endpoints. A property-wide selection remains restricted to the explicit website hosts, not the whole GA4 property.

Before the after-window finishes in the property timezone, return waiting with zero requests. Calendar elapsed means collection can be attempted, not that processing is final. For each period, request exact-window totals, daily coverage observations and event-name key-event rows: six bounded Data API calls total. Reuse the existing eight-report job budget, 20 configuration-page job budget, fixed endpoints, per-response 2 MB budget and 240-second collection envelope. Read current key-event settings before and after collection using the same shared ledger. No automatic retry, arbitrary pagination or budget reset; no partial success envelope on an exception.

Snapshot preserves exact query scope, both windows, per-view restrictions/timezone, observed daily rows, original provider aggregate values, event configuration observations and collection timestamps. Missing days or empty results remain missing, not zeros. Do not sum daily session estimates, average rates or derive lead counts. Validate duplicate/out-of-range dates, bounds, scopes, timezones, configuration order/uniqueness and hashes on envelope reparse, including re-signed malformed fixtures.

Qualification reports structural reasons and separates traffic metrics from key-event metrics. Common checks include empty totals, incomplete date observations, restricted/sampled/thresholded reports and unknown processing completeness. Key-event checks additionally include truncated/empty event data, absent/changed/unspecified settings, events created during/after the period and unverified history. Equal settings observed minutes apart do not prove unchanged settings over the comparison windows. No finality watermark is manufactured from a 48-hour delay. Traffic metric checks do not depend on configured key events; key-event checks do. All effect conclusions remain null, and no deltas or qualified-effect status are added in this foundation.

The collection envelope and qualification rules are separately versioned and checksummed. Validation recomputes qualification from source material; consumers cannot re-sign a success or remove a blocker. No writes to ordinary latest sync or old comparisons. New fixtures are synthetic contract/test material, not real customer records.

## Execution and acceptance

1. Add strict plan/snapshot/qualification contracts and pure evaluator.
2. Add fixed-query provider and saved-record planner/collector with existing cost controls.
3. Test all window lengths, timezone exclusion, zero-I/O waiting/invalid requests, exact organic/path filters, restrictions/missing/zero data, event configuration/history, errors, timeout/cancellation, cost exhaustion and tampering. Check ordinary sync and frozen comparisons remain unchanged.
4. Export additive schema and synthetic fixtures for shared-contract verification. Run backend fast suite and existing exports; run frontend contract tests/typecheck/build if frontend artifacts are added. No browser changes in this slice, so do not claim new UI acceptance.
5. Update verification/progress and before/after recovery audit. Do not close P5-02, P5 or P6.

Skill handling: brainstorming design was approved in the preceding exchange. The writing-plans skill is unavailable, so this document carries the execution steps. Self-review: no incomplete requirements, no automatic effectiveness or historical-event claims, no conflict with immutable history/D1, no extra paid product, scoped to internal foundation.

## Primary definitions checked 2026-10-23

- https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema — sessionDefaultChannelGroup and Organic Search.
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData — sampling, thresholding, data loss, restrictions and timezone.
- https://support.google.com/analytics/answer/11198161?hl=en — processing/freshness is not a permanent-finality promise.
- https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.keyEvents — current configuration, creation time and counting method; not historical tag verification.
