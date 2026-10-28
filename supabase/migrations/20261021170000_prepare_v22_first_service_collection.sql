-- Internal source collection intent for an already reserved first-service task.
begin;
create table public.capability_first_service_collections (
  job_id uuid primary key references public.capability_first_service_preparations(job_id),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  business_version_id uuid not null references public.case_business_scope_versions(id),
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=150000),
  request_canonical text not null check(octet_length(request_canonical)<=150000),
  request_checksum text not null check(request_checksum ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.capability_first_service_collections enable row level security;
revoke all on public.capability_first_service_collections from public,anon,authenticated,service_role;
grant select on public.capability_first_service_collections to service_role;
create trigger immutable_first_service_collection before update or delete on public.capability_first_service_collections
for each row execute function public.reject_v22_capability_mutation();

create function public.begin_v22_first_service_collection(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_idempotency_key text,p_business_version_id uuid,p_request_canonical text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; prep public.capability_first_service_preparations;
  saved public.capability_first_service_collections; business jsonb; body jsonb; req jsonb; checksum text;
  dispatch jsonb=null; snapshots jsonb='[]'; ref jsonb; s public.data_snapshots;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'FIRST_SERVICE_PREPARATION_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  select * into prep from public.capability_first_service_preparations where job_id=p_job_id;
  if job.id is null or job.idempotency_key is distinct from p_idempotency_key or job.job_type<>'verified_report'
    or job.status not in ('queued','running','succeeded') or job.report_id is not null
    or prep.job_id is null or prep.user_id<>p_user_id or prep.case_id<>p_case_id
    or prep.business_version_id is distinct from p_business_version_id then raise exception 'FIRST_SERVICE_PREPARATION_UNAVAILABLE'; end if;
  select scope into business from public.case_business_scope_versions where id=prep.business_version_id;
  if p_request_canonical is null or octet_length(p_request_canonical)>150000 then raise exception 'FIRST_SERVICE_COLLECTION_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'collection_request';
  if body->>'schema_version' is distinct from 'v22_first_service_collection_v1'
    or body-array['schema_version','collection_request','competitor_discovery']<>'{}'::jsonb
    or jsonb_typeof(body->'competitor_discovery') is distinct from 'object'
    or jsonb_typeof(req) is distinct from 'object'
    or req-array['case_id','business_identity','primary_service','target_market','queries','competitors','generation_limits']<>'{}'::jsonb
    or req->>'case_id' is distinct from p_case_id::text or req->'business_identity' is distinct from prep.business_identity
    or req->>'primary_service' is distinct from business->>'primary_service'
    or req#>>'{target_market,display_name}' is distinct from business->>'target_market'
    or jsonb_typeof(req->'queries') is distinct from 'array' or jsonb_array_length(req->'queries') not between 3 and 5
    or jsonb_typeof(req->'competitors') is distinct from 'array' or jsonb_array_length(req->'competitors') not between 1 and 3 then
    raise exception 'FIRST_SERVICE_COLLECTION_INVALID'; end if;
  if (select jsonb_agg(value->>'website_url' order by value->>'website_url') from jsonb_array_elements(req->'competitors'))
    is distinct from (select jsonb_agg(value order by value) from jsonb_array_elements(business->'competitor_sites')) then
    raise exception 'FIRST_SERVICE_COLLECTION_INVALID'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_request_canonical,'UTF8')),'hex');
  select * into saved from public.capability_first_service_collections where job_id=p_job_id;
  if saved.job_id is not null then
    if saved.request is distinct from body or saved.request_checksum is distinct from checksum then
      raise exception 'FIRST_SERVICE_COLLECTION_CONFLICT' using errcode='40001'; end if;
  elsif job.status<>'queued' or job.attempt_count<>0 or job.capability_report_id is not null
    or exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
    raise exception 'FIRST_SERVICE_PREPARATION_UNAVAILABLE'; end if;
  if job.status<>'succeeded' then
    if job.deadline_at<=clock_timestamp() then raise exception 'FIRST_SERVICE_PREPARATION_EXPIRED'; end if;
    if not exists(select 1 from public.workflow_charges c where c.analysis_job_id=p_job_id and c.user_id=p_user_id
      and c.case_id=p_case_id and c.workflow_kind='verified' and c.state='reserved'
      and exists(select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.delta=-1 and l.kind='verified_debit')) then
      raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED'; end if;
    if prep.business_identity is distinct from (select business_identity from public.client_cases where id=p_case_id) then
      raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    for ref in select value from jsonb_array_elements(prep.source_refs) loop
      if public.check_v22_first_service_source(p_user_id,p_case_id,(ref->>'snapshot_id')::uuid,ref->>'source_kind') is distinct from ref then
        raise exception 'FIRST_SERVICE_PREPARATION_CONFLICT'; end if;
    end loop;
  end if;
  if saved.job_id is null then
    insert into public.capability_first_service_collections(job_id,user_id,case_id,business_version_id,request,request_canonical,request_checksum)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,body,p_request_canonical,checksum);
  end if;
  if exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
    dispatch=public.get_v22_capability_dispatch(p_user_id,p_case_id,p_job_id,p_idempotency_key);
  elsif job.status='succeeded' then raise exception 'FIRST_SERVICE_PREPARATION_UNAVAILABLE';
  else
    for ref in select value from jsonb_array_elements(prep.source_refs) loop
      select * into s from public.data_snapshots where id=(ref->>'snapshot_id')::uuid;
      snapshots=snapshots||jsonb_build_array(jsonb_build_object('snapshot_id',s.id,'case_id',s.case_id,'binding_id',s.binding_id,
        'source_type',s.source_type,'schema_version',s.schema_version,'fetched_at',s.fetched_at,'expires_at',s.expires_at,
        'identity_match_status','matched','health_status',s.health_status,'health_reasons',s.health_reasons,
        'normalized_payload',s.normalized_payload,'raw_payload',null,'payload_checksum',s.payload_checksum,
        'external_resource_id',s.provider_request_context->>'external_resource_id','coverage_start',s.coverage_start,'coverage_end',s.coverage_end));
    end loop;
  end if;
  return jsonb_build_object('schema_version','v22_first_service_collection_preparation_v1','user_id',p_user_id,
    'case_id',p_case_id,'job_id',p_job_id,'idempotency_key',p_idempotency_key,'business',business,'request_checksum',checksum,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'run_generation',job.run_generation,
    'cost_counters',job.cost_counters,'snapshots',snapshots,'dispatch',dispatch);
