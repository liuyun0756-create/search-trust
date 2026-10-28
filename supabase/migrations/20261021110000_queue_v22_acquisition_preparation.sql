-- Internal preparation leases. No new job, entitlement or debit is created.
begin;
create table public.capability_acquisition_runs (
  job_id uuid primary key references public.capability_acquisition_preparations(job_id),
  run_generation integer not null check(run_generation>=1),
  lease_token uuid not null,
  lease_until timestamptz not null
);
alter table public.capability_acquisition_runs enable row level security;
revoke all on public.capability_acquisition_runs from public,anon,authenticated,service_role;

create function public.claim_v22_acquisition_preparation(p_job_id uuid,p_run_generation integer,
  p_lease_token uuid,p_max_attempts integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prep public.capability_acquisition_preparations; job public.analysis_jobs;
  run public.capability_acquisition_runs; business jsonb; dispatch jsonb=null; outcome text;
begin
  if p_lease_token is null or p_run_generation is null or p_run_generation<1
    or p_max_attempts is null or p_max_attempts not between 1 and 10 then
    raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  select * into prep from public.capability_acquisition_preparations where job_id=p_job_id;
  if prep.job_id is null then return jsonb_build_object('outcome','inactive'); end if;
  perform 1 from public.client_cases where id=prep.case_id and user_id=prep.user_id and status='active' for no key update;
  if not found then return jsonb_build_object('outcome','inactive'); end if;
  select * into job from public.analysis_jobs where id=p_job_id for update;
  if job.run_generation<>p_run_generation or job.status='failed' or job.report_id is not null then
    return jsonb_build_object('outcome','inactive'); end if;
  if exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
    dispatch=public.get_v22_capability_dispatch(prep.user_id,prep.case_id,p_job_id,job.idempotency_key);
    outcome='ready';
  else
    if job.status not in ('queued','running') or job.deadline_at<=clock_timestamp()
      or job.attempt_count>=p_max_attempts then return jsonb_build_object('outcome','inactive'); end if;
    if not exists(select 1 from public.workflow_charges c where c.analysis_job_id=p_job_id
      and c.user_id=prep.user_id and c.case_id=prep.case_id and c.workflow_kind='prospect' and c.state='reserved'
      and exists(select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.delta=-1 and l.kind='prospect_debit'))
      then raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED'; end if;
    select * into run from public.capability_acquisition_runs where job_id=p_job_id;
    if run.job_id is not null and run.lease_until>clock_timestamp() then
      return jsonb_build_object('outcome','busy'); end if;
    insert into public.capability_acquisition_runs(job_id,run_generation,lease_token,lease_until)
      values(p_job_id,p_run_generation,p_lease_token,least(job.deadline_at,clock_timestamp()+interval '90 seconds'))
      on conflict(job_id) do update set run_generation=excluded.run_generation,
        lease_token=excluded.lease_token,lease_until=excluded.lease_until;
    update public.analysis_jobs set status='running',current_stage='collecting_site',
      user_message='Preparing the analysis sources.',attempt_count=attempt_count+1,
      state_revision=state_revision+1,heartbeat_at=clock_timestamp(),started_at=coalesce(started_at,clock_timestamp())
      where id=p_job_id returning * into job;
    outcome='claimed';
  end if;
  select scope into business from public.case_business_scope_versions where id=prep.business_version_id;
  return jsonb_build_object('outcome',outcome,'attempt_count',job.attempt_count,'request',prep.request,
    'preparation',jsonb_build_object('schema_version','v22_acquisition_preparation_v1','user_id',prep.user_id,
      'case_id',prep.case_id,'job_id',job.id,'idempotency_key',job.idempotency_key,'business',business,
      'request_checksum',prep.request_checksum,'created_at',job.created_at,'deadline_at',job.deadline_at,
      'run_generation',job.run_generation,'cost_counters',job.cost_counters,'dispatch',dispatch));
end;
$$;

create function public.heartbeat_v22_acquisition_preparation(p_job_id uuid,p_run_generation integer,
  p_lease_token uuid,p_cost_counters jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; run public.capability_acquisition_runs;
begin
  if p_job_id is null or p_run_generation is null or p_lease_token is null then return false; end if;
  select * into job from public.analysis_jobs where id=p_job_id for update;
  select * into run from public.capability_acquisition_runs where job_id=p_job_id;
  if job.id is null or job.run_generation<>p_run_generation or job.status not in ('queued','running')
    or job.deadline_at<=clock_timestamp() or run.lease_token is distinct from p_lease_token
    or run.run_generation<>p_run_generation or run.lease_until<=clock_timestamp() then return false; end if;
  -- A late heartbeat must never write over formal execution after the handoff.
  if exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then return false; end if;
  if jsonb_typeof(p_cost_counters) is distinct from 'object' then raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  update public.capability_acquisition_runs set lease_until=least(job.deadline_at,clock_timestamp()+interval '90 seconds') where job_id=p_job_id;
  update public.analysis_jobs set heartbeat_at=clock_timestamp(),state_revision=state_revision+1,
    cost_counters=case when coalesce((p_cost_counters->>'cost_ledger_revision')::bigint,0)
      >=coalesce((job.cost_counters->>'cost_ledger_revision')::bigint,0) then p_cost_counters else job.cost_counters end
    where id=p_job_id;
  return true;
end;
$$;

create function public.freeze_v22_acquisition_preparation(p_lease_token uuid,p_cost_counters jsonb,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; job public.analysis_jobs; prep public.capability_acquisition_preparations;
begin
  select * into prep from public.capability_acquisition_preparations where job_id=(p_input->>'p_job_id')::uuid;
  if prep.job_id is null or prep.user_id::text is distinct from p_input->>'p_user_id'
    or prep.case_id::text is distinct from p_input->>'p_case_id' then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  perform 1 from public.client_cases where id=prep.case_id and user_id=prep.user_id for no key update;
  select * into job from public.analysis_jobs where id=prep.job_id for update;
  if not public.heartbeat_v22_acquisition_preparation(job.id,(p_input->>'p_run_generation')::integer,p_lease_token,p_cost_counters)
    then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  perform set_config('searchtrust.acquisition_lease',p_lease_token::text,true);
  select to_jsonb(t) into result from public.prepare_v22_capability_analysis_input(
    prep.user_id,prep.case_id,job.id,p_input->'p_manifest',p_input->>'p_manifest_canonical',
    p_input->'p_recipe',p_input->>'p_generation_canonical',p_input->'p_public_source_canonicals',
    p_input->>'p_previous_canonical',(p_input->>'p_run_generation')::integer) t;
  -- Formal execution receives these revisions/attempts and the original deadline.
  update public.analysis_jobs set status='queued',current_stage='queued',state_revision=state_revision+1,
    user_message='Sources prepared. Queued for report generation.' where id=job.id;
  return result;
end;
$$;

create function public.fence_v22_acquisition_manifest() returns trigger
language plpgsql set search_path=public as $$
declare run public.capability_acquisition_runs;
begin
  select * into run from public.capability_acquisition_runs where job_id=new.job_id;
  if run.job_id is not null and (run.lease_until<=clock_timestamp()
    or run.lease_token::text is distinct from current_setting('searchtrust.acquisition_lease',true)) then
    raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  return new;
end;
$$;
create trigger fence_v22_acquisition_manifest before insert on public.analysis_input_manifests
for each row execute function public.fence_v22_acquisition_manifest();

revoke all on function public.claim_v22_acquisition_preparation(uuid,integer,uuid,integer) from public,anon,authenticated;
revoke all on function public.heartbeat_v22_acquisition_preparation(uuid,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.freeze_v22_acquisition_preparation(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.claim_v22_acquisition_preparation(uuid,integer,uuid,integer) to service_role;
grant execute on function public.heartbeat_v22_acquisition_preparation(uuid,integer,uuid,jsonb) to service_role;
grant execute on function public.freeze_v22_acquisition_preparation(uuid,jsonb,jsonb) to service_role;
commit;
