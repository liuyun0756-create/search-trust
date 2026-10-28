# P5-03 review evidence workspace — local verification

Date: 2026-10-27. Scope: the user-confirmed third-batch design in `../specs/2026-10-27-p5-review-evidence-workspace-design.md`.

## Implemented

- Owner report entry after implementation records; independent `/cases/[caseId]/reports/[reportId]/review-evidence` page. Exact approved delivery and saved implementation version, or an explicit paginated version picker. No automatic source selection.
- Three-column workspace, per-action saved page/GSC/GA4 selection, dependent previous-page clearing, validated readings, explicit absent/limited/error states. Existing projection rules determine the readings; the browser does not infer impact or lead quality.
- Server preview, expanded all-action confirmation, checkbox guard, free immutable save, original-request recovery after lost acknowledgement, owner/Case/report/version-scoped minimal session recovery, read-only saved snapshots and paginated history.
- Safe projection excludes the full bundle, raw provider responses and private implementation notes. No report generation, collection, SEO decision mutation, PDF/share creation or credit settlement.
- New service-only directory/context migration `20261027100000_review_evidence_workspace.sql` (72 migrations in the disposable cluster). Direct ownership, active Case, report, delivery, implementation and action binding; twenty-row keyset pagination.
- Strict internal command API and bounded owner-authenticated BFF; same-origin write protection, no redirects, private/no-store responses. `V22_REVIEW_EVIDENCE_WORKSPACE_ENABLED` defaults off in both layers and retains existing prerequisite gates.
- Preview fingerprint covers the selected core, rules and Case update marker, excluding only resolution time. Save revalidates; idempotent recovery reads the original immutable record. Oversized projected views are rejected before writing, with space reserved for the receipt.

The frontend-design skill was used to retain the approved pale-green/dark-green visual language, restrained type hierarchy, sticky desktop side columns and single-column mobile reading. webapp-testing was used for the local browser acceptance flow.

## Checks actually run

| Check | Result |
| --- | --- |
| New backend service/API unit tests | 21 passed |
| Final full backend fast regression | 3,108 passed, 1 Redis integration test deselected, 79.79 s |
| New native workspace tests, final run including >20 source records | 11 passed, 24.76 s |
| Workspace + pre-existing freeze native regression before final pagination addition | 24 passed, 50.98 s (10 workspace + 14 freeze) |
| Isolated Redis protocol smoke | 1 passed, 0.11 s |
| Full frontend suite | 2,226 passed across 193 files, 9.34 s |
| Final workspace/response-policy rerun after focus and limited-reading cues | 19 passed |
| Related frontend implementation/page/GSC/GA4/workspace regression | 233 passed across 12 files |
| TypeScript check | Passed |
| Production build | Passed again after final focus/limited-reading changes; workspace page/API included as dynamic routes |
| Browser desktop/mobile acceptance | Passed using synthetic intercepted API responses and local test identity |
| Workspace, review projection, GA4 reading, comparisons, implementation and capability contract exports | All six dual-repository checks passed |
| Both repositories diff whitespace checks | Passed |

All checks above completed locally. The separately run Redis test passed using the disposable service. No live account or production end-to-end result is claimed. The full native integration suite outside the review/freeze scope was not rerun in this batch.

Browser coverage: native select keyboard focus, no default selection, all three validated source readings, 1440 px and 390 px layouts without document overflow, confirmation guard, save receipt, exact snapshot after reload, explicit new version selection, empty new draft, distinct second snapshot and history. Component tests additionally cover multi-action selection retention, source-loading failure, withheld GA4, stale confirmation, authorization loss, inaccessible session storage, unknown save recovery after remount with the same ID, and read-only history mode.

Browser script: `e2e/review_workspace_browser.py`. Screenshots from this run: `/tmp/searchtrust-review-workspace-4NHG19/screenshots/{workspace-desktop,workspace-selected,workspace-saved,workspace-mobile}.png`. These contain synthetic contract evidence. The local test server was stopped after testing; no production flags or environment files were edited.

Native tests use PostgreSQL 17.10 and disposable loopback Redis. Sources are synthetic transports; tests never call Google or real client websites. The native runner owns and removes its database/processes. Its previous temporary runtime lacked PostgreSQL support files, so a separate temporary runtime was installed; this did not change application dependencies.

## Reproduction and verification corrections

```sh
# Backend
.venv/bin/python -m pytest tests --ignore=tests/integration -m 'not redis_integration' -q --tb=short
.venv/bin/python scripts/export_v22_review_workspace.py --check --frontend-dir ../search-trust
PYTHONPATH=/tmp/searchtrust-review-workspace-4NHG19/python .venv/bin/python scripts/run_v22_native_integration.py --postgres-bin /tmp/searchtrust-review-workspace-4NHG19/node_modules/@embedded-postgres/darwin-arm64/native/bin --redis-server /tmp/searchtrust-native-q8vE6T/redis-7.4.2/src/redis-server -- tests/integration/test_native_review_workspace.py --tb=short
# Frontend
npm test -- --reporter=default --silent
npm run typecheck
npm run build
```

Initial full frontend regression caught the exact expected security-header list needing the new private workspace route; that expectation was updated without removing the previous three routes or weakening their policies. Full frontend regression then passed. A type-check run overlapped Next's regeneration of development types; rerunning after generation and the production build passed. The initial backend broad invocation included the Redis smoke without its required isolated service URL (3,108 passed, one environment failure); that test subsequently passed with the disposable runner. The final fast command excludes that separately tested integration marker.

## Preservation and remaining scope

Before-work capture: `../.v22-capability-baselines/baseline-hYwhYM`; manifest SHA256 `3629f7e4561c3cdba74c680bad2f8cf35a0e1fff1c2a04706546aadf6d8f6a8f`.
Starting FE HEAD: `568784bfdfe7762675093469e83f90441dfb8095`; BE HEAD: `9bf2090b91d5ee036f8ea7e470797761b8cf838c`.

Existing dirty work is preserved. No implementation commit, staging, reset or deployment was performed. Production migration and feature enablement remain unperformed. The temporary browser test process alone enabled the existing local E2E identity and workspace prerequisite gates.

Post-code capture: `../.v22-capability-baselines/baseline-5GEr5k`; manifest SHA256 `cf57a0cd5c5a6ecb2b3f40cbbe4300c3e3dbd7f667d522906e5816cc376e228e`. No previously captured source files are missing and both HEADs are unchanged. The only previously dirty files changed are the FE master progress plan, Next header policy, report page and implementation panel, and the BE settings, router registration and native-test RPC allowlist. Newly captured paths include new implementation/tests/contracts plus the previously clean approved specification and response-header expectation. Only this verification note and checklist receive completion metadata after that capture.

P5-03 is NOT complete end to end. Explicit SEO next-action decisions, generation consuming immutable evidence, paid settlement/versioned delivery, real-account calibration and production acceptance remain separate follow-up work. Normally delivered diagnoses without adequate action evidence still cost one credit without refund; preparing/saving this evidence snapshot is free.
