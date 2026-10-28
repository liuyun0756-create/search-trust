# P5 metric-specific reading aid — local verification

## Delivered

Implements the approved option 1 boundary recorded in [the design](../specs/2026-10-23-p5-metric-reading-design.md): metric-specific arithmetic explanations and directed validation, without an automatic SEO-effect conclusion.

- Clicks and impressions retain raw before/after counts and show the relative-change resolution of one count at the fixed baseline. Zero baseline stays undefined. A one-count difference is identified literally; unchanged totals do not prove no effect.
- CTR shows both click/impression fractions and separate one-click resolution for each denominator. Zero impressions produce no CTR interpretation. Exact ratio equality uses integer cross-products; tiny positive resolutions never display as zero.
- A neutral, responsive reading-aid section sits below existing saved values. Its rules are separately versioned, and the UI explicitly states that the saved result is unchanged. Supporting calculation detail is optional; key interpretations are visible. Blocked comparisons retain a concise next-step message without invented metric cards.
- Owner response parsing now rejects inconsistent arithmetic even when a malformed result has a recomputed checksum. Existing digest, ownership, source and request binding checks remain.
- Pure backend reference/schema and browser-safe frontend calculation share 16 generated vectors. The reference is for contract parity and tests, not a new backend API. The guide is derived on read, not written into frozen comparisons, PDF, shares or reports.

Original comparison engine/rules and generated existing contracts are unchanged. No SQL, migration, provider call, billing rule, public marketing claim or actual flag change. The guide uses the already-gated owner comparison UI; no new external access.

## Verification

- Frontend: **1,989 tests / 182 files passed**. New arithmetic and component tests add 37 cases; include 16 dual-end vectors, self-signed malformed results, count/denominator explanations, zero/blocked/unchanged states and no requests from the guide.
- Backend fast: **2,505 passed**, 58 deselected, external sockets disabled. New reference tests add **67** cases: 16 vectors, 12 baseline counts, 25 denominator pairs, scaling, 12 malformed arithmetic cases and mutated-model revalidation.
- Native PostgreSQL 17.10 / Redis / ARQ: **58 passed**, 2,505 deselected, all **64 existing migrations**, 63.70 seconds. No new migration. Existing ARQ Redis `close` deprecation warning remains non-blocking.
- Browser integration: **14 passed**. New actual-component / actual-owner-gateway scenario reads low-count, zero-denominator and blocked GA4 fixtures; calculation expansion does not start a request. Existing recovery, explicit collection and SQL-backed delivery scenarios continue passing. No live Google account/provider acceptance is claimed.
- Typecheck and production build passed. Eight dual-end contract/example export checks passed, including the new reading guide and seven unchanged existing exports. Both repositories passed `git diff --check`.
- Desktop 1280 and mobile 390 screenshots inspected: three cards on desktop, stacked on mobile, no horizontal overflow. Artifacts: `output/playwright/integration-results/comparison-checks-metric-r-4155d-s-and-blocked-data-distinct-chromium/metric-reading-{desktop,mobile}.png`.
- During acceptance, corrected the generated bounded-array TypeScript assignment and softened the one-count copy from an absolute overstatement claim to “can obscure its scale.” No product outcome was inferred from the test vectors.

## Remaining and release boundary

See [calibration status and directed matrix](./2026-10-23-p5-metric-calibration-status.md). Synthetic arithmetic verification does **not** satisfy empirical low-volume qualification. All saved effect conclusions remain null and `pending_metric_specific_calibration` remains in place. Do not mark P5-02, P5/P6 or the whole plan complete.

Real-data calibration, GA4 completeness/channel/event-history qualification, controlled page checks, attachments and newly charged Verified reviews remain outstanding. No actual configuration changes, real provider calls, deployment, remote migration, commit or cleanup. Existing dirty files are preserved. Completed zero-action diagnoses continue to consume one point without refund under D1.

## Recovery baseline

Before this batch: `.v22-capability-baselines/baseline-YxGdz1`, manifest SHA256 `9e53a8afbc55e8fb00a5b8872a8de31e2dd76b4b2972c6d68c218ca10c086c00`; FE 425 captured / 33 excluded, BE 162 captured / 1 excluded. HEADs: FE `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`; BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Generated/private paths remain excluded from recovery capture.

After acceptance, before this audit paragraph: `.v22-capability-baselines/baseline-eRZpOE`, manifest SHA256 `059d497af4fa6260e8123dcc3c8234fb5513bb80740f99ea877ad40315d59a67`; FE 435 captured / 33 excluded, BE 168 captured / 1 excluded. Manifest comparison found no missing captured files and unchanged HEADs. Only this batch's guide, strict parsing, fixtures/types/exporter, tests, design and progress/verification documents changed (15 FE paths, 6 BE paths). Existing unrelated changes remained intact.
