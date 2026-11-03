-- P0-04: additive rendered source; no frozen payload or checksum is rewritten.
-- Existing v1 manifests remain four-source acquisitions. Only v2/v7 uses five.
begin;
alter table public.analysis_manifest_snapshots
  drop constraint analysis_manifest_snapshots_source_kind_check,
  add constraint analysis_manifest_snapshots_source_kind_check
    check(source_kind in ('site','serp','competitor','public_gbp','gsc','ga4','official_gbp','rendered'));
alter table public.capability_report_versions
  drop constraint capability_report_versions_schema_version_check,
  drop constraint capability_report_input_variant,
  add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4')),
  add constraint capability_report_input_variant check(
    (schema_version in ('2.2.2','2.2.4') and manifest_id is not null and review_input_job_id is null)
    or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

create or replace function public.freeze_v22_analysis_manifest(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_manifest jsonb,p_canonical_content text,p_previous_canonical text default null)
returns public.analysis_input_manifests
language plpgsql security definer set search_path = public as $$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  previous_payload jsonb; previous_legacy uuid; previous_capability uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_JOB_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id
    and case_id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CHARGE_NOT_FOUND'; end if;
  select * into saved from public.analysis_input_manifests where job_id=p_job_id;
  if found then
    if saved.payload is distinct from p_manifest then raise exception 'CAPABILITY_INPUT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  if job.status not in ('queued','running') or charge.state <> 'reserved'
    or not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
      and l.case_id=p_case_id and l.delta=-1 and l.kind=charge.workflow_kind||'_debit') then
    raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED';
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or p_manifest->>'ruleset_version' is distinct from 'v22_capability_public_v7')
    or p_manifest->>'schema_version'='v22_analysis_input_v1' and p_manifest->>'ruleset_version'='v22_capability_public_v7'
    then raise exception 'CAPABILITY_RENDER_VERSION_INVALID'; end if;
  if kind not in ('acquisition','after_acquisition','first_service') then
    -- Review needs implementation ownership/qualification added in P5.
    raise exception 'CAPABILITY_MODE_NOT_ENABLED';
  end if;
  if charge.workflow_kind is distinct from (case when kind='acquisition' then 'prospect' else 'verified' end)
    or job.job_type is distinct from (case when kind='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_WORKFLOW_MISMATCH';
  end if;
  evaluation=(p_manifest->>'evaluated_at')::timestamptz;
  if evaluation is null or evaluation>now() or evaluation<now()-interval '5 minutes' then raise exception 'CAPABILITY_EVALUATION_STALE'; end if;
  select * into business from public.case_business_scope_versions where id=(p_manifest#>>'{business,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if not found or business.scope is distinct from p_manifest->'business' then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if (business.scope->>'confirmed_at')::timestamptz > evaluation then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if kind in ('acquisition','first_service') and ((p_manifest->'previous_report') is distinct from 'null'::jsonb or p_previous_canonical is not null) then
    raise exception 'CAPABILITY_INITIAL_HISTORY_FORBIDDEN';
  end if;
  if (p_manifest->'implementation') is distinct from 'null'::jsonb then raise exception 'CAPABILITY_IMPLEMENTATION_UNSUPPORTED'; end if;
  if kind='after_acquisition' then
    select report_v2_2,id into previous_payload,previous_legacy from public.reports
      where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
        and report_type='prospect' and status='paid_full' and version_number=(p_manifest#>>'{previous_report,version}')::integer;
    if not found then
      select payload,id into previous_payload,previous_capability from public.capability_report_versions
        where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
          and payload->>'report_type'='prospect' and (payload->>'version')::integer=(p_manifest#>>'{previous_report,version}')::integer;
    end if;
    if previous_payload is null or p_previous_canonical is null or previous_payload is distinct from p_previous_canonical::jsonb
      or p_manifest#>>'{previous_report,case_id}' is distinct from p_case_id::text
      or p_manifest#>>'{previous_report,report_type}' is distinct from 'prospect'
      or p_manifest#>>'{previous_report,payload_checksum}' is distinct from 'sha256:'||encode(sha256(convert_to(p_previous_canonical,'UTF8')),'hex') then
      raise exception 'CAPABILITY_HISTORY_INVALID';
    end if;
  end if;
  if jsonb_typeof(p_manifest->'snapshots') is distinct from 'array' then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  select array_agg(value->>'source_kind' order by ordinal) into kinds from jsonb_array_elements(p_manifest->'snapshots') with ordinality t(value,ordinal);
  required=case when kind='acquisition' then array['site','serp','competitor','public_gbp'] else array['site','serp','competitor','public_gbp','gsc','ga4'] end;
  if p_manifest->>'schema_version'='v22_analysis_input_v2' then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then 'site_inventory_snapshot_v1' when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then 'customer_public_gbp_snapshot_v1'
      when 'gsc' then 'gsc_sync_v1' when 'ga4' then 'ga4_sync_v1' when 'official_gbp' then 'gbp_sync_v1' end;
    if snapshot.id is null or snapshot.payload_checksum is distinct from source->>'payload_checksum'
      or snapshot.schema_version is distinct from expected_schema or source->>'schema_version' is distinct from expected_schema
      or snapshot.source_type is distinct from (case when source->>'source_kind' in ('public_gbp','official_gbp') then 'gbp' when source->>'source_kind'='rendered' then 'site' else source->>'source_kind' end)
      or source->>'case_id' is distinct from p_case_id::text or snapshot.health_status <> 'healthy'
      or source->>'health' is distinct from 'healthy' or source->>'identity_match' is distinct from 'matched'
      or snapshot.fetched_at is distinct from (source->>'fetched_at')::timestamptz
      or snapshot.expires_at is null or snapshot.expires_at is distinct from (source->>'expires_at')::timestamptz
      or snapshot.fetched_at>evaluation or snapshot.expires_at<=now()
      or snapshot.binding_id is distinct from (source->>'binding_id')::uuid then
      raise exception 'CAPABILITY_SNAPSHOT_INVALID';
    end if;
    if source->>'source_kind'='rendered' and (
      snapshot.normalized_payload->>'source_kind' is distinct from 'rendered'
      or snapshot.normalized_payload->>'root_url' is distinct from p_manifest#>>'{business,site_url}'
      or snapshot.normalized_payload->>'static_payload_checksum' is distinct from
        (select value->>'payload_checksum' from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'='site'))
      then raise exception 'CAPABILITY_RENDER_BINDING_INVALID'; end if;
    if source->>'source_kind'='public_gbp' and (
      snapshot.normalized_payload->>'identity_match_status' is distinct from 'matched'
      or snapshot.normalized_payload->>'health_status' is distinct from 'healthy') then raise exception 'CAPABILITY_GBP_INVALID'; end if;
    if source->>'source_kind' in ('gsc','ga4','official_gbp') then
      select * into binding from public.case_source_bindings where id=snapshot.binding_id and case_id=p_case_id;
      if binding.id is null or not binding.is_active or binding.identity_match_status<>'matched' or binding.health_status<>'healthy'
        or binding.source_type is distinct from snapshot.source_type
        or not exists (select 1 from public.google_connections where id=binding.connection_id and user_id=p_user_id and status='active') then
        raise exception 'CAPABILITY_AUTHORIZATION_INVALID';
      end if;
    elsif snapshot.binding_id is not null then raise exception 'CAPABILITY_PUBLIC_BINDING_INVALID'; end if;
  end loop;
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload,previous_legacy_report_id,previous_capability_report_id)
    values ((p_manifest->>'id')::uuid,p_user_id,p_case_id,p_job_id,business.id,kind,p_manifest->>'input_checksum',p_manifest,previous_legacy,previous_capability) returning * into saved;
  insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind)
    select saved.id,(value->>'snapshot_id')::uuid,value->>'source_kind' from jsonb_array_elements(p_manifest->'snapshots');
  return saved;
end;
$$;

create or replace function public.hydrate_v22_capability_generation_input(p_manifest jsonb,p_recipe jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare body jsonb; pub jsonb; source jsonb; ref jsonb; row public.data_snapshots;
  sources jsonb='[]'; private_sources jsonb='[]'; seen text[]='{}'; kind text; part jsonb;
begin
  if p_recipe->>'schema_version' is distinct from (case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 'v22_generation_recipe_v2' else 'v22_generation_recipe_v1' end)
    or p_recipe-array['schema_version','request']<>'{}'::jsonb or jsonb_typeof(p_recipe->'request') is distinct from 'object'
    or octet_length(p_recipe::text)>250000 then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  body=p_recipe->'request';
  pub=case when p_manifest->>'mode'='acquisition' then body else body->'public_input' end;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array'
    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  for source in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=source->>'kind';
    if kind is null or kind not in ('site','serp','competitor','public_gbp','rendered') or kind=any(seen)
      or source ? 'payload' or (source->'shared_snapshot') ? 'snapshot' then raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    select * into row from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(p_manifest->>'case_id')::uuid;
    if row.id is null or row.payload_checksum is distinct from ref->>'payload_checksum'
      or source#>>'{binding,snapshot_id}' is distinct from ref->>'snapshot_id'
      or source#>>'{binding,case_id}' is distinct from p_manifest->>'case_id'
      or source#>>'{binding,payload_checksum}' is distinct from ref->>'payload_checksum'
      or source#>>'{binding,schema_version}' is distinct from ref->>'schema_version'
      or source#>>'{binding,source_type}' is distinct from (case when kind='public_gbp' then 'gbp' when kind='rendered' then 'site' else kind end)
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

create or replace function public.prepare_v22_capability_analysis_input_core(p_user_id uuid,p_case_id uuid,p_job_id uuid,
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
    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then
    raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  for src in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=src->>'kind'; canonical=p_public_source_canonicals->>kind;
    if kind is null or kind not in ('site','serp','competitor','public_gbp','rendered') or kind=any(seen) or canonical is null
      or src->'payload' is distinct from canonical::jsonb then raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    if ref is null or ref->>'payload_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(canonical,'UTF8')),'hex')
      or src#>>'{payload,schema_version}' is distinct from ref->>'schema_version'
      or (src#>>'{payload,completed_at}')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz then
      raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    insert into public.data_snapshots(id,case_id,source_type,schema_version,fetched_at,expires_at,
      sync_trigger,health_status,health_reasons,normalized_payload,payload_checksum,provider_request_context)
    values((ref->>'snapshot_id')::uuid,p_case_id,case when kind='public_gbp' then 'gbp' when kind='rendered' then 'site' else kind end,ref->>'schema_version',
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

create or replace function public.store_v22_capability_report(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_payload jsonb,p_canonical_content text,p_run_generation integer default 1)
returns public.capability_report_versions
language plpgsql security definer set search_path=public as $$
declare manifest public.analysis_input_manifests; saved public.capability_report_versions; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into manifest from public.analysis_input_manifests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if not found then raise exception 'CAPABILITY_MANIFEST_NOT_FOUND'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex');
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_canonical_content)>2000000
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'schema_version'='v22_analysis_input_v2' then '2.2.4' else '2.2.2' end)
    or p_payload->>'id' is distinct from p_job_id::text or p_payload->'input_manifest' is distinct from manifest.payload
    or p_payload->>'report_type' is distinct from (case when manifest.mode='acquisition' then 'prospect' else 'verified_execution' end)
    or p_payload->>'settlement_policy' is distinct from 'one_credit_per_completed_analysis'
    or coalesce(p_payload->>'action_state','') not in ('actions_supported','insufficient_basis')
    or jsonb_typeof(p_payload->'actions') is distinct from 'array' or jsonb_array_length(p_payload->'actions')>3
    or ((jsonb_array_length(p_payload->'actions')>0) is distinct from (p_payload->>'action_state'='actions_supported')) then
    raise exception 'CAPABILITY_REPORT_INVALID';
  end if;
  select * into saved from public.capability_report_versions where id=p_job_id;
  if found then
    if saved.payload is distinct from p_payload then raise exception 'CAPABILITY_REPORT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  perform 1 from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not exists (select 1 from public.analysis_jobs j join public.workflow_charges c on c.analysis_job_id=j.id
    where j.id=p_job_id and j.case_id=p_case_id and j.status in ('queued','running') and j.run_generation=p_run_generation
      and c.user_id=p_user_id and c.case_id=p_case_id and c.state='reserved') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(p_job_id,manifest.id,p_user_id,p_case_id,p_payload->>'schema_version',checksum,p_payload) returning * into saved;
  return saved;
end;
$$;

create or replace function public.get_v22_capability_dispatch(
  p_user_id uuid, p_case_id uuid, p_job_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  job public.analysis_jobs;
  m public.analysis_input_manifests;
  r public.capability_report_versions;
  envelope jsonb;
  completion jsonb := null;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for share;
  select * into m from public.analysis_input_manifests
    where job_id=p_job_id and case_id=p_case_id and user_id=p_user_id;
  if job.id is null or m.id is null or job.idempotency_key is distinct from p_idempotency_key
    or job.status not in ('queued','running','succeeded')
    or job.report_id is not null or m.payload->>'mode'='review'
    or job.job_type is distinct from (case when m.payload->>'mode'='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE';
  end if;
  envelope := jsonb_build_object(
    'schema_version','v22_capability_request_envelope_v1',
    'capability_request',jsonb_build_object('case_id',p_case_id,'manifest_id',m.id,
      'input_checksum',m.input_checksum,'report_type',
      case when m.payload->>'mode'='acquisition' then 'prospect' else 'verified_execution' end));
  if job.status='succeeded' then
    select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_job_id);
    if r.id is null then raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE'; end if;
    completion := jsonb_build_object(
      'schema_version','v22_capability_task_status_v1','job_id',job.id,
      'revision',greatest(job.state_revision,1),'run_generation',job.run_generation,
      'status','succeeded','stage','completed','progress',100,'message','Analysis complete.',
      'report_reference',jsonb_build_object('report_id',r.id,'case_id',p_case_id,
        'schema_version',r.schema_version,'report_type',r.payload->>'report_type','payload_checksum',r.payload_checksum),
      'created_at',job.created_at,'deadline_at',job.deadline_at,'updated_at',job.completed_at);
  else
    if job.deadline_at<=now() then raise exception 'CAPABILITY_DISPATCH_EXPIRED'; end if;
    -- Reuse the authoritative source/charge/recipe gate without returning bodies.
    perform public.resolve_v22_capability_analysis_input(job.id,p_case_id,m.id,m.input_checksum,job.run_generation);
  end if;
  return jsonb_build_object(
    'schema_version','v22_capability_dispatch_v1','user_id',p_user_id,'job_id',job.id,
    'case_id',p_case_id,'idempotency_key',job.idempotency_key,'request',envelope,
    'run_generation',job.run_generation,'status',job.status,
    'revision',greatest(job.state_revision,1),'attempt_count',job.attempt_count,
    'cost_counters',job.cost_counters,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'completion',completion);
end;
$$;

create or replace function public.list_v22_completed_capability_reports(p_user_id uuid)
returns table(id uuid,user_id uuid,case_id uuid,business_name text,site_url text,market text,service text,
  report_type text,version integer,generated_at timestamptz,delivery_revision integer,delivery_status text)
language sql stable security definer set search_path=public as $$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4')
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$$;
commit;
