-- Verified attempts bind trusted inputs and reserve exactly one account credit.
begin;

alter table public.client_cases
  add column latest_verified_report_id uuid references public.reports(id) on delete set null;

create table public.verified_analysis_inputs (
  job_id uuid primary key references public.analysis_jobs(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  parent_report_id uuid not null references public.reports(id) on delete restrict,
  gsc_snapshot_id uuid not null references public.data_snapshots(id) on delete restrict,
  ga4_snapshot_id uuid not null references public.data_snapshots(id) on delete restrict,
  public_gbp_snapshot_id uuid not null,
  parent_snapshot_ids uuid[] not null,
  parent_payload jsonb not null,
  parent_payload_checksum text not null check (parent_payload_checksum ~ '^sha256:[0-9a-f]{64}$'),
  input_schema_version text not null default 'v22_verified_job_input_v1'
    check (input_schema_version = 'v22_verified_job_input_v1'),
  created_at timestamptz not null default now(),
  constraint verified_analysis_inputs_snapshot_distinct check (gsc_snapshot_id <> ga4_snapshot_id),
  constraint verified_analysis_inputs_parent_payload_object check (jsonb_typeof(parent_payload) = 'object')
);
create unique index uq_verified_analysis_inputs_case_job on public.verified_analysis_inputs(case_id, job_id);
alter table public.verified_analysis_inputs enable row level security;
grant select, insert, update, delete on public.verified_analysis_inputs to service_role;
revoke all on public.verified_analysis_inputs from public, anon, authenticated;

create function public.validate_v22_case_latest_verified_report() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.latest_verified_report_id is not null and not exists (
    select 1 from public.reports r where r.id = new.latest_verified_report_id
      and r.case_id = new.id and r.user_id = new.user_id and r.report_type = 'verified_execution'
  ) then
    raise exception 'latest_verified_report_id must reference a Verified report owned by the same case and user'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create constraint trigger validate_client_case_latest_verified_report
after insert or update on public.client_cases deferrable initially immediate
for each row execute function public.validate_v22_case_latest_verified_report();

create function public.enforce_v22_verified_input_immutability() returns trigger
language plpgsql set search_path = public as $$
begin
  if new is distinct from old then raise exception 'Verified analysis inputs are immutable'; end if;
  return new;
end;
$$;
create trigger enforce_verified_analysis_input_immutability
before update on public.verified_analysis_inputs
for each row execute function public.enforce_v22_verified_input_immutability();

create function public.start_v22_verified_analysis(
  p_user_id uuid, p_case_id uuid, p_job_id uuid, p_idempotency_key text,
  p_parent_payload_checksum text, p_previous_job_id uuid default null
) returns table (
  job_id uuid, created boolean, idempotent boolean, parent_report_id uuid,
  gsc_snapshot_id uuid, ga4_snapshot_id uuid, public_gbp_snapshot_id uuid, audit_credits integer
)
language plpgsql set search_path = public as $$
declare
  c public.client_cases;
  parent public.reports;
  current_report public.reports;
  existing_job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  b public.case_source_bindings;
  s public.data_snapshots;
  source text;
  selected_gsc uuid;
  selected_ga4 uuid;
  public_ids uuid[];
  resulting_balance integer;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200
    or p_parent_payload_checksum is null or p_parent_payload_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;
  -- Serialize all attempts for a Case before touching jobs, reports or credits.
  select * into c from public.client_cases
  where id = p_case_id and user_id = p_user_id and status = 'active' for update;
  if not found then raise exception 'V22_VERIFIED_CASE_INVALID'; end if;

  select * into existing_job from public.analysis_jobs j
  where j.id = p_job_id or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by (j.id = p_job_id) desc limit 1 for update;
  if found then
    select * into bound from public.verified_analysis_inputs i where i.job_id = existing_job.id;
    if existing_job.id is distinct from p_job_id or existing_job.case_id is distinct from p_case_id
      or existing_job.job_type <> 'verified_report' or existing_job.idempotency_key <> p_idempotency_key
      or existing_job.previous_job_id is distinct from p_previous_job_id
      or bound.job_id is null or bound.case_id <> p_case_id
      or bound.parent_payload_checksum is distinct from p_parent_payload_checksum
      or not exists (select 1 from public.analysis_attempt_charges a where a.job_id = p_job_id
        and a.case_id = p_case_id and a.user_id = p_user_id and a.source = 'account_credit') then
      raise exception 'V22_VERIFIED_IDENTITY_CONFLICT';
    end if;
    select u.audit_credits into resulting_balance from public.users u where u.id = p_user_id;
    return query select p_job_id, false, true, bound.parent_report_id, bound.gsc_snapshot_id,
      bound.ga4_snapshot_id, bound.public_gbp_snapshot_id, resulting_balance;
    return;
  end if;
  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs j where j.id = p_previous_job_id and j.case_id = p_case_id
      and j.job_type = 'verified_report' and j.status = 'failed'
  ) then raise exception 'V22_VERIFIED_PREVIOUS_JOB_INVALID'; end if;

  select * into current_report from public.reports r where r.id = c.latest_report_id for share;
  select * into parent from public.reports r
  where r.id = case when current_report.report_type = 'prospect' then current_report.id
    when current_report.report_type = 'verified_execution' then current_report.parent_report_id end for share;
  if parent.id is null or parent.user_id <> p_user_id or parent.case_id <> p_case_id
    or parent.report_type <> 'prospect' or parent.status <> 'paid_full' or parent.schema_version <> '2.2.0'
    or parent.parent_report_id is not null or jsonb_typeof(parent.report_v2_2) is distinct from 'object'
    or parent.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text
    or parent.report_v2_2 #>> '{report_version,report_id}' is distinct from parent.id::text
    or parent.report_v2_2 #>> '{report_version,report_type}' is distinct from 'prospect'
    or parent.report_v2_2 #>> '{report_version,schema_version}' is distinct from '2.2.0'
    or parent.report_v2_2 #> '{report_version,parent_report_id}' is distinct from 'null'::jsonb
    or parent.report_v2_2 #>> '{report_version,version_number}' is distinct from parent.version_number::text then
    raise exception 'V22_VERIFIED_PARENT_INVALID';
  end if;
  if cardinality(parent.snapshot_ids) is distinct from 3 or (
    select count(distinct d.source_type) from public.data_snapshots d
    where d.id = any(parent.snapshot_ids) and d.case_id = p_case_id and d.source_type in ('site','serp','competitor')
  ) <> 3 then raise exception 'V22_VERIFIED_PARENT_SNAPSHOTS_INVALID'; end if;

  select array_agg(distinct (e->>'snapshot_id')::uuid) into public_ids
  from jsonb_array_elements(parent.report_v2_2->'evidence_index') e
  where e->>'source_type' = 'gbp' and e->>'health_status' = 'healthy'
    and e #>> '{source_locator,url}' = c.business_identity->>'public_gbp_url'
    and btrim(c.business_identity->>'public_gbp_url') <> ''
    and exists (select 1 from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type' = 'gbp' and coverage->>'health_status' = 'healthy'
        and coverage->>'identity_match_status' = 'matched'
        and coverage->'snapshot_ids' @> jsonb_build_array(e->>'snapshot_id'));
  if cardinality(public_ids) is distinct from 1 then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  foreach source in array array['gsc','ga4'] loop
    select * into b from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.source_type = source and binding.is_active for share;
    if b.id is null or b.identity_match_status <> 'matched' or b.confirmed_at is null
      or b.confirmed_by_user_id is distinct from p_user_id or b.health_status <> 'healthy' then
      raise exception 'V22_VERIFIED_BINDING_INVALID';
    end if;
    perform 1 from public.google_connections g
      where g.id = b.connection_id and g.user_id = p_user_id and g.status = 'active' for share;
    if not found then raise exception 'V22_VERIFIED_CONNECTION_INVALID'; end if;
    -- Pick the latest first, then validate; never fall back to an older healthy row.
    select * into s from public.data_snapshots d where d.binding_id = b.id and d.source_type = source
      order by d.fetched_at desc, d.id desc limit 1 for share;
    if s.id is null or s.case_id <> p_case_id or s.health_status <> 'healthy'
      or s.schema_version <> source || '_sync_v1' or s.expires_at is null or s.expires_at <= now()
      or s.fetched_at > now() or s.coverage_start is null or s.coverage_end is null
      or s.raw_payload is not null
      or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id then
      raise exception 'V22_VERIFIED_SNAPSHOT_INVALID';
    end if;
    if source = 'gsc' then selected_gsc := s.id; else selected_ga4 := s.id; end if;
  end loop;
  if public_ids[1] in (selected_gsc, selected_ga4) then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  update public.users u set audit_credits = u.audit_credits - 1
    where u.id = p_user_id and u.audit_credits >= 1 returning u.audit_credits into resulting_balance;
  if resulting_balance is null then raise exception 'V22_VERIFIED_CREDIT_UNAVAILABLE'; end if;
  insert into public.analysis_jobs (
    id,case_id,job_type,status,current_stage,progress,attempt_count,idempotency_key,
    cost_counters,run_generation,deadline_at,previous_job_id
  ) values (p_job_id,p_case_id,'verified_report','queued','queued',0,0,p_idempotency_key,
    '{}'::jsonb,1,now()+interval '20 minutes',p_previous_job_id);
  insert into public.analysis_attempt_charges(user_id,case_id,job_id,source)
    values (p_user_id,p_case_id,p_job_id,'account_credit');
  insert into public.audit_credit_ledger(user_id,case_id,job_id,kind,delta,balance_after)
    values (p_user_id,p_case_id,p_job_id,'attempt_debit',-1,resulting_balance);
  -- Service-role caller hashes the complete ReportV22 using recursive sorted keys,
  -- preserved array order and JSON.stringify. Do not reserialize JSONB for hashing:
  -- PostgreSQL numeric scale is not the application's canonical byte encoding.
  insert into public.verified_analysis_inputs(job_id,case_id,parent_report_id,gsc_snapshot_id,
    ga4_snapshot_id,public_gbp_snapshot_id,parent_snapshot_ids,parent_payload,parent_payload_checksum)
    values (p_job_id,p_case_id,parent.id,selected_gsc,selected_ga4,public_ids[1],
      parent.snapshot_ids,parent.report_v2_2,p_parent_payload_checksum);
  return query select p_job_id,true,false,parent.id,selected_gsc,selected_ga4,public_ids[1],resulting_balance;
