# P5-03 review evidence and content — local verification

Date: 2026-10-26. Written specification approved in this conversation. This is an internal content-layer implementation, not a new customer report or release.

## Delivered

- Independent `v22_review_evidence_bundle_v1` with a 2 MB boundary, fixed evaluation time, previous Verified/approved delivery/implementation binding, explicit per-action sources and separate evidence/whole-input checksums. Duplicate JSON keys, future evidence, identity collisions, altered sources and excessive input are rejected.
- Existing page checker, frozen GSC replay/metric reading and GA4 saved-session reading are reused. An equal Case ID alone is insufficient: property/host scope must also match the approved business website under existing domain normalization.
- Pure four-part content: recorded work, page observations, selected-period figures, and open checks/SEO decisions. It never substitutes a fresh timestamp for the original comparison evaluation time.
- Approved edited actions are the work baseline. Private implementation notes and decision reasons stay in SEO detail; customer summaries use controlled fields/templates. The previous diagnosis and limitations remain available with `prior_report_not_rechecked`, including zero-action reports.
- Continue/adjust/observe/defer/new decisions are explicit bounded SEO statements, not predictions from metric direction. Observe requires an implementation entry and explicit completion statement, but system completion remains unverified. Missing decisions stay `needs_review`; no filler actions are generated.
- Independent semantic differences distinguish changed evidence from changed decisions. Repeated source IDs/timestamps do not create decision badges; first inputs are baselines and different approved report bases are not comparable.
- Backend export script, synthetic examples, mirrored frontend schemas, generated output types, and schema/hash parity tests. No frontend route or UI imports the new content module.

## Test results

| Check | Result |
| --- | --- |
| New backend tests | 69 passed, included in the full run |
| Backend non-native/non-Redis full regression | 3,056 passed; 169 deselected |
| New frontend contract tests | 21 passed |
| Frontend full regression | 2,208 passed / 191 files |
| TypeScript and production build | Passed |
| New export/replay check | Passed for both repositories |
| Existing contract checks | Capability, implementation, comparison, exact GA4 and saved-session reading passed |
| Existing artifact security scan | 49 files, 0 findings, 0 loaded secret values; not a production secret audit |

Commands:

```text
BE: .venv/bin/python -m pytest -q tests/test_v22_review_projection.py tests/test_v22_review_projection_boundaries.py --tb=short
BE: .venv/bin/python -m pytest -q -m 'not native_integration and not redis_integration' --tb=short
BE: .venv/bin/python scripts/export_v22_review_projection.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_capability_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_implementation_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_comparison_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_ga4_comparison_contracts.py --frontend-dir ../search-trust --check
BE: .venv/bin/python scripts/export_v22_ga4_session_reading.py --frontend-dir ../search-trust --check
FE: npx vitest run src/lib/review-projection/contracts.test.ts
FE: npm test
FE: npm run typecheck
FE: npm run build
FE: npm run security:scan
```

The last backend run took 84.97 seconds. No native DB/Redis or browser suite was rerun for this slice: no routes, migrations, persistence, UI, worker registration or billing integration were changed. Previously passing native/browser runs are not counted as new verification here.

## Development findings and fixes

- The initial transport used Verified canonical JSON for legacy snapshot bodies, changing integral floats and breaking their existing payload checksums. Transport now preserves legacy numeric representation with the existing canonical serializer; independent Verified checksums remain unchanged. A regression verifies source bytes/values are not rewritten.
- Initial synthetic jobs contained random provenance IDs. The new fixture fixes those IDs so export checks and repeated construction are deterministic.
- A zero-impression GSC sample is withheld by the original source-health rules; the test now asserts that original restriction rather than manufacturing an eligible zero.
- Self-review added explicit website-scope tests, preserved prior diagnosis for zero-action reports, and checked that changes to a returned private tree cannot mutate its separately decoded customer tree.

## Recovery and limits

Before-work baseline: `../.v22-capability-baselines/baseline-NFjukS`; manifest SHA256 `8bcd378988b5b7548dfb2dca185d5a71ecf0ba68961c86ee5a0572a95e0bb255`. FE HEAD `543e37cde76aec79b4c0d1b361e226fbccc0902c`; BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`. Existing dirty files were preserved; only this slice's new code/contracts and progress documents were changed.

“Frozen” in this batch means detached, checksum-bound serialized inputs; it does not mean production atomic persistence is connected. Checksums are integrity checks, not ownership proofs. Source loading/authorization must remain server-owned when the next batch connects this code.

No live provider calls, model calls, real charges, flag changes, production migration or deployment. Review-mode guards remain intact. No report, PDF or share is updated. D1 remains: a normally completed diagnosis with insufficient basis for actions is delivered for 1 credit without refund; this internal projection has no billing side effects.

Still outstanding: owner-authenticated selection and atomic freezing, paid review generation/settlement, new Verified integration, version UI, delivery approval, PDF/share, real metric calibration and production acceptance. P5-03/P5/P6 are not closed.
