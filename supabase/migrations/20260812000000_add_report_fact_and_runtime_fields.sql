alter table public.reports
  add column if not exists analysis_started_at timestamptz null,
  add column if not exists last_progress_at timestamptz null,
  add column if not exists estimated_completion_at timestamptz null,
  add column if not exists pipeline_diagnostics jsonb null,
  add column if not exists source_facts jsonb null;

comment on column public.reports.analysis_started_at is
  'UTC timestamp when the backend analysis task was accepted.';
comment on column public.reports.last_progress_at is
  'UTC timestamp of the latest persisted task progress or terminal result.';
comment on column public.reports.estimated_completion_at is
  'Current estimated completion timestamp supplied at task creation.';
comment on column public.reports.pipeline_diagnostics is
  'Bounded versioned stage-duration diagnostics; never contains provider secrets.';
comment on column public.reports.source_facts is
  'Versioned safe Page/GBP fact snapshot with raw values, provenance and normalized schedules.';

create index if not exists idx_reports_pending_progress
  on public.reports (last_progress_at)
  where status = 'pending';
