# Report facts and runtime diagnostics migration

Target: the production Supabase project used by SearchTrust.

Migration file:

`supabase/migrations/20260812000000_add_report_fact_and_runtime_fields.sql`

## Fields

| Table | Field | Type | Nullable | Purpose |
| --- | --- | --- | --- | --- |
| `public.reports` | `analysis_started_at` | `timestamptz` | yes | Backend task acceptance time |
| `public.reports` | `last_progress_at` | `timestamptz` | yes | Latest persisted start/terminal progress time |
| `public.reports` | `estimated_completion_at` | `timestamptz` | yes | Task-creation ETA |
| `public.reports` | `pipeline_diagnostics` | `jsonb` | yes | Versioned bounded stage durations |
| `public.reports` | `source_facts` | `jsonb` | yes | Versioned safe Page/GBP fact snapshot |

No RLS policy changes are required. Existing reports remain valid and all new
fields are nullable. Application code retries without these fields during a
rolling deployment, but the migration is required before the release can be
considered complete.

## Verification

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reports'
  and column_name in (
    'analysis_started_at',
    'last_progress_at',
    'estimated_completion_at',
    'pipeline_diagnostics',
    'source_facts'
  )
order by column_name;
```

After one new report completes:

```sql
select
  report_id,
  analysis_started_at,
  last_progress_at,
  estimated_completion_at,
  pipeline_diagnostics ->> 'schema_version' as diagnostics_version,
  source_facts ->> 'schema_version' as source_facts_version
from public.reports
order by created_at desc
limit 5;
```

Expected for a newly completed report:

- `analysis_started_at` and `last_progress_at` are non-null.
- `estimated_completion_at` is cleared to null after completion.
- both JSON version columns return `1`.

## Rollback

Rollback removes diagnostic data. Export it first if it is needed for incident
analysis.

```sql
drop index if exists public.idx_reports_pending_progress;

alter table public.reports
  drop column if exists source_facts,
  drop column if exists pipeline_diagnostics,
  drop column if exists estimated_completion_at,
  drop column if exists last_progress_at,
  drop column if exists analysis_started_at;
```
