# P5 free owner comparison entry

Continues the accepted P5 plan and the user's authorization to connect the comparison workflow to an owner UI. No deployment, live provider calls or actual flag changes.

## Flow

Under a saved implementation record, an explicitly opened panel loads a bounded catalogue of this Case's authorized GSC/GA4 observations and the latest 20 checks for this approved delivery. Source labels show resource, coverage and collection time. Expired baseline observations are allowed; only a fresh latest observation may be selected as current. Missing selections remain explicitly missing. Default 28 days; one action and one observed dimension, no fabricated intersections. GA4 limitations remain visible and no effect conclusion is enabled.

The UI sends only a comparison UUID and a closed selection. The Next gateway derives the authenticated user and route Case/report/approved-delivery IDs, checks same-origin on POST, bounds bodies and replies, and forwards to an internally authenticated backend endpoint. Both frontend and backend comparison flags default off. No queue/credit/provider endpoint is involved.

The backend reads an owner-authorized context from SQL. A new check must use the latest implementation revision visible at that context check. A later correction cannot rewrite the exact immutable revision already selected; this is not an atomic promise to always compare the newest revision at save time. A retry first recovers its existing frozen check, even after the implementation date or connection changes. Existing checks are bound to the route's report/delivery and owner. Before publishing a response the backend replays the stored calculation. Only the result, exact implementation reference and comparison ID leave the backend; normalized source bodies and user notes do not.

The result area shows status, fixed source-timezone windows, observed clicks/impressions/CTR when available, plain-language reasons and limitations, collection/cutoff details and saved record revision. “Comparable” means descriptive values can align, not proof of an action's effect. History is listed by saved check time and supports reopening old revisions after refresh. During an uncertain save the same UUID and selection remain available for retry; changing the selection starts a new check. No automatic retry, collection or background polling.

## Structure and verification

Add a read-only SQL catalogue RPC, backend context/view contracts and internal endpoint, a bounded authenticated FE gateway, and a focused client comparison component. Reuse the existing pure comparator and immutable repository. Additive exported entry schema provides FE boundary validation without changing earlier contracts.

Test disabled/auth/origin/size/identity gates, stale records, owner/report isolation, response sanitization, idempotent retry, no source-body disclosure, source freshness and unavailable reasons. Exercise actual SQL/backend entry in native integration; test client selection/result/history and browser mobile overflow. Run appropriate regressions, contract drift, type check and production build. Paid review, collection, metric-specific calibration, GA4 qualification and P6 remain pending.
