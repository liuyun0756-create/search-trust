# P5-02 owner-authorized comparison storage

Continues the accepted P5 plan and explicit instruction to start. The previous comparison foundation remains authoritative. No production enablement, provider call, paid job or review-mode relaxation is included.

## Decisions

Use dedicated service-role RPCs and a backend repository, rather than the old Prospect-only resolver or accepting browser-provided source bodies. A selection contains the exact implementation reference, action, supported window length, explicit scope, optional before/after snapshot IDs and concurrency declaration. The server supplies the evaluation time. The database resolves the persisted implementation and approved completed Verified source, and checks the active owner Case.

Every selected source must belong to this Case and an active, matched, owner-confirmed binding on an active owner connection with the appropriate read scope. Baseline expiry is permitted; the after observation must still be fresh and the latest snapshot on its binding. Resource/schema/coverage/health metadata must match saved source data. Missing IDs mean missing observations, never another Case's fallback. Different authorized sources may resolve, but the existing engine reports them as not comparable.

Resolve, compute with the existing pure engine, then freeze in an owner-scoped SQL transaction. The freeze re-resolves and compares all source and implementation contents, closing permission/source changes between read and save. Lock connections, Case, bindings and source rows in the existing sync order during validation. Serialize attempts using a transaction advisory lock on the comparison UUID; an owner/Case-scoped UUID identifies one selection. Identical retry returns the original stored result, including its original evaluation time. Changed selection with the same UUID conflicts. The ID must be retained by the eventual caller on uncertain outcomes.

Store the complete normalized request and descriptive result, with their canonical checksums, implementation revision and source references. Immutable table, service-role-only functions, no direct writes. SQL binds result references/windows/scope/rules/state to the request and verifies digests; Python validates and recomputes the complete result on each returned envelope. The service remains responsible for calculation, as with current report generation. Existing snapshots and approved reports are not modified. Old frozen comparison reads require owner entitlement, but do not require a still-active OAuth connection: revocation blocks a new comparison, not inspection of an existing result.

The first storage slice has no public HTTP entry or UI. This prevents an unqualified review launch while retaining a fully testable internal workflow. GA4 and effect calibration restrictions remain unchanged. Each new calendar/data observation needs a new comparison ID; implementation corrections never rewrite earlier comparisons.

## Verification

Native PostgreSQL tests exercise the actual migration and repository with synthetic sources: owner isolation, wrong record/revision/action/source, unapproved source, revoked or missing scope, stale/current versus expired baseline, read/save race, immutable replay after correction/revocation, concurrent retry and conflicting reuse, payload/result tampering and zero ledger/job changes. Transport tests cover IDs-only resolution, bounded responses, unavailable/rejected storage and verification of returned computations. Run backend regressions and additive contract drift checks. No visual changes require new browser screenshots.

## Remaining P5 work

Owner UI/HTTP comparison entry, suitable-window collection, calibrated metric eligibility, GA4 qualifications, controlled page verification and new Verified review generation/settlement remain separate subsequent work. This storage slice does not complete P5-02 or P5.
