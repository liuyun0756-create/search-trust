# P5-03 review evidence freeze — local verification

Date: 2026-10-26. Approved design: `../specs/2026-10-26-p5-review-evidence-freeze-design.md`.

## Delivered locally

- Backend strict reference-only selection, resolved input and saved evidence contracts in `app/report_v22/review_freeze_models.py`.
- Internal `ReviewFreezeRepository` in `app/report_v22/review_freeze_storage.py`: bounded transport, owner-bound reads, source resolution, replay validation, same-ID recovery and conflict handling. It is not registered in a public or internal HTTP route.
- Migration `20261026110000_freeze_v22_review_evidence.sql`: private source resolver, transaction revalidation and immutable evidence storage. This is migration 71 in the disposable test cluster, not evidence of production migration.
- Stored page/GSC/GA4 sources are tied to the precise approved delivery, implementation revision, action and business website. Optional absent evidence remains absent; explicitly selected unavailable evidence rejects the operation.
- Historical versions are deliberate, not silently replaced by latest. Case ownership/active state is checked on resolution, commit, reading and replay. Case → report lock order does not acquire Google connection locks.
- One request ID returns its original saved result for the same selection; different selections conflict. An acknowledgement lost after commit is recoverable without another source collection or duplicate save.
- Decisions are empty and next work remains needs_review. No new report, job, charge or public deliverable is produced.

## Integrity details

Source transport uses legacy-preserving JSON rather than the Verified checksum encoding. JSONB semantic equality alone treats 3.0 and 3 as equal, so commit also checks the resolved source representation; it rejects numeric rewrites that would invalidate an old source checksum. Readback retains the original transport text and revalidates the complete bundle.

Verified canonicalization is checked separately in SQL, including object-key UTF-16 ordering, escaping, binary64 numeric cutovers and canonical hash text. Duplicate JSON object keys, nonempty decisions, unexpected fields and mismatched sources are rejected. RLS and function privileges prevent browser roles from reading/writing the table or invoking private helpers. Service role cannot directly mutate the table.

The first-save evaluation clock tolerance is +1/-5 minutes. The saved model permits the same positive clock skew relative to database save time; otherwise a legitimate save could succeed but fail to read back. Replay returns original times and does not reapply the first-save window.

## Actual tests

| Check | Result |
| --- | --- |
| Backend fast regression, final run | 3,087 passed, 183 integration tests deselected; 78.91 s |
| New unit coverage included above | 31 tests |
| Full native integration suite | 160 passed, 3,109 deselected; 269.76 s |
| New native evidence-freeze tests, final rerun after adapter hardening | 14 passed; 27.68 s |
| Frontend review contract / saved GA4 reading / capability database compatibility | 213 passed across 3 files; 4.64 s |
| Existing review, saved GA4 session, comparison, implementation and capability contract exports | All five checks passed for both repositories |
| Both repositories `git diff --check` | Passed |

The final adapter hardening rejected an unexpected second bundle field and classified all HTTP transport failures safely; the final backend regression and 14 native targeted tests were rerun afterward. The full native suite preceded that bounded adapter change. Frontend source, rendering and public routes are unchanged, so no new UI/build/browser flow is claimed as tested in this batch. Redis-only tests were not separately rerun; the native suite uses disposable Redis/ARQ where required by existing fixtures.

Native tests used PostgreSQL 17.10 with all 71 repository migrations and a newly created loopback Redis instance. The runner owns and removes its disposable databases/processes. Provider data and page responses are synthetic controlled transports; no real Google account, website or production database was contacted.

Covered native boundaries: same-ID concurrent submissions, acknowledgement loss, exact old implementation beyond the recent-20 history limit, later implementation edits, revoked Google scopes with authorized historical reading, absent/queued sources, successful and unable page observations, available/thresholded GA4 counts, GSC saved comparisons, signed source tampering, numeric representation tampering, duplicate keys, oversized inputs, changed Case marker, archive lock race, cross-Case collision privacy, canonical parity, time windows and immutability/role privileges. Old report/charge state is compared before and after normal freeze flows.

Zero-action diagnostics and multi-action ordering remain covered by the pre-existing pure projection/bundle tests in the full backend regression; the new native fixtures exercise the generated report's existing actions. This is not a claim that every source combination or live account has been accepted.

## Commands

```sh
# Backend, from SearchTrust-RD
.venv/bin/python -m pytest -q -m 'not native_integration and not redis_integration' --tb=short
PYTHONPATH=/tmp/searchtrust-native-q8vE6T/python .venv/bin/python scripts/run_v22_native_integration.py --postgres-bin /tmp/searchtrust-native-q8vE6T/package/native/bin --redis-server /tmp/searchtrust-native-q8vE6T/redis-7.4.2/src/redis-server -- -m native_integration --tb=short
PYTHONPATH=/tmp/searchtrust-native-q8vE6T/python .venv/bin/python scripts/run_v22_native_integration.py --postgres-bin /tmp/searchtrust-native-q8vE6T/package/native/bin --redis-server /tmp/searchtrust-native-q8vE6T/redis-7.4.2/src/redis-server -- tests/integration/test_native_review_freeze.py --tb=short
.venv/bin/python scripts/export_v22_review_projection.py --check --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_ga4_session_reading.py --check --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_comparison_contracts.py --check --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_implementation_contracts.py --check --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_capability_contracts.py --check --frontend-dir ../search-trust
# Frontend, from search-trust
npm test -- src/lib/review-projection/contracts.test.ts src/lib/ga4-session-readings/reading.test.ts src/lib/database/v22Capability.test.ts
```

## Corrections during verification

The first native run exposed a readback assembly error: a nested validated model was passed directly to the JSON encoder. It now serializes the detached model before revalidation. Tests also clarified clock-skew handling and the need to compare source numeric representation, not only JSONB value equality. Test-only mistakes (a closed transport, fixture aliasing and unsupported pytest marker) were corrected; the final reported runs are green.

Existing ARQ tests emitted three dependency deprecation warnings; frontend tooling emitted its existing module registration deprecation warning. No test failed in the reported final runs.

## Preservation and release boundaries

Before-work recovery capture: `../.v22-capability-baselines/baseline-7k4dit`, manifest SHA256 `fcd969cef8fa490b0de85672750c21e3646cdcc478093df1911821c494fe243d`.

FE starting HEAD: `5d75ed0af176a7751ecdf2590f435b40da3cdfc4`. BE starting HEAD: `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Existing dirty work remains in place; no implementation commit or broad staging/reset was performed.

Post-code capture: `../.v22-capability-baselines/baseline-uZT4BQ`, manifest SHA256 `307e51325d21908b9670c57ee16fb938060c601887f76ab0cdb0865722976253`. Comparison found two pre-existing FE progress documents changed, one pre-existing BE native-test RPC allowlist changed, four newly captured FE paths (including the already-committed specification now marked approved) and four new BE files. No captured files were missing; both HEADs were unchanged. Only the implementation checklist and this verification note received completion metadata after the capture.

Current paid review rejection remains in the backend input resolver, backend result persistence and dispatch SQL. No flags, environment settings, production migrations, deployment, ordinary synchronization or credit policy were changed. Normally delivered diagnoses without enough action evidence still consume 1 credit without refund; this internal evidence operation consumes none.

Still pending: authenticated user-facing selection/confirmation, explicit SEO decisions, new Verified generation consuming the stored input, single-charge settlement, versioned approval/PDF/share delivery, live calibration and production acceptance. P5-03 end-to-end and P5/P6 remain open.