end;
$$;
revoke all on function public.begin_v22_first_service_collection(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_v22_first_service_collection(uuid,uuid,uuid,text,uuid,text) to service_role;

create function public.check_v22_first_service_collection_recipe() returns trigger
language plpgsql set search_path=public as $$
declare saved public.capability_first_service_collections; req jsonb; pub jsonb;
begin
  select c.* into saved from public.capability_first_service_collections c join public.analysis_input_manifests m on m.job_id=c.job_id where m.id=new.manifest_id;
  if saved.job_id is null then return new; end if;
  req=saved.request->'collection_request'; pub=new.recipe#>'{request,public_input}';
  if pub->'business_identity' is distinct from req->'business_identity'
    or pub#>'{evidence_input,context,queries}' is distinct from req->'queries'
    or pub#>'{evidence_input,context,target_market}' is distinct from req->'target_market'
    or pub#>'{evidence_input,context,competitors}' is distinct from req->'competitors' then
    raise exception 'FIRST_SERVICE_COLLECTION_CONFLICT'; end if;
  return new;
end;
$$;
revoke all on function public.check_v22_first_service_collection_recipe() from public,anon,authenticated,service_role;
create trigger check_first_service_collection_recipe before insert on public.capability_generation_recipes
for each row execute function public.check_v22_first_service_collection_recipe();
commit;
