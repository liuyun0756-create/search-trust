# P5 GA4 durable collection — continuation of approved work

Authority: continuation requested by the user after the exact-window foundation. This records the persistence portion of the previously described next step. No live provider calls, remote migration, deployment, flag changes, commits or charges. Brainstorming scope check follows the accepted plan; writing-plans is unavailable, so execution steps are recorded here.

## Boundary and design

Use separate GA4 jobs and immutable collections, following the existing GSC single-attempt lifecycle. Extending the old GSC envelope would invalidate replay and allow source confusion; using ordinary synchronization would overwrite the latest source and lose exact-window intent. Therefore neither is changed. First finish persistence and recovery with native acceptance; the owner-facing confirmation/status and dispatch registration remain a subsequent integration slice, not a claim made by this batch.

An internal explicit selection names the saved implementation revision/checksum, action, window length, confirmed GA4 binding, an existing current GA4 scope snapshot, and optional exact landing path. Property, website hosts and timezone are resolved from the authorized current snapshot, never supplied as free-form provider scope. Require a fresh, latest, same-Case/same-binding ordinary snapshot whose property and web host filter match the confirmed business. Its traffic is not used for the comparison: it supplies scope provenance only. Validate its checksum and full GA4 contract in the backend. If no usable scope observation exists, request a normal sync first; do not invent a timezone or widen the hosts. Calendar completion still does not attest processing completeness.

SQL independently derives scope and recomputes windows, validates the saved implementation source and rejects stale record revisions. Connection → Case → binding → job locking is shared with ordinary sync/revocation. Selection ID reuse returns the original request; different selections conflict. One active job per GA4 binding. Claim and finish recheck Case version, current implementation revision, permissions, resource, and scope snapshot currency. A replacement snapshot invalidates pending work conservatively, even if apparently equivalent. Existing terminal results remain readable under the original owner/report permissions after source revocation or record changes.

Single-use five-minute lease, bounded 240-second provider attempt, same logical-job Redis budget. Cancellation or acknowledgement loss never causes an automatic second provider attempt. Expired running tasks become interrupted; queued tasks may be dispatched again because only the SQL claim permits I/O. Terminal payloads are immutable; duplicate save returns exactly the original result, and mismatched saves conflict. Store no token, raw error, partial success, effectiveness claim or ordinary sync mutation. Qualification is recomputed on every backend read.

## Execution and acceptance

1. Add strict GA4 selection/job contracts, resolver/repository and internal single-attempt executor.
2. Add additive service-only SQL tables/functions for resolve/request/read/claim/finish/fail/pending; no client direct table writes. Apply only to disposable local database tests.
3. Test concurrent confirmation and claim, exact scope provenance/windows, stale scope/record/Case/permission races, immutable history, cancellation/expired leases, lost request/claim/save acknowledgements, malformed/re-signed envelopes and role isolation. Assert ordinary sources, reports and credit state unchanged.
4. Run backend full fast/native suites, existing dual-end contract checks and relevant frontend regression if changed. Record tests and before/after recovery audit; keep P5/P6 open.

Self-review: scope and failure behavior are explicit; no new paid pathway or comparison qualification. The preview remains unimplemented in this slice and must not be advertised as delivered. D1 (completed diagnosis consumes one point even with zero actions) remains unchanged.
