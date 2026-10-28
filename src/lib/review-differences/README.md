# Saved generated-report differences

`v22_review_report_difference_v1` is immutable owner-review metadata, not another report product or a delivery revision. It compares the generated 2.2.3 result with the exact approved plan frozen into that analysis. It is deliberately outside the report body, content checksum, PDF and public-share projection. Delivery edits do not silently recalculate or overwrite the comparison.

Migration `20261028110000_persist_v22_report_differences.sql` (79) wraps the existing completion transaction. The database derives the comparison from completed owner-bound reports and saved input; no endpoint accepts a caller-written diff. Report success, consumption of the existing reservation and the new snapshot commit together. An insert failure rolls all three back. A replay recovers the same snapshot; terminal reports that predate the migration are not backfilled. GET is read-only and returns null only for an authorized completed report with no saved snapshot. Corruption or storage failure is an error, not “no change.”

The table denies direct ordinary-role access, and update/delete triggers protect history. The owner RPC verifies ownership, source checksums and a recomputed result before returning a snapshot. Python is the deterministic reference implementation; actual SQL/Python parity is tested against first, subsequent and zero-action native completions. Frontend parsing verifies the independent schema, hashes, report/input identity, action sequences, before/after plan bindings and flags.

Evidence comparison aligns stable action IDs, target and business scope. A first review or a new action without prior observations establishes a baseline. Different targets/scopes are not labelled comparable. Observation timestamps and material reference IDs do not make changes; selected metric/window/qualification or page result changes can. Missing source selection is explicit and does not invalidate a historical observation. Work comparison uses actual title, target, steps, completion, review and material content. Removed proposals are not marked completed. No effect or causal inference is added.

At most three evidence actions and six work entries retain bounded before/after values. The 5 MB envelope covers the bounded current report (1.3 MB), previous facts (at most 1.3 MB), and approved work within the frozen 2.3 MB input. There is no nested history. Future rules must use a new versioned builder and retain this rule implementation for historical reads; do not reinterpret saved snapshots in place.

The real owner route `/cases/[caseId]/reports/[reportId]/review` displays the comparison only when `V22_REVIEW_DIFFERENCES_ENABLED=true` and the existing capability/delivery flags are enabled. The flag defaults off. It controls presentation, not already-started task completion or stored history. No actual environment setting was changed for implementation. Shipping requires the migration and the existing account/release acceptance gates.

Regenerate/check the independent contract from the backend:

```sh
.venv/bin/python scripts/export_v22_report_differences.py --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_report_differences.py --frontend-dir ../search-trust --check
```

Generate TypeScript from `contracts/schema.json` with the project's json2ts options. Fixtures are synthetic; neither they nor local browser/native tests are evidence of real customer results.
