-- Explicitly enrolled, already-reserved acquisition tasks; no new debit.
begin;
create table public.capability_acquisition_preparations (
  job_id uuid primary key references public.analysis_jobs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  business_version_id uuid not null references public.case_business_scope_versions(id),
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=150000),
  request_checksum text not null check(request_checksum ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.capability_acquisition_preparations enable row level security;
revoke all on public.capability_acquisition_preparations from public,anon,authenticated,service_role;
grant select on public.capability_acquisition_preparations to service_role;
create trigger immutable_capability_acquisition_preparation before update or delete
on public.capability_acquisition_preparations for each row execute function public.reject_v22_capability_mutation();

create function public.begin_v22_acquisition_preparation(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_idempotency_key text,p_business_version_id uuid,p_request_canonical text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; business public.case_business_scope_versions;
  charge public.workflow_charges; saved public.capability_acquisition_preparations;
  body jsonb; req jsonb; checksum text; dispatch jsonb=null;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if job.id is null or job.idempotency_key is distinct from p_idempotency_key
    or job.job_type<>'prospect_report' or job.status not in ('queued','running','succeeded')
    or job.report_id is not null then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  select * into business from public.case_business_scope_versions where id=p_business_version_id
    and user_id=p_user_id and case_id=p_case_id;
  if business.id is null or p_request_canonical is null or octet_length(p_request_canonical)>150000 then
    raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'analyze_request';
  if body->>'schema_version' is distinct from 'v22_analysis_request_envelope_v1'
    or body-array['schema_version','analyze_request','competitor_discovery']<>'{}'::jsonb
    or jsonb_typeof(body->'competitor_discovery') is distinct from 'object'
    or req->>'case_id' is distinct from p_case_id::text or req->>'report_type' is distinct from 'prospect'
    or req->'first_party_snapshots' is distinct from '[]'::jsonb
    or req#>>'{business_identity,site_url}' is distinct from business.scope->>'site_url'
    or req->>'primary_service' is distinct from business.scope->>'primary_service'
    or req#>>'{target_market,display_name}' is distinct from business.scope->>'target_market'
    or jsonb_typeof(req->'competitors') is distinct from 'array'
    or jsonb_array_length(req->'competitors') not between 1 and 3 then raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  if (select jsonb_agg(value->>'website_url' order by value->>'website_url') from jsonb_array_elements(req->'competitors'))
    is distinct from (select jsonb_agg(value order by value) from jsonb_array_elements(business.scope->'competitor_sites')) then
    raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_request_canonical,'UTF8')),'hex');
  select * into saved from public.capability_acquisition_preparations where job_id=p_job_id;
  if saved.job_id is not null then
    if saved.user_id<>p_user_id or saved.case_id<>p_case_id or saved.business_version_id<>p_business_version_id
      or saved.request is distinct from body or saved.request_checksum is distinct from checksum then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT' using errcode='40001'; end if;
  else
    -- Never adopt a task that has already run on the legacy path.
    if job.status<>'queued' or job.attempt_count<>0 or job.capability_report_id is not null
      or exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
      raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  end if;
  if job.status<>'succeeded' then
    if job.deadline_at<=now() then raise exception 'CAPABILITY_PREPARATION_EXPIRED'; end if;
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id and user_id=p_user_id and case_id=p_case_id for update;
    if charge.id is null or charge.workflow_kind<>'prospect' or charge.state<>'reserved'
      or not exists(select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
        and l.case_id=p_case_id and l.delta=-1 and l.kind='prospect_debit') then
      raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED'; end if;
  end if;
  if saved.job_id is null then
    insert into public.capability_acquisition_preparations(job_id,user_id,case_id,business_version_id,request,request_checksum)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,body,checksum);
  end if;
  if exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
    dispatch=public.get_v22_capability_dispatch(p_user_id,p_case_id,p_job_id,p_idempotency_key);
  elsif job.status='succeeded' then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  return jsonb_build_object('schema_version','v22_acquisition_preparation_v1','user_id',p_user_id,'case_id',p_case_id,
    'job_id',p_job_id,'idempotency_key',p_idempotency_key,'business',business.scope,'request_checksum',checksum,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'run_generation',job.run_generation,
    'cost_counters',job.cost_counters,'dispatch',dispatch);
end;
$$;
revoke all on function public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text) to service_role;

-- Prevent a prepared result from being attached to a different confirmed intent.
create function public.check_v22_acquisition_preparation_binding() returns trigger
language plpgsql set search_path=public as $$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if prep.job_id is not null and (new.user_id<>prep.user_id or new.case_id<>prep.case_id
      or new.business_version_id<>prep.business_version_id or new.mode<>'acquisition') then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_acquisition_preparations where job_id=m.job_id;
    if prep.job_id is not null then
      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      if pub->'business_identity' is distinct from req->'business_identity'
        or pub#>'{evidence_input,context,queries}' is distinct from req->'queries'
        or pub#>'{evidence_input,context,target_market}' is distinct from req->'target_market'
        or pub#>'{evidence_input,context,competitors}' is distinct from req->'competitors' then
        raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_v22_acquisition_preparation_binding() from public,anon,authenticated;
create trigger check_capability_acquisition_manifest before insert on public.analysis_input_manifests
for each row execute function public.check_v22_acquisition_preparation_binding();
create trigger check_capability_acquisition_recipe before insert on public.capability_generation_recipes
for each row execute function public.check_v22_acquisition_preparation_binding();

create function public.prevent_v22_preparation_legacy_result() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.report_id is not null and exists(select 1 from public.capability_acquisition_preparations where job_id=new.id) then
    raise exception 'CAPABILITY_PREPARATION_LEGACY_RESULT_FORBIDDEN';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_v22_preparation_legacy_result() from public,anon,authenticated;
create trigger prevent_capability_preparation_legacy_result before update of report_id on public.analysis_jobs
for each row execute function public.prevent_v22_preparation_legacy_result();

-- Keep the existing recovery RPC/cron contract, and include explicitly enrolled
-- pre-manifest tasks. Unmarked legacy jobs remain outside this recovery lane.
create or replace function public.expire_v22_prepared_capability_jobs(p_limit integer default 100)
returns table(job_id uuid) language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; owner_id uuid;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'CAPABILITY_EXPIRY_INVALID'; end if;
  for job in select j.* from public.analysis_jobs j
    where j.status in ('queued','running') and j.deadline_at<=now()
      and j.report_id is null and j.capability_report_id is null
      and (exists(select 1 from public.analysis_input_manifests i where i.job_id=j.id)
        or exists(select 1 from public.capability_acquisition_preparations p where p.job_id=j.id))
    order by j.deadline_at,j.id limit p_limit for update of j skip locked
  loop
    select user_id into owner_id from public.analysis_input_manifests where analysis_input_manifests.job_id=job.id;
    if owner_id is null then select user_id into owner_id from public.capability_acquisition_preparations where capability_acquisition_preparations.job_id=job.id; end if;
    perform public.apply_analysis_job_event(job.id,job.case_id,job.state_revision+1,'failed','failed',job.progress,
      job.attempt_count,'JOB_DEADLINE_EXCEEDED','The analysis could not finish within its processing deadline.',
      job.cost_counters,job.heartbeat_at,now(),job.run_generation,job.deadline_at);
    if not exists(select 1 from public.workflow_charges c where c.analysis_job_id=job.id and c.case_id=job.case_id
      and c.user_id=owner_id and c.state='compensated') then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
    return query select job.id;
  end loop;
end;
$$;
commit;
