# Continuous review rounds

The approved delivery of a completed 2.2.3 report can be used as the source of another implementation/evidence/decision cycle. Frontend requires the existing generation/approval/implementation chain plus `V22_MULTI_ROUND_REVIEWS_ENABLED=true`; backend evidence and generation preparation require the same new flag. All flags remain default-off.

`v22_review_plan_basis_v1` is a bounded internal projection, not a replacement report or a manufactured 2.2.2 manifest. It carries current business/actions/version, the retained original diagnosis, the **complete source report checksum**, and a separate **basis checksum**. It excludes prior generation input and private decision records, so repeated rounds do not nest the full history. Immutable original report rows and public share projections are unchanged.

Implementation records remain pinned to a particular approved delivery revision and the complete source report checksum. The owner page exposes approved-version selection and reuses the implementation, attachments, page/data checks, evidence freeze and decision workspaces. A new delivery draft does not modify the old approved implementation source. Zero-action reports can save empty records/evidence/decisions; no work is invented.

Migration `20261028090000_continue_v22_multi_round_reviews.sql` adapts only internal plan consumers and the review completion checks. Full completed-report authorization runs before building a basis. The old report parser keeps accepting only its original version. The intake checks the latest Verified version before a new debit, and each generated report increments that base by one. Same-request recovery still reads the committed result after later rounds.

A fresh round requires its own implementation and selected observations. Sources from a different report, approved delivery or implementation revision cannot be substituted. Original findings retain their “prior report, not rechecked” status. Missing/new-only page observations remain explicit rather than copying earlier measurements or claiming effects.

Local acceptance covers four consecutive paid completions, a later round through real ARQ/Redis, 4,000-character work support, zero actions, cross-round rejection, new static page observation and immutable history. Browser verification uses synthetic authentication/storage with real owner components and BFF handlers. Real-account/provider acceptance and rollout remain separate.