end;
$$;

create function public.resolve_v22_verified_analysis_input(p_job_id uuid,p_case_id uuid,p_run_generation integer)
returns jsonb language plpgsql set search_path = public as $$
declare
  bound public.verified_analysis_inputs;
  source_snapshots jsonb;
  first_party jsonb;
begin
  perform 1 from public.analysis_jobs j where j.id = p_job_id and j.case_id = p_case_id
    and j.job_type = 'verified_report' and j.run_generation = p_run_generation
    and j.status in ('queued','running') for share;
  if not found then raise exception 'V22_VERIFIED_JOB_INVALID'; end if;
  select * into bound from public.verified_analysis_inputs i
    where i.job_id = p_job_id and i.case_id = p_case_id for share;
  if not found then raise exception 'V22_VERIFIED_INPUT_INVALID'; end if;
  select jsonb_object_agg(d.source_type, jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum
  )) into source_snapshots from public.data_snapshots d where d.id = any(bound.parent_snapshot_ids);
  -- Eligibility was frozen at start; neither current binding nor connection state
  -- may silently replace an already paid attempt's evidence.
  select jsonb_agg(jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'binding_id',d.binding_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'identity_match_status','matched','health_status',d.health_status,'health_reasons',d.health_reasons,
    'normalized_payload',d.normalized_payload,'raw_payload',null,'payload_checksum',d.payload_checksum,
    'external_resource_id',d.provider_request_context->>'external_resource_id',
    'coverage_start',d.coverage_start,'coverage_end',d.coverage_end
  ) order by case d.id when bound.gsc_snapshot_id then 1 else 2 end) into first_party
  from public.data_snapshots d where d.id in (bound.gsc_snapshot_id,bound.ga4_snapshot_id);
  return jsonb_build_object('schema_version','v22_verified_resolved_input_v1','job_id',p_job_id,
    'case_id',p_case_id,'parent_report',bound.parent_payload,'parent_payload_checksum',bound.parent_payload_checksum,
    'site_snapshot',source_snapshots->'site','serp_snapshot',source_snapshots->'serp',
    'competitor_snapshot',source_snapshots->'competitor','first_party_snapshots',first_party);
