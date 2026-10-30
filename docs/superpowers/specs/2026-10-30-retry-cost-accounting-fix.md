# Phase-aware retry accounting and final cost synchronization

A normal capability report has collection/preparation and formal execution. Counting both as one undifferentiated attempt stream incorrectly reports one retry. The SQL report commit also precedes the final worker cost snapshot, so the task row can retain earlier costs than its persisted summary.

New Redis ledgers keep attempt counts per job/preparation/execution phase; retries are repeated executions within each phase. Total executions, active duration, provider claims, budgets and credit rules are unchanged. Ledgers without phase metadata retain legacy semantics on resume; historical costs are not guessed or rewritten. The numeric public counter contract stays V1.

A service-only cost-summary trigger synchronizes only the cost_counters field of the corresponding terminal capability task. It validates Case, job kind, terminal status and original creation time, and accepts only a newer ledger revision. It never reapplies task completion, changes a report, approves a revision or settles credits. Other cost-summary kinds continue through their existing path. The migration installs a trigger without backfill.

Validation covers normal stage handoff, repeated stages, concurrent writes, legacy resume, phase validation, actual preparer/worker wiring, real Redis client recovery, monotonic final-cost persistence, identity mismatches, failed tasks without duplicate refunds and source-report/approval/ledger preservation. Production checks must distinguish deployment/catalog verification from a newly generated paid report; no new analysis is authorized in this batch.
