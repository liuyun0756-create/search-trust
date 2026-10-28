# Formal Verified review report contract

Schema `2.2.3` describes a persisted Verified review report with a fixed review input reference. The report is saved in the existing capability report version table and consumes the existing one-credit reservation atomically. It is still `verified_execution`, not another priced report type.

`actions` contains the next plan draft: continue/adjust/new. Observe/defer remain visible in the review content. Raw decision reasons and completion statements belong to the SEO content layer. A completed analysis remains `requires_delivery_review`; it is not a client approval or permission to publish raw SEO content.

The dedicated owner route is `/cases/[caseId]/reports/[reportId]/review`. It requires both `V22_CAPABILITY_DISPATCH_ENABLED=true` and the default-off `V22_REVIEW_DELIVERY_ENABLED=true`. Existing 2.2.2 queries remain filtered; a separate completed-review query adds supported 2.2.3 reports to the workspace list. Legacy delivery revision insertion remains blocked for this version.

Migration `20261027140000_review_report_delivery.sql` saves immutable draft/approved delivery revisions with an expected revision and idempotent request UUID. Approval requires explicit SEO confirmation. Saving or approving does not create an analysis or consume credits. Unknown results recover the same request; stale edits conflict rather than overwrite.

`projection.ts` is the allowlisted customer document shared by the screen, PDF and public link. Raw source payloads and private SEO decision reasons are excluded. New exports and links require the latest saved revision to be approved; existing links stay pinned to their original approved revision and can be revoked. Temporary logo/name/client/footer branding applies only to PDF downloads and retains SearchTrust identification. Online shares do not inherit those temporary settings.

The separate default-off review-generation workflow now creates the task/reservation/input atomically and uses SQL-leased ARQ dispatch. See `../review-intake/README.md`. Continuous rounds now use a separate bounded plan basis and an additional default-off flag; see `MULTI_ROUND.md`. Authorized real-account acceptance remains before rollout. The flags remain off; local validation does not authorize a production migration or release.

Backend deterministic validation rebuilds the report from the full saved input. JSON schema validates shape only and cannot establish ownership, settlement, data arithmetic or source provenance.

Regenerate/check from SearchTrust-RD:

```sh
.venv/bin/python scripts/export_v22_review_reports.py --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_review_reports.py --frontend-dir ../search-trust --check
```

Fixtures are synthetic and imported only by tests.
