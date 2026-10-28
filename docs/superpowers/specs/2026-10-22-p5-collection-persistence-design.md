# P5 dedicated comparison collection persistence

Execution slice of the approved P5 plan: make exact-window collection durable before wiring a public collection button. No real flags, provider calls, deployment, remote migrations, credit changes or automatic new analysis.

## Storage boundary

Use dedicated collection jobs and immutable collection results, not `google_sync_jobs` or `data_snapshots`. A selection pins the owner-authorized approved report's latest saved implementation revision, action, 7/14/28/90-day window and confirmed GSC binding. The backend resolves the saved record/resource; the browser cannot provide dates, source bodies or tokens. SQL independently checks the plan against saved implementation dates/timezone and the current source binding. Waiting windows create no task.

Explicit confirmation supplies a durable request UUID. Same UUID/selection recovers its existing task and result; a changed selection conflicts. At most one active comparison collection per binding. New task confirmation checks current permissions and latest implementation; historical task reads retain the original revision. Connection → Case → binding → job lock ordering matches existing source workflows. Claim and completion recheck Case version and permission. Results are immutable and never update ordinary source health/latest snapshots.

## Execution and recovery

This slice provides an internal callable executor, not a scheduled reconciler or public route. One claim grants a five-minute lease, with a 240-second operation deadline. The existing provider and logical-job cost ledger still cap requests at twelve. A task is never automatically reclaimed for external I/O: an expired running lease becomes a terminal interrupted failure. This deliberately prevents an expired/lost Redis budget or uncertain process outcome from granting another twelve calls. A later user-authorized retry must create a new explicit request; this batch does not expose that control.

Successful database completion is atomic with immutable result insertion. An uncertain acknowledgement can recover the saved result without fetching again. A repeat finish requires the original lease and identical result; a stale worker cannot overwrite or complete a failed task. Provider errors are stored as allowlisted safe codes, with no raw exception/body/token. Cancellation leaves a lease for explicit recovery. No partial result is published, and successful collection does not mean comparable or effective.

## Verification and next integration

Native disposable PostgreSQL tests cover concurrent confirmation/claim, owner/source boundaries, waiting and timezone windows, request conflicts, malformed results, permission changes, lost acknowledgements, interruption, role privileges and ordinary-sync/report/credit isolation. Exercise the real executor with controlled provider/broker and Redis. Unit tests cover response binding and tamper rejection.

After this slice: gated owner UI/API, worker dispatch/reconciliation, dedicated collected-source resolver and immutable comparison selection. Do not mark P5 complete or claim the browser path works yet. Metric-specific calibration, GA4 qualifications and paid review generation remain closed.

Self-review: no new business decision; follows existing no-automatic-collection rule. One execution attempt is intentionally conservative, distinct from the ordinary sync retry policy. No fabricated effect thresholds or new charge semantics. No commits made because the shared checkout contains prior user work.
