# P5 GA4 exact-window foundation — local verification

## Approved slice and delivered behavior

Implements the first step approved on 2026-10-23: internal GA4 exact-window collection and qualification. The owner confirmation UI, durable tasks/source resolution and display are explicitly the subsequent step. Design and execution steps: [GA4 exact collection design](../specs/2026-10-23-p5-ga4-exact-collection-design.md). Brainstorming established the scope; writing-plans was unavailable, so the accepted design includes the execution checklist. No new UI, deployment, real provider/account call or automatic charge.

- New `v22_ga4_comparison_plan_v1` binds the saved implementation revision/checksum, action, owner/Case/report/delivery, property/binding, website hosts, property timezone and exact 7/14/28/90-day windows. The full implementation calendar day is excluded, including cross-timezone overlap. Invalid selections fail before I/O; waiting periods make no requests and require no ledger.
- New `ga4_comparison_observation_v1` is deliberately distinct from ordinary `ga4_sync_v1`. Every query explicitly filters web + confirmed hostnames + `sessionDefaultChannelGroup = Organic Search`; optional landing path is an exact filter in every request. No all-traffic relabeling, top-page substitution or caller-controlled endpoint.
- Six bounded Data API reports: totals, daily observations and event-name key-event rows for each window. Provider totals are preserved, never reconstructed by summing session estimates. Current event settings are read before and after collection. Timestamps, both source periods and per-view metadata are retained. An empty or missing row is not synthesized as zero.
- Reuses the existing fixed endpoints, 2 MB per-response limit, 20-second request timeout, shared Redis budget of eight GA4 report attempts / twenty configuration-page attempts, and a 240-second collection envelope. A normal unpaginated run makes eight requests (six reports + two configuration reads). There are no automatic retries or partial-success outputs. Configuration pagination and repeated calls share the same job budget; it is not reset.
- Separately versioned `v22_ga4_qualification_foundation_v1` evaluates traffic and key-event metrics independently. It records date gaps, absent aggregates, provider restrictions, zero session denominators, missing/truncated event observations, unknown/changed settings and events absent from the baseline/current settings. Event-specific issues do not incorrectly label traffic metrics as having event problems.
- Daily observation coverage is distinct from processing completeness. Processing completeness remains `not_attested`; matching current configurations do not establish historical continuity, so event history remains `unverified`. Every metric remains `not_comparable` in this foundation. No numerical differences, effectiveness/causal claim or empirical threshold is emitted.
- Collection envelope validation recomputes qualification and verifies scope, windows, timestamps and checksums. Re-signing a payload cannot remove a blocker or change its bound source/window. Raw tokens do not enter the envelope.

## What remains deliberately unchanged

The ordinary GA4 90-day collector, GSC collectors, old comparison engine/frozen rules, SQL, billing, actual flags, report generation, PDF and sharing are unchanged. A new envelope cannot masquerade as an old comparison view. These internal helpers are **not** an authorization boundary: a future owner-scoped resolver must authenticate the record/binding/confirmed website scope and recheck them at persistence/dispatch. No public route or worker currently invokes this new collector.

## Verification

- New backend suite: **69 passed**. Covers all four window lengths with website/page scope, exact queries, ledger counters/caps, zero-I/O waiting, invalid plan/clock/record, source-timezone exclusion, report errors, configuration pagination/loops, empty/gap/restricted data, metric-specific blockers, config changes, malformed/re-signed envelopes, cancellation and timeout handling.
- New + existing GA4 sync + old comparison tests: **144 passed**. Old sync still makes its original requests/90-day periods; old descriptive results and restrictions remain intact.
- Backend fast full suite: **2,574 passed**, 58 deselected, external sockets disabled.
- Native PostgreSQL 17.10 / Redis / ARQ regression: **58 passed**, 2,574 deselected, **64 existing migrations**, 51.69 seconds. Only disposable local services were used. Existing ARQ Redis `close` deprecation warning remains non-blocking. This is regression of the existing persisted workflows, **not** acceptance of new GA4 persistence, which does not yet exist.
- Frontend: **1,995 passed / 183 files**. Six new shared-contract tests check four synthetic vectors, canonical hashes, unqualified status and rejection by the old comparison parser. No production frontend code changed.
- Typecheck and production build passed. **Nine** dual-end contract/example export checks passed, including the additive GA4 contract and all eight existing exports without drift. Both repositories passed `git diff --check`.
- No browser test or visual acceptance was added/run in this backend-only slice. Existing UI is unchanged. New provider tests use `httpx.MockTransport` and a controlled clock with synthetic future periods; no live API compatibility or real-data calibration is claimed.

Self-review strengthened partial event pagination detection even when below the row cap, rejected coerced metadata flags, and distinguished historically reported events absent from currently observed settings. Malformed sampling metadata, duplicate configuration identities and invalid observation ordering are rejected.

## Next step / release boundary

Connect this separate source to owner-confirmed collection, immutable task/result persistence, shared budget recovery and a readable status/qualification projection. Recheck ownership/resource/Case version before dispatch and save; do not expose caller-supplied snapshots. Preserve original comparison history rather than changing the v1 replay rule.

This batch closes only the internal exact-GA4 collection foundation. Processing completeness policy, historical event/measurement verification, any qualified descriptive comparison, empirical metric calibration, controlled page checks, attachments and new paid Verified review remain outstanding. P5-02/P5/P6 are not complete. D1 remains: a normally completed zero-action diagnosis delivers and consumes one point without refund. No actual flags, remote migrations, deployment, commits or unrelated cleanup.

## Recovery baseline

Before this batch: `.v22-capability-baselines/baseline-IvZnNY`, manifest SHA256 `073d756fdee1c903bb48bf74216be8bd7cb49be9d09b759656abb1b7ede00f6e`; FE 435 captured / 33 excluded, BE 168 captured / 1 excluded. HEADs: FE `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`; BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Generated/private paths excluded.

After acceptance, before this audit paragraph: `.v22-capability-baselines/baseline-Gjb0ct`, manifest SHA256 `c75c18ad6085427913b72bebfc6b3056309c2ccc112b575d8455e6514800f3d9`; FE 440 captured / 33 excluded, BE 176 captured / 1 excluded. Manifest comparison found no missing captured files, unchanged HEADs and only seven FE documentation/shared-contract paths plus eight BE new implementation/test/export paths changed. All pre-existing unrelated dirty files were preserved.