end;
$$;

create function public.persist_v22_verified_result(p_job_id uuid,p_case_id uuid,p_report_payload jsonb,p_run_generation integer)
returns table(report_id uuid,idempotent boolean) language plpgsql set search_path = public as $$
declare
  c public.client_cases;
  job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  parent public.reports;
  existing_report public.reports;
  generated timestamptz;
  allowed_ids uuid[];
begin
  select * into c from public.client_cases where id = p_case_id for update;
  select * into job from public.analysis_jobs j where j.id = p_job_id and j.case_id = p_case_id for update;
  if job.id is null or job.job_type <> 'verified_report' or job.run_generation is distinct from p_run_generation then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;
  select * into bound from public.verified_analysis_inputs i where i.job_id = p_job_id and i.case_id = p_case_id for update;
  if not found then raise exception 'V22_VERIFIED_INPUT_INVALID'; end if;
  select * into parent from public.reports r where r.id = bound.parent_report_id for share;
  if parent.report_v2_2 is distinct from bound.parent_payload or parent.snapshot_ids is distinct from bound.parent_snapshot_ids
    or parent.user_id is distinct from c.user_id or parent.case_id is distinct from p_case_id
    or bound.parent_payload_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'V22_VERIFIED_PARENT_CHANGED';
  end if;
  if jsonb_typeof(p_report_payload) is distinct from 'object'
    or p_report_payload #>> '{report_version,report_id}' is distinct from p_job_id::text
    or p_report_payload #>> '{report_version,report_type}' is distinct from 'verified_execution'
    or p_report_payload #>> '{report_version,schema_version}' is distinct from '2.2.0'
    or p_report_payload #>> '{identity,case_id}' is distinct from p_case_id::text
    or p_report_payload #>> '{report_version,parent_report_id}' is distinct from bound.parent_report_id::text
    or p_report_payload #>> '{report_version,version_number}' is distinct from (parent.version_number + 1)::text
    or p_report_payload #>> '{first_party_performance,gsc,snapshot_id}' is distinct from bound.gsc_snapshot_id::text
    or p_report_payload #>> '{first_party_performance,ga4,snapshot_id}' is distinct from bound.ga4_snapshot_id::text
    or jsonb_typeof(p_report_payload->'evidence_index') is distinct from 'array' then
    raise exception 'V22_VERIFIED_RESULT_INVALID';
  end if;
  allowed_ids := bound.parent_snapshot_ids || array[bound.public_gbp_snapshot_id,bound.gsc_snapshot_id,bound.ga4_snapshot_id];
  if jsonb_typeof(p_report_payload #> '{data_coverage,sources}') is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(p_report_payload #> '{data_coverage,sources}') coverage
    where coverage->>'source_type' in ('gsc','ga4') and coverage->'snapshot_ids' is distinct from
      jsonb_build_array(case coverage->>'source_type' when 'gsc' then bound.gsc_snapshot_id else bound.ga4_snapshot_id end)
  ) then raise exception 'V22_VERIFIED_COVERAGE_INVALID'; end if;
  if exists (select 1 from jsonb_array_elements(p_report_payload->'evidence_index') e
    where e->>'snapshot_id' is null or not ((e->>'snapshot_id')::uuid = any(allowed_ids))
      or (e->>'source_type' = 'gsc' and e->>'snapshot_id' is distinct from bound.gsc_snapshot_id::text)
      or (e->>'source_type' = 'ga4' and e->>'snapshot_id' is distinct from bound.ga4_snapshot_id::text)) then
    raise exception 'V22_VERIFIED_EVIDENCE_INVALID';
  end if;
  if job.report_id is not null then
    select * into existing_report from public.reports r where r.id = job.report_id;
    if job.report_id <> p_job_id or existing_report.report_v2_2 is distinct from p_report_payload then
      raise exception 'V22_VERIFIED_RESULT_CONFLICT';
    end if;
    return query select p_job_id,true;
    return;
  end if;
  if job.status not in ('queued','running') then raise exception 'V22_VERIFIED_JOB_INVALID'; end if;
  generated := (p_report_payload #>> '{report_version,generated_at}')::timestamptz;
  insert into public.reports (id,report_id,user_id,page_url,gbp_url,task_id,status,access_type,
    completed_at,generated_at,case_id,report_type,schema_version,version_number,parent_report_id,
    report_v2_2,snapshot_ids,coverage_state,version_diff,generation_config,ruleset_version,copy_model_version)
  values (p_job_id,p_job_id::text,c.user_id,p_report_payload #>> '{identity,business,site_url}',
    coalesce(p_report_payload #>> '{identity,business,public_gbp_url}',''),p_job_id::text,'paid_full','unlocked',
    generated,generated,p_case_id,'verified_execution','2.2.0',parent.version_number+1,bound.parent_report_id,
    p_report_payload,bound.parent_snapshot_ids || array[bound.gsc_snapshot_id,bound.ga4_snapshot_id],
    p_report_payload->'data_coverage',p_report_payload->'version_diff',
    '{"pipeline":"verified_generation_v1","evidence_policy":"traceable_snapshots_only"}'::jsonb,
    p_report_payload #>> '{report_version,ruleset_version}',p_report_payload #>> '{report_version,copy_model_version}');
  update public.analysis_jobs j set report_id = p_job_id where j.id = p_job_id;
  update public.client_cases set latest_report_id = p_job_id,latest_verified_report_id = p_job_id where id = p_case_id;
  return query select p_job_id,false;
end;
$$;

create function public.expire_v22_stale_verified_jobs(p_now timestamptz,p_limit integer default 100)
returns table(job_id uuid) language plpgsql set search_path = public as $$
declare
  job public.analysis_jobs;
begin
  if p_now is null or p_limit is null or p_limit < 1 then raise exception 'V22_VERIFIED_EXPIRY_INVALID'; end if;
  for job in select * from public.analysis_jobs j where j.job_type = 'verified_report'
    and j.status = 'queued' and j.report_id is null and j.deadline_at <= p_now
    order by j.deadline_at,j.id limit p_limit for update skip locked
  loop
    perform public.apply_analysis_job_event(job.id,job.case_id,job.state_revision+1,'failed','failed',
      job.progress,job.attempt_count,'V22_VERIFIED_ENQUEUE_TIMEOUT',
      'The analysis could not start. Your credit has been restored. Please try again.',
      job.cost_counters,job.heartbeat_at,p_now,job.run_generation,null);
    return query select job.id;
  end loop;
end;
$$;

revoke all on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer) to service_role;
revoke all on function public.persist_v22_verified_result(uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.persist_v22_verified_result(uuid,uuid,jsonb,integer) to service_role;
revoke all on function public.expire_v22_stale_verified_jobs(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.expire_v22_stale_verified_jobs(timestamptz,integer) to service_role;

commit;
