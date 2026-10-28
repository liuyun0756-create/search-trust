# P5 explicit collection entry — local verification

## Delivered boundary

Continues the approved dedicated collection follow-up. The approved report's saved implementation record now offers a separately gated owner panel: inspect the confirmed GSC property and exact before/excluded/after dates, explicitly confirm collection, refresh status, and select a completed collection for a separate free comparison. No collection on mount, status refresh, period selection or history read. Waiting periods cannot be submitted. Selecting a result does not automatically run a comparison.

- The internal authenticated API and same-origin owner BFF accept IDs/selections only. Context/read responses project bounded metadata, not tokens, implementation record bodies or provider data. Strict schema, route/report binding, current implementation and response-size checks remain in place.
- The browser retains an uncertain request ID for same-selection recovery, including a session-scoped recovery ID; the server history remains the source of truth. A changed selection cannot overwrite a task. Failed tasks require a new explicit confirmation; no automatic provider retry.
- Gated worker reconciliation dispatches persisted requests only, with deterministic queue IDs. Existing single-claim executor, twelve-request per-job budget and five-minute lease remain. ARQ returns no private result and has one attempt; its 315-second envelope permits claim RPC, the 240-second collection limit and terminal storage. Expired uncertain work is fenced rather than refetched.
- Dedicated collected sources are resolved directly, not copied into ordinary snapshots. Both selected periods must reference the same collection, with exact owner/Case, implementation revision, action and window. Authorization, Case version and after-result expiry are rechecked at save. Existing ordinary sources and immutable historical comparisons remain readable.
- New SQL identifier guards prevent a user-chosen collection ID from shadowing an ordinary snapshot/sync ID, including concurrent inserts. Bypass resolver functions are not executable by service-role callers; direct result mutation remains denied.
- No report generation, credit charge/refund, ordinary sync status or binding-health mutation. A successful collection still does not establish complete coverage, comparability or effectiveness. D1 remains: a completed zero-action diagnosis delivers, consumes one point and is not refunded.

## Implementation

FE: `ComparisonCollections.tsx`, comparison/implementation/report-page integration, report-bound `comparison-collections` route, bounded gateway extension, generated collection contracts and tests. Existing comparison route defaults remain unchanged.

BE: `collection_entry.py`, `api/v2/collections.py`, `collection_worker.py`, worker startup/shutdown/dispatch registration, default-off `V22_COMPARISON_COLLECTIONS_ENABLED`, generated contract export and entry tests.

SQL: `20261022150000_open_v22_collection_entry.sql`, migration **64**. Applied only to owned disposable local databases. Comparison source foreign references now use the guarded alternative-source resolver; completed comparisons retain their frozen inputs/results.

Design: `../specs/2026-10-22-p5-collection-entry-design.md`. Existing React component patterns and the repository's real-component Playwright harness were reused; no new Python browser server or design-system replacement.

## Verification

- Backend fast full suite: **2,438 passed**, 58 deselected; external sockets disabled. New entry suite: **35** cases covering malformed/foreign context, retry recovery, flag/auth/body gates, safe errors and bounded dispatch.
- Native PostgreSQL 17.10 / Redis / ARQ full suite: **58 passed**, 2,438 deselected, all **64 migrations**, 50.13 seconds. Three new end-to-end native cases cover actual internal API → durable SQL request → Redis worker → controlled GSC collection → immutable comparison; wrong action/window/mixed source, expired/revoked permissions, historical recovery and ordinary-store isolation. Twelve controlled provider requests, no real OAuth/provider account. ARQ's existing Redis `close` deprecation warning is non-blocking.
- Frontend full suite: **1,952 passed / 180 files**. New collection gateway tests cover owner injection, no-store, disabled/signed-out/cross-origin rejection, malformed replies and contract integrity.
- Browser integration: **13 passed**, using actual components and the actual BFF with intercepted backend collection metadata. New scenario covers explicit confirmation, lost acknowledgement with the same request ID, read-only refresh, use-without-auto-analysis, saved comparison, reload and waiting-window block. The other browser suites continue exercising their existing isolated SQL/backend paths. This is not a browser-to-live-Google acceptance claim.
- Typecheck and production build pass. Seven dual-end contract/example export checks pass with no drift. Both repositories pass `git diff --check`.
- Desktop 1280 and mobile 390 screenshots reviewed: no horizontal overflow; before/excluded/after dates, explicit consent, status/history and comparison limitations remain readable. Artifacts are under `output/playwright/integration-results/comparison-checks-explicit-1a9af-riods-without-auto-analysis-chromium/`.
- During acceptance, an E2E fixture reused a mutable result across tests; fixed by cloning test vectors on return, then reran both new and existing browser scenarios. Also replaced a stale “no comparison has run yet” message with a statement about selection behavior, and identified the implemented action in collection history.

## Remaining / release boundary

This completes the local collection-entry and source-integration slice, not P5/P6. New UI/API/worker behavior is behind default-off flags; no actual environment setting was changed. No real provider request, remote database migration, deployment, commit/reset or unrelated cleanup.

Metric-specific low-volume qualification/calibration, GA4 completeness and event-history qualification, controlled page checks, attachments, and a newly charged Verified review remain outstanding. Current `effect_conclusion` remains null and causal attribution false; existing SQL still blocks premature review generation. Next work should address the remaining comparison qualifications before unlocking an effect/review workflow. Real account/provider/release acceptance remains a separate P6 gate.

## Recovery baseline

Before work: `.v22-capability-baselines/baseline-fMnVDA`, manifest SHA256 `3bb45e5b1de300d61034758e97e31fc38ff05f9fdbd8f9d23f1981fa8d055fab`; FE 414 captured / 33 excluded, BE 155 captured / 1 excluded. Existing HEADs: FE `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`, BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Generated/private paths are excluded from the recovery archive.

After implementation and acceptance, before this audit paragraph: `.v22-capability-baselines/baseline-5c85xn`, manifest SHA256 `49f6abfab41c5c7a9a19bcf581ed1dd7801b08b3e1c719314c375f63b20f5217`; FE 425 captured / 33 excluded, BE 162 captured / 1 excluded. Comparison with the before baseline found no missing captured files; only the entry/source/worker integration, its tests/contracts and this batch's design/progress documents changed. Existing unrelated dirty files and both HEADs remained unchanged.
