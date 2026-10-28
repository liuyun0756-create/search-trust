# P5 dedicated collection persistence — local verification

## Delivered boundary

Continues the approved exact-window collection plan. Added a purpose-specific durable request/result store and internal executor. New requests resolve owner, active Case, approved report, latest implementation reference, action and confirmed readonly GSC binding. SQL independently reconstructs the window from the saved implementation date/timezone, checks the plan digest and rejects waiting windows. No browser-supplied dates or source bodies.

- Same request ID/selection recovers one task. A changed selection conflicts; only one active comparison collection per binding.
- Claim and completion recheck source authorization and Case version. Results retain the original implementation revision; correction/revocation does not rewrite saved history.
- One fenced execution attempt, five-minute lease, 240-second operation deadline and the existing logical-job twelve-request budget. Interrupted/uncertain claims are not automatically reissued. Expired running leases become terminal `SYNC_INTERRUPTED` on recovery.
- Atomic successful result insertion; lost request/finish acknowledgement recovers the same saved task/result without additional provider calls. No partial result on error; failure codes are allowlisted.
- Dedicated immutable `capability_collections`, separate from ordinary `data_snapshots`, `google_sync_jobs` and binding health. Canonical envelope and snapshot digests checked at storage; strict backend read reconstructs the plan and validates the collection.
- No analysis job, report, charge/refund or credit ledger mutation. D1 remains unchanged: completed zero-action diagnoses consume one point without refund; this free collection layer does not alter that policy.

## Files

FE SQL: `supabase/migrations/20261022140000_persist_v22_comparison_collections.sql` (migration 63).

BE: `app/report_v22/collection_storage.py`, `collection_executor.py`, `tests/test_v22_collection_storage.py`, `tests/integration/test_native_collection_storage.py`; native test RPC allowlist extended in `tests/integration/support/native_capability.py`.

Design: `../specs/2026-10-22-p5-collection-persistence-design.md`.

## Verification

- New unit tests: 23; plus existing exact-window collection tests: 63 passed together, external sockets disabled.
- Backend fast full suite: **2,403 passed** (76.50 seconds); only new native tests were added after this run, with no subsequent application edits.
- Final native full suite: **55 passed**, 2,403 deselected (61.52 seconds). Own disposable loopback PostgreSQL 17.10, all **63 migrations**, Redis/ARQ. Fourteen new native cases. No connected production/test account database used.
- Native coverage: six concurrent confirmations, four concurrent executors, one twelve-request outcome; request conflict/active binding; waiting; wrong owner/action/binding/revision; self-signed altered plans/results; claim and finish permission changes; Case/resource/scope mutation; cancellation and stale-lease fencing; request/claim/finish response loss; safe errors; old revision recovery; three implementation timezones; SQL role restrictions and immutable results.
- Actual executor + SQL + Redis, controlled token broker and GSC responses. This is **not** a browser-to-Google end-to-end acceptance claim. Existing ordinary snapshots/binding health/sync jobs and report/job/credit state were compared for isolation.
- Six existing dual-end export checks passed: comparison, comparison entry, implementation, capability, capability runtime and generated examples. No contract drift.
- Both repositories `git diff --check` passed; new backend modules compile. No UI/runtime frontend file changed, so no fresh frontend build/browser acceptance claimed for this batch.

## Remaining work / release boundary

Not a completed P5 or released feature. Public owner collection confirmation/status UI/API, worker dispatch/reconciliation and purpose-bound collected-source comparison resolution are still not connected. Internal executor is callable but not registered in a live scheduler. After failure, another collection requires a new explicit user request; there is no automatic provider retry.

Seven-day result expiry metadata is stored for future new-comparison eligibility; historical reads preserve the original material. The next resolver must enforce freshness/permissions/scope rather than inserting collected data into ordinary latest sync. Collection success alone never establishes complete coverage, comparability or effectiveness. Metric-specific calibration, GA4 qualifications, controlled page checks, attachments and new paid Verified review remain outstanding. P6 real accounts/providers/release gates remain open.

No actual environment flags, credentials, OAuth, real provider requests, remote migration, deployment, git commit/reset or destructive cleanup performed.

## Recovery baseline

Before work: `.v22-capability-baselines/baseline-OKV6j1`, manifest SHA256 `d10fee1b0dd2d894b5411ae4c84bbce520858562ae1262af4eedeb8a1a9cdbe3`; FE 411 captured / 33 excluded, BE 151 captured / 1 excluded. Excludes credential/generated material. Existing HEADs unchanged: FE `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`, BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`.

After work, before this audit paragraph: `.v22-capability-baselines/baseline-KySdYe`, manifest SHA256 `520ecc42ec504c9597506d5219fe4c98b549744cda9f7b53293a78a294ba3a35`; FE 414 captured / 33 excluded, BE 155 captured / 1 excluded. Baseline comparison found no missing previously captured files. Only this batch's three new FE files/two progress docs, four new BE files and native RPC test allowlist changed; unrelated dirty work remained unchanged.
