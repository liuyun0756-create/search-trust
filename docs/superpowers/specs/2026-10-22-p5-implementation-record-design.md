# P5-01: pinned implementation records

Approved scope: P5 in the 2026-10-13 capability completion plan; user requested implementation. This is the first independently testable P5 slice, not completion of P5-02/03.

## Boundary and flow

Only a completed Verified capability report and a persisted approved delivery revision can receive implementation records. Prospect, unpaid/candidate reports and draft revisions are rejected. Each approved delivery revision has its own immutable record history; new report versions never inherit completion silently. Historical approved revisions remain readable after later delivery edits.

The authenticated owner selects an approved action, checks the prefilled actual scope, and supplies an implementation date and IANA timezone. Note and responsible person are optional. Saving is free and does not enqueue jobs, fetch URLs, change report contents, update shares or create credit entries. Attachments are deferred: no upload/storage permission is introduced in this slice.

The entire saved action set is revised atomically with optimistic concurrency. Removed entries are corrections, not deleted history. Each snapshot binds report checksum, delivery revision identity, root record identity, revision, server recording timestamp and canonical checksum. Date edits append a version. A lost save acknowledgement can recover only the identical immediately succeeding contents. A conflicting change retains local edits and requires explicit reload.

## Presentation

Owner-only panel below the report editor, gated by capability dispatch plus a new implementation-record flag (default off). Display pinned delivery revision, action selection, scope/date/timezone, optional fields and recent history. State explicitly: user-recorded implementation; page verification not performed; performance not assessed. The report client projection/PDF/share remain unchanged.

## Validation and future review

Closed DTOs in FE and strict Pydantic in BE. Real calendar date, valid timezone, no future local implementation date, unique approved action IDs, bounded strings and at most three actions. Scope is plain text and is never fetched. SQL independently enforces ownership, completed entitlement, approved source action membership, shape, date/timezone and CAS. Table denies direct writes and mutations. BE parser verifies canonical checksum and exact approved source binding and can later freeze the existing ImplementationReference (id/revision/checksum); review generation remains blocked until comparison qualification is implemented.

## Verification

Test create/save/reload, prefill, optional input, date correction/history, lost acknowledgement, conflicts, invalid dates/timezones/action membership, cross-owner/Case/report/revision, unapproved/unpaid sources, immutable SQL rows and unchanged credits. Existing report hashes and share/export behavior must remain unchanged. No production migration, flag enablement, provider call or deployment.
