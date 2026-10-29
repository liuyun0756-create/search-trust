# Prospect workflow recovery repair

## Problem and agreed scope
An existing client Case can be reused while the session retains a different temporary draft UUID. Refresh previously treated that draft UUID as the Case, and a separate latest-Case-task lookup could select an unrelated earlier report. Repair restoration and incomplete identity presentation without starting another paid workflow. Investigate page-diagnosis coverage using frozen sources; do not manufacture editing recommendations.

## Design
Use an authenticated, owner-filtered, read-only workflow recovery endpoint. It returns only workflow ID, actual Case ID, discovery task ID, analysis task ID and settlement state. Missing/foreign workflows return the same 404; storage failure returns a safe no-store error. This endpoint cannot reserve, refund, dispatch or call a provider and remains readable while new public entry is paused.

On hydration, a saved paid workflow is resolved through that endpoint. A bound analysis task reconnects directly through the existing status parser/poller; it never submits analysis again or looks up the Case's unrelated latest report. An open reservation without analysis resumes the existing discovery/confirmation path. A closed or unavailable workflow does not automatically create another charge. Existing drafts need no schema migration.

An active duplicate Case returned by the authenticated create endpoint may be explicitly reused; an archived or failed save cannot unlock analysis. In public identity presentation, absent source observations are unverified, not disagreements. Observed conflicting values remain prominent even when another field is missing. Original observations and verdict payloads are retained.

## Alternatives considered
Persisting only the actual Case UUID would fix new drafts but not existing drafts and would still rely on client state for task association. Restoring the latest Case task is ambiguous when multiple paid workflows exist. Resolving the owned workflow provides the server binding for both current and legacy drafts.

## Validation
Check owner filtering, signed-out/foreign requests, malformed bindings, unavailable storage, reserved/closed workflow states, legacy draft IDs different from Case IDs, no mutation during reconnect, and preservation of explicit identity conflicts. Run the existing unit/database/build/security/browser release gates. After deployment use the already paid completed workflow for real recovery verification; no new credit or analysis is authorized in this repair.

## Report investigation boundary
Current site findings cover HTTP errors, explicit noindex and duplicate titles; competitor checks cover sampled page-type counts. Collected page fragments are not a complete service-content diagnosis. A confirmed service page with an offer and contact route does not by itself justify a new page or rewrite. A later report enhancement must separate observed page facts, supported changes and remaining professional questions, preserve historical generation versions, and be tested on frozen sources first.
