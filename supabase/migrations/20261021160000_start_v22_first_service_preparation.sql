-- Internal first-service enrollment. No public endpoint or rollout flag is enabled.
begin;
create table public.capability_first_service_preparations (
  job_id uuid primary key references public.analysis_jobs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  business_version_id uuid not null references public.case_business_scope_versions(id),
  business_identity jsonb not null,
  gsc_snapshot_id uuid not null references public.data_snapshots(id),
  ga4_snapshot_id uuid not null references public.data_snapshots(id),
  source_refs jsonb not null check(jsonb_typeof(source_refs)='array' and jsonb_array_length(source_refs)=2),
  created_at timestamptz not null default now()
);
alter table public.capability_first_service_preparations enable row level security;
revoke all on public.capability_first_service_preparations from public,anon,authenticated,service_role;
grant select on public.capability_first_service_preparations to service_role;
create trigger immutable_capability_first_service_preparation before update or delete
on public.capability_first_service_preparations for each row execute function public.reject_v22_capability_mutation();

-- Shared eligibility check; caller holds the Case/authorization locks at enrollment.
create function public.check_v22_first_service_source(p_user_id uuid,p_case_id uuid,p_snapshot_id uuid,p_source text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.data_snapshots; b public.case_source_bindings; c public.google_connections; required_scope text;
begin
  if p_source is null or p_source not in ('gsc','ga4') then raise exception 'FIRST_SERVICE_SOURCE_INVALID'; end if;
  select * into s from public.data_snapshots where id=p_snapshot_id and case_id=p_case_id for share;
  select * into b from public.case_source_bindings where id=s.binding_id and case_id=p_case_id for share;
  select * into c from public.google_connections where id=b.connection_id and user_id=p_user_id;
  required_scope=case when p_source='gsc' then 'https://www.googleapis.com/auth/webmasters.readonly'
    else 'https://www.googleapis.com/auth/analytics.readonly' end;
  if b.id is null or not b.is_active or b.source_type is distinct from p_source
    or b.identity_match_status is distinct from 'matched' or b.health_status is distinct from 'healthy'
    or b.confirmed_at is null or b.confirmed_by_user_id is distinct from p_user_id
    or c.id is null or c.status is distinct from 'active'
    or not (c.granted_scopes @> array['openid','email','profile',required_scope]) then
    raise exception 'FIRST_SERVICE_AUTHORIZATION_INVALID'; end if;
  if s.id is null or s.source_type is distinct from p_source or s.schema_version is distinct from p_source||'_sync_v1'
    or s.health_status is distinct from 'healthy' or s.expires_at is null or s.expires_at<=now() or s.fetched_at>now()
    or s.coverage_start is null or s.coverage_end is null or s.coverage_end<s.coverage_start
    or s.raw_payload is not null or s.normalized_payload is null
    or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id then
    raise exception 'FIRST_SERVICE_SNAPSHOT_INVALID'; end if;
  return jsonb_build_object('snapshot_id',s.id,'case_id',s.case_id,'binding_id',s.binding_id,
    'source_kind',p_source,'schema_version',s.schema_version,'payload_checksum',s.payload_checksum,
    'fetched_at',s.fetched_at,'expires_at',s.expires_at);
end;
$$;
revoke all on function public.check_v22_first_service_source(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.start_v22_first_service_preparation(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_idempotency_key text,p_business_version_id uuid,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; job public.analysis_jobs; prep public.capability_first_service_preparations;
  business public.case_business_scope_versions; charge public.workflow_charges;
  discovered uuid[]; locked uuid[]; current_connections uuid[]; refs jsonb='[]'; source text; selected uuid;
  balance integer; replay boolean=false;
begin
  if p_job_id is null or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$'
    or p_business_version_id is null or p_gsc_snapshot_id is null or p_ga4_snapshot_id is null
    or p_gsc_snapshot_id=p_ga4_snapshot_id then raise exception 'FIRST_SERVICE_INPUT_INVALID'; end if;
  -- Follow the existing connection-before-Case lock order used by resource rebinding.
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}')
    into discovered from public.case_source_bindings b join public.client_cases c on c.id=b.case_id
    where c.id=p_case_id and c.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(discovered) and user_id=p_user_id order by id for share;
  select coalesce(array_agg(id order by id),'{}') into locked from public.google_connections where id=any(discovered) and user_id=p_user_id;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id or (case_id=p_case_id and idempotency_key=p_idempotency_key)
    order by id limit 1 for update;
  select * into prep from public.capability_first_service_preparations where job_id=p_job_id;
  if job.id is not null or prep.job_id is not null then
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id;
    if job.id is distinct from p_job_id or job.case_id is distinct from p_case_id or job.job_type is distinct from 'verified_report'
      or job.idempotency_key is distinct from p_idempotency_key or prep.job_id is null
      or prep.user_id<>p_user_id or prep.case_id<>p_case_id or prep.business_version_id<>p_business_version_id
      or prep.gsc_snapshot_id<>p_gsc_snapshot_id or prep.ga4_snapshot_id<>p_ga4_snapshot_id
      or charge.id is null or charge.user_id<>p_user_id or charge.case_id<>p_case_id or charge.workflow_kind<>'verified'
      or charge.idempotency_key<>p_idempotency_key then
      raise exception 'FIRST_SERVICE_CONFLICT' using errcode='40001'; end if;
    -- Recovery never refreshes sources, changes the deadline, or reserves again.
    replay=true;
  else
    select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}')
      into current_connections from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
    if current_connections is distinct from discovered or current_connections is distinct from locked then
      raise exception 'FIRST_SERVICE_BINDING_CHANGED' using errcode='40001'; end if;
    if cc.latest_report_id is not null
      or exists(select 1 from public.reports where case_id=p_case_id and status='paid_full')
      or exists(select 1 from public.analysis_jobs where case_id=p_case_id and (status in ('queued','running') or capability_report_id is not null))
      or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then
      raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    select * into business from public.case_business_scope_versions where case_id=p_case_id and user_id=p_user_id order by revision desc limit 1;
    if business.id is distinct from p_business_version_id
      or jsonb_typeof(business.scope->'competitor_sites') is distinct from 'array'
      or jsonb_array_length(business.scope->'competitor_sites') not between 1 and 3
      or coalesce(btrim(cc.business_identity->>'public_gbp_url'),'')=''
      or cc.business_identity->>'site_url' is distinct from business.scope->>'site_url'
      or cc.site_url is distinct from business.scope->>'site_url'
      or cc.primary_service is distinct from business.scope->>'primary_service'
      or cc.target_market->>'display_name' is distinct from business.scope->>'target_market' then
      raise exception 'FIRST_SERVICE_BUSINESS_NOT_READY'; end if;
    foreach source in array array['gsc','ga4'] loop
      selected=case when source='gsc' then p_gsc_snapshot_id else p_ga4_snapshot_id end;
      refs=refs||jsonb_build_array(public.check_v22_first_service_source(p_user_id,p_case_id,selected,source));
      if selected is distinct from (select d.id from public.data_snapshots d join public.case_source_bindings b on b.id=d.binding_id
        where b.case_id=p_case_id and b.is_active and b.source_type=source and d.source_type=source
        order by d.fetched_at desc,d.id desc limit 1) then raise exception 'FIRST_SERVICE_SNAPSHOT_NOT_CURRENT'; end if;
    end loop;
    update public.users set credit_balance=credit_balance-1,updated_at=now()
      where id=p_user_id and credit_balance>=1 returning credit_balance into balance;
    if balance is null then raise exception 'INSUFFICIENT_CREDITS'; end if;
    -- A legacy reservation may have committed while this transaction waited
    -- for the account lock. Fail atomically rather than charging both paths.
    if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then
      raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    insert into public.analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,deadline_at)
      values(p_job_id,p_case_id,'verified_report','queued','queued',p_idempotency_key,now()+interval '20 minutes') returning * into job;
    insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id)
      values(p_job_id,p_user_id,p_case_id,'verified',p_idempotency_key,p_job_id);
    insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
      values(p_user_id,p_case_id,p_job_id,p_job_id,'verified_debit',-1,balance,'workflow:'||p_job_id::text||':debit');
    insert into public.capability_first_service_preparations(job_id,user_id,case_id,business_version_id,business_identity,gsc_snapshot_id,ga4_snapshot_id,source_refs)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,cc.business_identity,p_gsc_snapshot_id,p_ga4_snapshot_id,refs) returning * into prep;
  end if;
  select credit_balance into balance from public.users where id=p_user_id;
  return jsonb_build_object('schema_version','v22_first_service_preparation_v1','mode','first_service',
    'user_id',p_user_id,'case_id',p_case_id,'job_id',p_job_id,'idempotency_key',p_idempotency_key,
    'business_version_id',prep.business_version_id,'gsc_snapshot_id',prep.gsc_snapshot_id,'ga4_snapshot_id',prep.ga4_snapshot_id,
    'idempotent',replay,'credit_balance',balance,'status',job.status,'created_at',job.created_at,'deadline_at',job.deadline_at);
