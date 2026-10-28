# P5 review evidence freeze — implementation checklist

Written specification approved 2026-10-26. writing-plans is unavailable; use the existing repository checklist convention. Internal storage only; no public entry, delegation, provider calls, paid generation, production migrations or deployment.

- [x] Capture both dirty repositories: `../.v22-capability-baselines/baseline-7k4dit`, manifest SHA256 `fcd969cef8fa490b0de85672750c21e3646cdcc478093df1911821c494fe243d`.
- [x] Confirm exact historical version semantics, decisions=[], current ownership and replay boundaries.
- [x] Add strict selections, resolved input and saved bundle models; reuse pure validation and projection.
- [x] Add private source resolution, transaction revalidation, immutable storage and owner-scoped retrieval migration.
- [x] Add bounded repository adapter and freeze service; preserve original snapshot serialization.
- [x] Add deterministic unit tests for selection, parsing, binding, replay, errors and no side effects.
- [x] Exercise disposable native database tests: source provenance, historical versions, tamper resistance, RLS, immutable data, retries, races and rollback.
- [x] Run relevant full regression and existing contract exports; document actual test results and limitations in [local verification](./2026-10-26-v22-capability-p5-review-freeze-verification.md).
- [x] Compare final work against recovery baseline and update progress without closing end-to-end P5/P6 gates. Post-code capture: `../.v22-capability-baselines/baseline-uZT4BQ`; only intended files changed, no captured files missing and both HEADs unchanged.

Every failure must leave old reports, credit ledgers and provider data untouched. Saved evidence is not a new report or authorization to bill.
