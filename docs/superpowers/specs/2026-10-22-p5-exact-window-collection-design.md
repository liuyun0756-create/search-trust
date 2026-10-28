# P5 exact GSC window collection foundation

Continues the approved P5 equal-window/source-qualification plan and user authorization to proceed. This slice adds the internal collection primitive before exposing an explicit owner collection workflow. No actual provider requests, migrations, deployment, billing changes or flags.

## Decision

The current provider collects two adjacent 90-day periods. Daily property rows can support shorter property comparisons, but page/query/device/country summaries cannot be reconstructed for arbitrary implementation windows. Reusing existing broad totals would invent scope alignment. A second duplicated HTTP collector would drift in budgets/error handling. Instead, reuse a validated two-period collection primitive: ordinary sync keeps exactly its current periods, while a separate comparison planner derives exact 7/14/28/90-day periods from a checked saved implementation revision.

The plan binds owner, Case, report, approved delivery, exact implementation reference, action, source binding/resource, preparation time and windows. Source timezone is America/Los_Angeles. A not-yet-ended after window returns waiting and makes zero provider calls. There is no automatic later collection. The collection entry reconstructs the plan from the record; it does not accept arbitrary requested dates or a caller-supplied plan. The caller is internal and must independently authorize persisted record/source ownership before using this primitive; a checksum is not authorization.

Two periods each collect the existing six bounded views, always web/final, fixed Google endpoint, current row caps, no filters/intersections, pagination or automatic retries. A collection requires the existing cost ledger (12-request maximum across retries), with the existing request timeout plus a total 240-second deadline. Budget rejection, token/access/rate errors, invalid response and cancellation do not yield a partial successful collection. No tokens or raw errors enter the output.

The result is a purpose-tagged comparison collection envelope with its plan, normalized GSC material, health/reasons, payload checksum and outer checksum. It is not a persisted trusted source or ordinary sync output. Missing dates/target rows and truncation remain intact for later comparison qualification. Collected does not mean complete/comparable/effective. No GA4 or metric calibration relaxation.

## Verification and remaining integration

Use controlled provider responses to test exact requests for all four lengths, source-zone/DST exclusions, waiting, missing dates, truncation, aggregation, forbidden mutation, malformed periods, failures, request budget and legacy 90-day equivalence. Feed controlled collected data through the existing comparator test boundary to show exact page/query windows qualify while incomplete/mismatched material remains withheld. This does not grant production trust to those test envelopes.

The subsequent slice must add owner-authorized durable selection, explicit collection confirmation, a dedicated purpose/scope-aware persistence path, replay/recovery and UI. It must not simply insert these non-adjacent windows as an ordinary latest sync for existing Findings. Calibration still requires representative metric-specific samples; do not invent thresholds. Paid review and P6 remain closed.
