# P5 GA4 evidence audit and independent SEO review

Status: implementing the no-permission-expansion approach approved in the conversation on 2026-10-23. This is a bounded continuation, not approval to enable or deploy P5.

## Accepted scope

Keep analytics.readonly. Do not request change-history/edit access. Show three distinct classes: system-observed evidence, SEO-recorded checks, and remaining unknowns. No manual entry can attest GA4 processing finality, prove complete historical settings, unlock comparisons, or establish an effect. No provider calls on reading or saving a review; no credits, report revisions, or implementation records change.

## Compatibility and evidence

Do not change ordinary ga4_sync_v1 metadata or reserialize old exact observations with new defaults. Add ga4_comparison_observation_v2 with six bounded truncation checks (before/after × totals/dates/key_events). Preserve safe provider reason types and date boundaries, not raw provider messages. Missing/invalid metadata fails closed. Version qualification for new observations; reproduce v1 qualifications unchanged. Old observations explicitly say truncation metadata was not captured, not “no truncation.”

Derive a versioned audit from the immutable observation: missing dates per period (never zero-fill), per-view restrictions and truncation, and added/removed/changed current key-event settings across the collection. Bind the audit to collection ID, original observation checksum, scope and windows. Equality across two settings observations proves only equality at those instants. A missing date is an absent row, not proof of missing activity or zero activity.

## SEO review

Three independent checks: date-coverage investigation, historical event settings, and measurement setup. Each is not_checked, no_issue_found, issue_found or uncertain. Any checked state requires a bounded note describing what was checked and its basis. “No issue found” describes the SEO's investigation only. Plain text only; no attachment upload, remote URL fetching, or HTML.

Append-only owner-bound records include collection ID, observation checksum, report and delivery IDs, actor, server timestamp, revision, request ID and checksum. Compare-and-swap prevents overwriting another edit. Replaying the same request returns its original receipt even after later revisions; a changed body with that ID conflicts. Original evidence and earlier reviews remain immutable. Return the latest 20 reviews, with revision numbers. Reviews are permitted on an existing successful collection, without reinterpreting it against today's implementation record. Current case/report ownership is rechecked by SQL.

## UI and errors

Retain the existing GA4 collection panel. Successful collections offer an explicit evidence/review disclosure; load on demand, not once for every history row. Show observed missing dates, restricted views, current-setting differences, and old-metadata gaps. Then show editable SEO checks and saved revisions. Finish with the unchanged limitations. Uncertain save retains the exact request for retry; conflicts retain the draft while the user reloads the latest record. Never auto-retry collection or overwrite a newer review.

## Execution and acceptance

The writing-plans skill is unavailable; the execution checklist is recorded here instead.

1. Capture recovery baseline; inspect immutable storage and existing owner/UI patterns.
2. Add v2 exact-observation truncation capture, compatible qualification replay, and derived evidence audit; test malformed input and old checksums.
3. Add append-only review SQL migration, bounded owner API, contracts and BFF; test wrong owner/report/checksum, concurrency, duplicate receipt recovery and mutation denial.
4. Add accessible UI with system/manual/unknown separation and draft-preserving recovery; test actual component/BFF paths.
5. Run affected tests, full backend/frontend checks, disposable native database integration, contract exports and visual inspection. Document actual results and remaining gates.

## Self-review

No timing heuristic (48 hours, stable reread, or elapsed window) is promoted to finality. No invented historical audit trail. No Google permission change. No automatic reassessment of a report. No migration against a remote database. No flag activation. D1 remains: a normally completed diagnosis without sufficient evidence for actions is delivered, costs one point, and is not refunded.
