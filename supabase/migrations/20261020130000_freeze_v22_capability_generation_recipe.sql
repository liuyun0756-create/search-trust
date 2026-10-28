-- Frozen input preparation and resolver for the default-disabled capability worker.
begin;
create table public.capability_generation_recipes (
  manifest_id uuid primary key references public.analysis_input_manifests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  generation_input_checksum text not null check(generation_input_checksum ~ '^sha256:[a-f0-9]{64}$'),
  recipe jsonb not null check(jsonb_typeof(recipe)='object' and octet_length(recipe::text)<=250000),
  created_at timestamptz not null default now()
);
alter table public.capability_generation_recipes enable row level security;
revoke all on public.capability_generation_recipes from public,anon,authenticated,service_role;
grant select on public.capability_generation_recipes to service_role;
create trigger immutable_capability_generation_recipe before update or delete on public.capability_generation_recipes
for each row execute function public.reject_v22_capability_mutation();

create function public.hydrate_v22_capability_generation_input(p_manifest jsonb,p_recipe jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare body jsonb; pub jsonb; source jsonb; ref jsonb; row public.data_snapshots;
  sources jsonb='[]'; private_sources jsonb='[]'; seen text[]='{}'; kind text; part jsonb;
begin
  if p_recipe->>'schema_version' is distinct from 'v22_generation_recipe_v1'
    or p_recipe-array['schema_version','request']<>'{}'::jsonb or jsonb_typeof(p_recipe->'request') is distinct from 'object'
    or octet_length(p_recipe::text)>250000 then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  body=p_recipe->'request';
  pub=case when p_manifest->>'mode'='acquisition' then body else body->'public_input' end;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array'
    or jsonb_array_length(pub#>'{evidence_input,sources}')<>4 then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  for source in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=source->>'kind';
    if kind is null or kind not in ('site','serp','competitor','public_gbp') or kind=any(seen)
      or source ? 'payload' or (source->'shared_snapshot') ? 'snapshot' then raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    select * into row from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(p_manifest->>'case_id')::uuid;
    if row.id is null or row.payload_checksum is distinct from ref->>'payload_checksum'
      or source#>>'{binding,snapshot_id}' is distinct from ref->>'snapshot_id'
      or source#>>'{binding,case_id}' is distinct from p_manifest->>'case_id'
      or source#>>'{binding,payload_checksum}' is distinct from ref->>'payload_checksum'
      or source#>>'{binding,schema_version}' is distinct from ref->>'schema_version'
      or source#>>'{binding,source_type}' is distinct from (case when kind='public_gbp' then 'gbp' else kind end)
      or source#>>'{binding,health_status}' is distinct from 'healthy'
      or source#>>'{binding,identity_match_status}' is distinct from 'matched'
      or (source#>>'{binding,fetched_at}')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz
      or (source#>>'{binding,expires_at}')::timestamptz is distinct from (ref->>'expires_at')::timestamptz then
      raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID';
    end if;
    source=source||jsonb_build_object('payload',row.normalized_payload);
    if kind='serp' and source->'shared_snapshot' is not null and source->'shared_snapshot'<>'null'::jsonb then
      source=jsonb_set(source,'{shared_snapshot,snapshot}',row.normalized_payload);
    end if;
    sources=sources||jsonb_build_array(source);
  end loop;
  pub=jsonb_set(pub,'{evidence_input,sources}',sources);
  if p_manifest->>'mode'='acquisition' then return pub; end if;
  if jsonb_typeof(body#>'{first_party_input,snapshots}') is distinct from 'array'
    or jsonb_array_length(body#>'{first_party_input,snapshots}')<>(jsonb_array_length(p_manifest->'snapshots')-4) then
    raise exception 'CAPABILITY_RECIPE_PRIVATE_PAYLOAD_FORBIDDEN'; end if;
  seen='{}';
  for part in select value from jsonb_array_elements(body#>'{first_party_input,snapshots}') loop
    if part ? 'normalized_payload' or part ? 'raw_payload' or part->>'snapshot_id'=any(seen) then raise exception 'CAPABILITY_RECIPE_PRIVATE_PAYLOAD_FORBIDDEN'; end if;
    seen=array_append(seen,part->>'snapshot_id');
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'snapshot_id'=part->>'snapshot_id'
      and value->>'source_kind' in ('gsc','ga4','official_gbp');
    select * into row from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(p_manifest->>'case_id')::uuid;
    if row.id is null or row.payload_checksum is distinct from ref->>'payload_checksum'
      or part->>'case_id' is distinct from p_manifest->>'case_id' or part->>'binding_id' is distinct from ref->>'binding_id'
      or part->>'source_type' is distinct from row.source_type or part->>'schema_version' is distinct from row.schema_version
      or part->>'payload_checksum' is distinct from row.payload_checksum or part->>'health_status' is distinct from row.health_status
      or part->>'identity_match_status' is distinct from 'matched' or part->'health_reasons' is distinct from row.health_reasons
      or part->>'external_resource_id' is distinct from row.provider_request_context->>'external_resource_id'
      or (part->>'coverage_start')::date is distinct from row.coverage_start or (part->>'coverage_end')::date is distinct from row.coverage_end
      or (part->>'fetched_at')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz
      or (part->>'expires_at')::timestamptz is distinct from (ref->>'expires_at')::timestamptz
      or (ref->>'source_kind'='official_gbp' and (row.raw_payload is null or row.raw_content_deleted_at is not null)) then
      raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID'; end if;
    part=part||jsonb_build_object('normalized_payload',row.normalized_payload,
      'raw_payload',case when ref->>'source_kind'='official_gbp' then row.raw_payload else 'null'::jsonb end);
    private_sources=private_sources||jsonb_build_array(part);
  end loop;
  body=jsonb_set(body,'{public_input}',pub);
  return jsonb_set(body,'{first_party_input,snapshots}',private_sources);
end;
$$;

create function public.prepare_v22_capability_analysis_input(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_manifest jsonb,p_manifest_canonical text,p_recipe jsonb,p_generation_canonical text,
  p_public_source_canonicals jsonb,p_previous_canonical text,p_run_generation integer)
returns table(manifest_id uuid,input_checksum text,generation_input_checksum text)
language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
  full_input jsonb; pub jsonb; src jsonb; ref jsonb; kind text; canonical text; snapshot public.data_snapshots; seen text[]='{}';
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if job.id is null or p_run_generation is null or job.run_generation is distinct from p_run_generation
    or job.status not in ('queued','running') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if p_manifest->>'job_id' is distinct from p_job_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'user_id' is distinct from p_user_id::text or octet_length(p_generation_canonical)>20000000
    or p_generation_canonical is null or p_manifest->>'generation_input_checksum' is distinct from
      'sha256:'||encode(sha256(convert_to(p_generation_canonical,'UTF8')),'hex')
    or jsonb_typeof(p_public_source_canonicals) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>4 then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>4 then
    raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  for src in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=src->>'kind'; canonical=p_public_source_canonicals->>kind;
    if kind is null or kind not in ('site','serp','competitor','public_gbp') or kind=any(seen) or canonical is null
      or src->'payload' is distinct from canonical::jsonb then raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    if ref is null or ref->>'payload_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(canonical,'UTF8')),'hex')
      or src#>>'{payload,schema_version}' is distinct from ref->>'schema_version'
      or (src#>>'{payload,completed_at}')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz then
      raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    insert into public.data_snapshots(id,case_id,source_type,schema_version,fetched_at,expires_at,
      sync_trigger,health_status,health_reasons,normalized_payload,payload_checksum,provider_request_context)
    values((ref->>'snapshot_id')::uuid,p_case_id,case when kind='public_gbp' then 'gbp' else kind end,ref->>'schema_version',
      (ref->>'fetched_at')::timestamptz,(ref->>'expires_at')::timestamptz,'report_generation','healthy',
      coalesce(src#>'{payload,limitations}','[]'::jsonb),src->'payload',ref->>'payload_checksum',
      case when kind='public_gbp' then jsonb_build_object('job_id',p_job_id,
        'customer_public_gbp_reference',pub#>'{evidence_input,context,customer_public_gbp}',
        'subject_reference_checksum',src#>>'{payload,subject_reference_checksum}') else jsonb_build_object('job_id',p_job_id) end)
    on conflict(id) do nothing;
    select * into snapshot from public.data_snapshots where id=(ref->>'snapshot_id')::uuid;
    if snapshot.case_id is distinct from p_case_id or snapshot.payload_checksum is distinct from ref->>'payload_checksum'
      or snapshot.normalized_payload is distinct from src->'payload' then raise exception 'CAPABILITY_SOURCE_CONFLICT'; end if;
  end loop;
  select * into saved from public.freeze_v22_analysis_manifest(p_user_id,p_case_id,p_job_id,p_manifest,p_manifest_canonical,p_previous_canonical);
  if public.hydrate_v22_capability_generation_input(saved.payload,p_recipe) is distinct from full_input then
    raise exception 'CAPABILITY_RECIPE_INPUT_MISMATCH'; end if;
  insert into public.capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe)
    values(saved.id,p_user_id,p_case_id,p_manifest->>'generation_input_checksum',p_recipe) on conflict on constraint capability_generation_recipes_pkey do nothing;
  select * into previous from public.capability_generation_recipes where capability_generation_recipes.manifest_id=saved.id;
  if previous.user_id is distinct from p_user_id or previous.case_id is distinct from p_case_id
    or previous.generation_input_checksum is distinct from p_manifest->>'generation_input_checksum'
    or previous.recipe is distinct from p_recipe then raise exception 'CAPABILITY_RECIPE_CONFLICT' using errcode='40001'; end if;
  return query select saved.id,saved.input_checksum,previous.generation_input_checksum;
end;
$$;

create function public.resolve_v22_capability_analysis_input(p_job_id uuid,p_case_id uuid,p_manifest_id uuid,p_input_checksum text,p_run_generation integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; m public.analysis_input_manifests; recipe public.capability_generation_recipes;
  charge public.workflow_charges; result public.capability_report_versions; ref jsonb; s public.data_snapshots;
  b public.case_source_bindings; previous jsonb; request jsonb;
begin
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for share;
  select * into m from public.analysis_input_manifests where id=p_manifest_id and job_id=p_job_id and case_id=p_case_id;
  if job.id is null or m.id is null or p_run_generation is null or job.run_generation>p_run_generation
    or m.input_checksum is distinct from p_input_checksum or not exists(select 1 from public.client_cases where id=p_case_id and user_id=m.user_id) then
    raise exception 'CAPABILITY_RESOLVER_BINDING_INVALID'; end if;
  if job.status='succeeded' then
    select * into result from public.get_v22_completed_capability_report(m.user_id,p_case_id,p_job_id);
    if result.id is null then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
    return jsonb_build_object('schema_version','v22_capability_resolved_input_v1','manifest',m.payload,
      'run_generation',p_run_generation,'request',null,'previous_report',null,'completed_report',result.payload);
  end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id and user_id=m.user_id and case_id=p_case_id for share;
  if job.status not in ('queued','running') or job.run_generation is distinct from p_run_generation or charge.id is null or charge.state<>'reserved'
    or not exists(select 1 from public.credit_ledger where workflow_charge_id=charge.id and delta=-1 and kind=charge.workflow_kind||'_debit')
    or exists(select 1 from public.credit_ledger where workflow_charge_id=charge.id and kind='technical_failure_credit') then
    raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  select * into recipe from public.capability_generation_recipes where manifest_id=m.id and user_id=m.user_id and case_id=p_case_id;
  if recipe.manifest_id is null or recipe.generation_input_checksum is distinct from m.payload->>'generation_input_checksum' then
    raise exception 'CAPABILITY_RECIPE_NOT_FOUND'; end if;
  for ref in select value from jsonb_array_elements(m.payload->'snapshots') loop
    select * into s from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=p_case_id;
    if s.id is null or s.health_status<>'healthy' or s.expires_at<=now() or s.expires_at is null
      or s.payload_checksum is distinct from ref->>'payload_checksum' or s.schema_version is distinct from ref->>'schema_version'
      or s.binding_id is distinct from (ref->>'binding_id')::uuid then raise exception 'CAPABILITY_SNAPSHOT_INVALID'; end if;
    if s.binding_id is not null then
      select * into b from public.case_source_bindings where id=s.binding_id and case_id=p_case_id;
      if b.id is null or not b.is_active or b.health_status<>'healthy' or b.identity_match_status<>'matched'
        or b.source_type is distinct from s.source_type or not exists(select 1 from public.google_connections where id=b.connection_id and user_id=m.user_id and status='active') then
        raise exception 'CAPABILITY_AUTHORIZATION_INVALID'; end if;
    end if;
  end loop;
  if m.previous_legacy_report_id is not null then select report_v2_2 into previous from public.reports where id=m.previous_legacy_report_id and case_id=p_case_id and user_id=m.user_id and status='paid_full'; end if;
  if m.previous_capability_report_id is not null then select payload into previous from public.get_v22_completed_capability_report(m.user_id,p_case_id,m.previous_capability_report_id); end if;
  if (m.mode='after_acquisition') is distinct from (previous is not null) then raise exception 'CAPABILITY_HISTORY_INVALID'; end if;
  request=public.hydrate_v22_capability_generation_input(m.payload,recipe.recipe);
  return jsonb_build_object('schema_version','v22_capability_resolved_input_v1','manifest',m.payload,
    'run_generation',p_run_generation,'request',request,'previous_report',previous,'completed_report',null);
end;
$$;
revoke all on function public.hydrate_v22_capability_generation_input(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.prepare_v22_capability_analysis_input(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.prepare_v22_capability_analysis_input(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer) to service_role;
revoke all on function public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer) to service_role;

-- Resolve ambiguous completion before Redis declares a terminal failure. A
-- report committed by a fenced earlier generation still wins over a refund.
create function public.finalize_v22_capability_failure(p_job_id uuid,p_case_id uuid,p_manifest_id uuid,p_input_checksum text,
  p_run_generation integer,p_error_code text,p_user_message text,p_attempt_count integer,p_fail boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; m public.analysis_input_manifests; r public.capability_report_versions;
begin
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  select * into m from public.analysis_input_manifests where id=p_manifest_id and job_id=p_job_id and case_id=p_case_id;
  if job.id is null or m.id is null or p_run_generation is null or job.run_generation>p_run_generation
    or m.input_checksum is distinct from p_input_checksum or p_fail is null
    or not exists(select 1 from public.client_cases where id=p_case_id and user_id=m.user_id) then
    raise exception 'CAPABILITY_RESOLVER_BINDING_INVALID'; end if;
  if job.status='succeeded' then
    select * into r from public.get_v22_completed_capability_report(m.user_id,p_case_id,p_job_id);
    if r.id is null then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
    return jsonb_build_object('status','succeeded','completed_report',r.payload);
  end if;
  if job.status<>'failed' and job.run_generation is distinct from p_run_generation then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if job.status not in ('queued','running','failed') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if job.status<>'failed' and p_fail then
    if p_error_code is null or p_error_code !~ '^[A-Z0-9_]{1,120}$' or p_user_message is null
      or length(p_user_message) not between 1 and 500 or p_attempt_count is null or p_attempt_count not between 1 and 10 then
      raise exception 'CAPABILITY_FAILURE_INVALID'; end if;
    perform public.apply_analysis_job_event(p_job_id,p_case_id,job.state_revision+1,'failed','failed',job.progress,
      p_attempt_count,p_error_code,p_user_message,job.cost_counters,now(),now(),p_run_generation,job.deadline_at);
    select * into job from public.analysis_jobs where id=p_job_id;
  end if;
  if job.status='failed' and not exists(select 1 from public.workflow_charges where analysis_job_id=p_job_id
    and user_id=m.user_id and case_id=p_case_id and state='compensated') then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
  return jsonb_build_object('status',case when job.status='failed' then 'failed' else 'active' end,'completed_report',null);
end;
$$;
revoke all on function public.finalize_v22_capability_failure(uuid,uuid,uuid,text,integer,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.finalize_v22_capability_failure(uuid,uuid,uuid,text,integer,text,text,integer,boolean) to service_role;
commit;