end;
$$;
revoke all on function public.start_v22_first_service_preparation(uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_v22_first_service_preparation(uuid,uuid,uuid,text,uuid,uuid,uuid) to service_role;

-- The opposite direction: existing reservation RPCs already hold the account
-- lock when inserting a charge. An enrolled active service cannot be bypassed
-- by opening a Prospect flow in another tab. Unenrolled Cases are unchanged.
create function public.guard_v22_first_service_parallel_charge() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.capability_first_service_preparations p
    join public.workflow_charges c on c.analysis_job_id=p.job_id
    where p.case_id=new.case_id and c.state='reserved') then
    raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
  return new;
end;
$$;
revoke all on function public.guard_v22_first_service_parallel_charge() from public,anon,authenticated;
create trigger guard_first_service_parallel_charge before insert on public.workflow_charges
for each row execute function public.guard_v22_first_service_parallel_charge();

-- The collector cannot replace the private inputs or reinterpret this as acquisition.
create function public.check_v22_first_service_preparation_binding() returns trigger
language plpgsql set search_path=public as $$
declare prep public.capability_first_service_preparations; m public.analysis_input_manifests; ref jsonb; actual jsonb; source text; pub jsonb;
begin
  if TG_TABLE_NAME='analysis_jobs' then
    if new.report_id is not null and exists(select 1 from public.capability_first_service_preparations where job_id=new.id) then
      raise exception 'FIRST_SERVICE_LEGACY_RESULT_FORBIDDEN'; end if;
  elsif TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_first_service_preparations where job_id=new.job_id;
    if prep.job_id is null then return new; end if;
    if new.user_id<>prep.user_id or new.case_id<>prep.case_id or new.business_version_id<>prep.business_version_id
      or new.mode<>'first_service' or new.payload->'previous_report' is distinct from 'null'::jsonb
      or new.payload->'implementation' is distinct from 'null'::jsonb
      or prep.business_identity is distinct from (select business_identity from public.client_cases where id=prep.case_id)
      or jsonb_array_length(new.payload->'snapshots')<>6 then raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    for ref in select value from jsonb_array_elements(prep.source_refs) loop
      source=ref->>'source_kind';
      actual=public.check_v22_first_service_source(prep.user_id,prep.case_id,(ref->>'snapshot_id')::uuid,source);
      if actual is distinct from ref or not exists(select 1 from jsonb_array_elements(new.payload->'snapshots') s where
        s->>'source_kind'=source and s->>'snapshot_id'=ref->>'snapshot_id' and s->>'payload_checksum'=ref->>'payload_checksum'
        and s->>'binding_id'=ref->>'binding_id' and (s->>'fetched_at')::timestamptz=(ref->>'fetched_at')::timestamptz
        and (s->>'expires_at')::timestamptz=(ref->>'expires_at')::timestamptz) then
        raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    end loop;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_first_service_preparations where job_id=m.job_id;
    if prep.job_id is null then return new; end if;
    pub=new.recipe#>'{request,public_input}';
    if pub->'business_identity' is distinct from prep.business_identity
      or pub#>>'{evidence_input,context,target_market,display_name}' is distinct from m.payload#>>'{business,target_market}'
      or (select jsonb_agg(v->>'website_url' order by v->>'website_url') from jsonb_array_elements(pub#>'{evidence_input,context,competitors}') v)
        is distinct from (select jsonb_agg(v order by v) from jsonb_array_elements(m.payload#>'{business,competitor_sites}') v) then
      raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_v22_first_service_preparation_binding() from public,anon,authenticated;
create trigger check_first_service_manifest before insert on public.analysis_input_manifests
for each row execute function public.check_v22_first_service_preparation_binding();
create trigger check_first_service_recipe before insert on public.capability_generation_recipes
for each row execute function public.check_v22_first_service_preparation_binding();
create trigger prevent_first_service_legacy_result before update of report_id on public.analysis_jobs
for each row execute function public.check_v22_first_service_preparation_binding();

-- Authorization can change after the manifest was frozen. Recheck immediately
-- before an enrolled first-service task is resolved or dispatched; completed
-- delivery remains accessible even if a source is subsequently disconnected.
alter function public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer)
  rename to resolve_v22_capability_analysis_input_before_first_service;
revoke all on function public.resolve_v22_capability_analysis_input_before_first_service(uuid,uuid,uuid,text,integer)
  from public,anon,authenticated,service_role;
create function public.resolve_v22_capability_analysis_input(p_job_id uuid,p_case_id uuid,p_manifest_id uuid,p_input_checksum text,p_run_generation integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; prep public.capability_first_service_preparations; ref jsonb;
begin
  result=public.resolve_v22_capability_analysis_input_before_first_service(p_job_id,p_case_id,p_manifest_id,p_input_checksum,p_run_generation);
  select * into prep from public.capability_first_service_preparations where job_id=p_job_id and case_id=p_case_id;
  if prep.job_id is not null and result->'completed_report'='null'::jsonb then
    if prep.business_identity is distinct from (select business_identity from public.client_cases where id=p_case_id) then
      raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    for ref in select value from jsonb_array_elements(prep.source_refs) loop
      if public.check_v22_first_service_source(prep.user_id,p_case_id,(ref->>'snapshot_id')::uuid,ref->>'source_kind') is distinct from ref then
        raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    end loop;
  end if;
  return result;
end;
$$;
revoke all on function public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer) to service_role;

-- Preserve the recovery RPC used by the existing reconciler, including pre-manifest enrollment.
create or replace function public.expire_v22_prepared_capability_jobs(p_limit integer default 100)
returns table(job_id uuid) language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; owner_id uuid;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'CAPABILITY_EXPIRY_INVALID'; end if;
  for job in select j.* from public.analysis_jobs j where j.status in ('queued','running') and j.deadline_at<=now()
    and j.report_id is null and j.capability_report_id is null
    and (exists(select 1 from public.analysis_input_manifests i where i.job_id=j.id)
      or exists(select 1 from public.capability_acquisition_preparations p where p.job_id=j.id)
      or exists(select 1 from public.capability_first_service_preparations p where p.job_id=j.id))
    order by j.deadline_at,j.id limit p_limit for update of j skip locked
  loop
    select c.user_id into owner_id from public.workflow_charges c where c.analysis_job_id=job.id and c.case_id=job.case_id;
    if owner_id is null then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
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
