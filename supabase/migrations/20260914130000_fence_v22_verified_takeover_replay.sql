begin;

-- Terminal recovery is deliberately narrower than ordinary idempotency. It is
-- valid only after the immutable report, successful job and consumed credit
-- already form one complete tuple. A newer Redis owner may acknowledge that
-- tuple without mutating PostgreSQL's original successful generation.
create function public.is_v22_verified_success_replay(
  p_job_id uuid,
  p_case_id uuid,
  p_run_generation integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.analysis_jobs j
    join public.verified_analysis_inputs i
      on i.job_id = j.id and i.case_id = j.case_id
    join public.analysis_attempt_charges a
      on a.job_id = j.id and a.case_id = j.case_id
    join public.reports r
      on r.id = j.report_id and r.case_id = j.case_id
    where j.id = p_job_id
      and j.case_id = p_case_id
      and j.job_type = 'verified_report'
      and j.status = 'succeeded'
      and j.current_stage = 'completed'
      and j.progress = 100
      and j.error_code is null
      and j.completed_at is not null
      and j.report_id = j.id
      and p_run_generation >= j.run_generation
      and a.source = 'account_credit'
      and a.state = 'consumed'
      and a.settled_at is not null
      and a.user_id = r.user_id
      and r.report_type = 'verified_execution'
      and r.schema_version = '2.2.0'
      and r.parent_report_id = i.parent_report_id
      and r.version_number = (i.parent_payload #>> '{report_version,version_number}')::integer + 1
      and r.snapshot_ids = i.parent_snapshot_ids || array[i.gsc_snapshot_id, i.ga4_snapshot_id]
      and r.report_v2_2 #>> '{report_version,report_id}' = j.id::text
      and r.report_v2_2 #>> '{report_version,report_type}' = 'verified_execution'
      and r.report_v2_2 #>> '{report_version,schema_version}' = '2.2.0'
      and r.report_v2_2 #>> '{report_version,parent_report_id}' = i.parent_report_id::text
      and r.report_v2_2 #>> '{identity,case_id}' = j.case_id::text
      and r.report_v2_2 #>> '{first_party_performance,gsc,snapshot_id}' = i.gsc_snapshot_id::text
      and r.report_v2_2 #>> '{first_party_performance,ga4,snapshot_id}' = i.ga4_snapshot_id::text
  );
$$;

alter function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  rename to resolve_v22_verified_analysis_input_strict_generation_v2;

create function public.resolve_v22_verified_analysis_input(
  p_job_id uuid,
  p_case_id uuid,
  p_run_generation integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  job_status text;
  stored_generation integer;
begin
  if p_run_generation is null or p_run_generation < 1 then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;
  select j.status, j.run_generation
    into job_status, stored_generation
  from public.analysis_jobs j
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.job_type = 'verified_report';
  if not found then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;

  if job_status in ('queued', 'running') then
    if p_run_generation is distinct from stored_generation then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;
  elsif not public.is_v22_verified_success_replay(
    p_job_id, p_case_id, p_run_generation
  ) then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;

  -- The strict implementation reconstructs the exact frozen graph using the
  -- stored generation. The adapter seals that graph to the requesting owner.
  return public.resolve_v22_verified_analysis_input_strict_generation_v2(
    p_job_id, p_case_id, stored_generation
  );
end;
$$;

alter function public.persist_v22_verified_result(uuid,uuid,jsonb,integer)
  rename to persist_v22_verified_result_strict_generation_v2;

create function public.persist_v22_verified_result(
  p_job_id uuid,
  p_case_id uuid,
  p_report_payload jsonb,
  p_run_generation integer
)
returns table(report_id uuid,idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  job_status text;
  stored_generation integer;
  stored_report jsonb;
begin
  if p_run_generation is null or p_run_generation < 1 then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;
  select j.status, j.run_generation, r.report_v2_2
    into job_status, stored_generation, stored_report
  from public.analysis_jobs j
  left join public.reports r on r.id = j.report_id
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.job_type = 'verified_report';
  if not found then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;

  if job_status in ('queued', 'running') then
    if p_run_generation is distinct from stored_generation then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;
    return query
      select * from public.persist_v22_verified_result_strict_generation_v2(
        p_job_id, p_case_id, p_report_payload, stored_generation
      );
    return;
  end if;

  if not public.is_v22_verified_success_replay(
      p_job_id, p_case_id, p_run_generation
    )
    or stored_report is distinct from p_report_payload then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;

  return query select p_job_id, true;
end;
$$;

revoke all on function public.is_v22_verified_success_replay(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.is_v22_verified_success_replay(uuid,uuid,integer)
  to service_role;
revoke all on function public.resolve_v22_verified_analysis_input_strict_generation_v2(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.resolve_v22_verified_analysis_input_strict_generation_v2(uuid,uuid,integer)
  to service_role;
revoke all on function public.persist_v22_verified_result_strict_generation_v2(uuid,uuid,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.persist_v22_verified_result_strict_generation_v2(uuid,uuid,jsonb,integer)
  to service_role;
revoke all on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  to service_role;
revoke all on function public.persist_v22_verified_result(uuid,uuid,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.persist_v22_verified_result(uuid,uuid,jsonb,integer)
  to service_role;

comment on function public.is_v22_verified_success_replay(uuid,uuid,integer) is
  'Checks the complete immutable success tuple for same-or-higher generation acknowledgement recovery.';
comment on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer) is
  'Strictly fences active work while allowing a newer owner to read an already-settled success.';
comment on function public.persist_v22_verified_result(uuid,uuid,jsonb,integer) is
  'Persists active work at exact generation or acknowledges an identical settled result from a newer owner.';

commit;
