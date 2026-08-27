begin;

alter table public.analysis_jobs
  add column state_revision bigint not null default 0
    check (state_revision >= 0),
  add column terminal_effects_revision bigint not null default 0
    check (terminal_effects_revision >= 0),
  add constraint analysis_jobs_terminal_revision_check
    check (terminal_effects_revision <= state_revision);

create or replace function public.apply_analysis_job_event(
  p_job_id uuid,
  p_case_id uuid,
  p_revision bigint,
  p_status text,
  p_current_stage text,
  p_progress smallint,
  p_attempt_count integer,
  p_error_code text,
  p_user_message text,
  p_cost_counters jsonb,
  p_heartbeat_at timestamptz,
  p_completed_at timestamptz
)
returns table (
  found boolean,
  applied boolean,
  terminal_effects_applied boolean,
  state_revision bigint
)
language plpgsql
set search_path = public
as $$
declare
  changed_rows integer := 0;
  current_revision bigint := 0;
  is_terminal boolean := p_status in ('succeeded', 'failed');
begin
  if p_revision < 1 or p_status not in ('queued', 'running', 'succeeded', 'failed') then
    raise exception 'invalid analysis job event';
  end if;
  if btrim(coalesce(p_current_stage, '')) = '' or p_progress not between 0 and 100 or p_attempt_count < 0 then
    raise exception 'invalid analysis job event fields';
  end if;
  if jsonb_typeof(coalesce(p_cost_counters, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid analysis job cost counters';
  end if;
  if p_status = 'succeeded' and (
    p_progress <> 100 or p_current_stage <> 'completed' or p_completed_at is null or p_error_code is not null
  ) then
    raise exception 'invalid succeeded analysis job event';
  end if;
  if p_status = 'failed' and (
    p_current_stage <> 'failed' or p_completed_at is null or btrim(coalesce(p_error_code, '')) = ''
  ) then
    raise exception 'invalid failed analysis job event';
  end if;
  if p_status in ('queued', 'running') and (p_completed_at is not null or p_error_code is not null) then
    raise exception 'invalid non-terminal analysis job event';
  end if;

  if not exists (
    select 1 from public.analysis_jobs j where j.id = p_job_id and j.case_id = p_case_id
  ) then
    return query select false, false, false, 0::bigint;
    return;
  end if;

  update public.analysis_jobs as j
  set status = p_status,
      current_stage = p_current_stage,
      progress = p_progress,
      attempt_count = p_attempt_count,
      error_code = p_error_code,
      user_message = p_user_message,
      cost_counters = coalesce(p_cost_counters, '{}'::jsonb),
      started_at = case
        when p_status = 'running' then coalesce(j.started_at, p_heartbeat_at, now())
        else j.started_at
      end,
      heartbeat_at = p_heartbeat_at,
      completed_at = p_completed_at,
      state_revision = p_revision,
      terminal_effects_revision = case when is_terminal then p_revision else j.terminal_effects_revision end
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.state_revision < p_revision
    and j.status not in ('succeeded', 'failed');

  get diagnostics changed_rows = row_count;
  select j.state_revision into current_revision
  from public.analysis_jobs j
  where j.id = p_job_id and j.case_id = p_case_id;

  return query select
    true,
    changed_rows = 1,
    changed_rows = 1 and is_terminal,
    current_revision;
end;
$$;

revoke all on function public.apply_analysis_job_event(
  uuid, uuid, bigint, text, text, smallint, integer, text, text, jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_analysis_job_event(
  uuid, uuid, bigint, text, text, smallint, integer, text, text, jsonb, timestamptz, timestamptz
) to service_role;

comment on function public.apply_analysis_job_event is
  'Atomically applies monotonic, terminal-safe Redis job snapshots to analysis_jobs.';

commit;

