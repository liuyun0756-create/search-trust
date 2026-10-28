# P5 GA4 saved session-count reading — local verification

Date: 2026-10-26. Written design approved in this conversation. This records local implementation and isolated tests, not a release or real-data calibration.

## Delivered

- Independent `v22_ga4_session_snapshot_reading_v1` pure projection and owner-bound read endpoint. Uses saved successful exact v2 collections; v1 is withheld for missing truncation metadata.
- Same saved scope and equal calendar windows; totals and dates restrictions checked independently from key-event-only restrictions. Missing dates are not zero-filled. Totals supply sessions; daily rows are not summed.
- Exact integer differences and two-decimal half-up percentages; zero baseline produces no percentage. Safe-integer limits and decimal-string verification are enforced on both sides.
- Fixed processing/history limitations, null effect and false causal attribution. Original qualifications, audits, observations and checksums remain unchanged.
- On-demand report-workspace disclosure with Before / After / Count difference / Relative change, dates, scope and collection time. Neutral typography, no effect badges; reading errors retry only the saved source. Changing sources unmounts and aborts the previous disclosure.
- Independent default-off `V22_GA4_SESSION_SNAPSHOT_READING_ENABLED` in both backend and frontend, subordinate to existing comparison/GA4/implementation entry gates. API is authenticated and bounded, with no-store responses and no browser-supplied owner identity.
- No new migration. Existing owner/source SQL is reused: archived Case is denied, wrong owner/Case/report/delivery/collection is denied. Revoked Google scope does not force a provider call to read an otherwise authorized historical observation. Later implementation revisions do not rewrite historical readings.

## Verification results

| Check | Result |
| --- | --- |
| Frontend full Vitest suite | **2,187 passed / 190 files** (54 new contract/API/UI tests) |
| Backend non-native/non-Redis suite | **2,987 passed**, 169 deselected (59 new tests) |
| Native PostgreSQL 17.10 + disposable Redis/ARQ | **169 passed**, 2,987 deselected; 70 existing migrations; 3 old ARQ deprecation warnings |
| Browser integration suite | **30 passed**; 4 new saved-session scenarios |
| TypeScript check and Next production build | Passed; new route present in build output |
| Contract regeneration checks | New session reading, old exact GA4, old collection entry and old evidence review all unchanged on regeneration |
| Repository diff whitespace checks | Both repositories passed |
| Existing artifact security scan | 49 files, 0 findings, 0 loaded secret values; not a production secret audit |

Commands:

```text
FE: npm run typecheck
FE: npm test -- --reporter=dot
FE: npm run build
FE: V22_PRIORITY_VISUAL_QA=true npx playwright test --config=playwright.integration.config.ts
FE: npm run security:scan
BE: .venv/bin/python -m pytest -q -m 'not native_integration and not redis_integration' --tb=short
BE: PYTHONPATH=/tmp/searchtrust-native-q8vE6T/python .venv/bin/python scripts/run_v22_native_integration.py --postgres-bin /tmp/searchtrust-native-q8vE6T/package/native/bin --redis-server /tmp/searchtrust-native-q8vE6T/redis-7.4.2/src/redis-server -- --tb=short
BE: .venv/bin/python scripts/export_v22_ga4_session_reading.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_ga4_comparison_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_ga4_collection_entry_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_ga4_evidence_review_contracts.py --frontend-dir ../search-trust --check
```

Development iterations: the initial fast-suite invocation excluded native tests but not Redis-marked tests and therefore hit the test environment guard; the corrected marker selection passed. Initial native test assertions used a nonexistent review `id` column and archived a Case without its required timestamp; both test setups were corrected and the entire native group reran successfully. Truncated totals/dates are rejected by the source schema itself; regression tests assert that hard rejection rather than treating malformed data as a valid withheld observation.

Native tests assert that session reads do not add Google requests, change ordinary snapshots or the credit/report baseline, save SEO checks, or mutate the collection. Controlled provider calls are only used to prepare test evidence, never to serve a reading. Browser tests mount real components and call the real frontend handler against controlled backend responses; they do not claim live Google/production acceptance.

## Visual and interaction check

Inspected both actual screenshots with built CSS:

- `output/playwright/integration-results/ga4-session-reading-keyboa-186db-mbers-and-responsive-layout-chromium/sessions-1280.png`
- `output/playwright/integration-results/ga4-session-reading-keyboa-186db-mbers-and-responsive-layout-chromium/sessions-390.png`

Desktop uses a compact two-column numeric grid; mobile stacks four cells without horizontal overflow. Keyboard opening, visible focus, withheld dates, zero denominator and read-only retries passed. The frontend-design skill was used to preserve workspace visual language and establish neutral numeric hierarchy, not to introduce an unrelated redesign.

## Recovery and remaining gates

Before-work baseline: `../.v22-capability-baselines/baseline-at4wbq`; manifest SHA256 `3ff1b2a01688c67eb12dba9e046e72d6539411e106c315f5c7470fadb20809e4`. FE starting HEAD `ba310068d6f987402c0ddda076fa3282b9c96e45`; BE starting HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Existing unrelated work is preserved.

No actual environment flags, credentials, Google permissions, customer data, production database or deployment were changed. Reads are free. D1 remains: a normally completed diagnosis without sufficient grounds for actions is delivered and consumes 1 point without refund; technical failures follow the existing rule.

This completes the bounded saved-session reading slice only. It does not prove GA4 processing finality, historical measurement consistency, significance or an SEO effect. Real metric calibration, broader eligibility, integration into the new paid Verified review report, and production acceptance remain separate. P5/P6 are not closed.
