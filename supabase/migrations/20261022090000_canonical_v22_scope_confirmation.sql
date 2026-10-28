begin;

-- Scope is part of the sealed capability manifest: serialize the UTC instant,
-- not the database session's timestamp rendering. Do not rewrite saved scopes.
create or replace function public.start_v22_acquisition_intake(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_job_id uuid,p_idempotency_key text,p_discovery_id uuid,p_request_canonical text,p_previous_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare body jsonb; req jsonb; existing jsonb; current_revision integer; scope jsonb; scope_id uuid;
begin
  if p_request_canonical is null or octet_length(p_request_canonical)>150000
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception 'CAPABILITY_INTAKE_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'analyze_request';
  if req->>'report_type' is distinct from 'prospect' or req->>'case_id' is distinct from p_case_id::text
    or body#>>'{competitor_discovery,discovery_id}' is distinct from p_discovery_id::text then
    raise exception 'CAPABILITY_INTAKE_INVALID'; end if;
  existing=public.lookup_v22_acquisition_intake(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_discovery_id,req,p_previous_job_id);
  if existing is not null then
    -- Do not accept different discovery checksums on an already enrolled job.
    if existing->'request' is distinct from body then raise exception 'CAPABILITY_INTAKE_CONFLICT' using errcode='40001'; end if;
    return existing;
  end if;
  select coalesce(max(revision),0) into current_revision from public.case_business_scope_versions where case_id=p_case_id;
  scope_id=gen_random_uuid();
  scope=jsonb_build_object('id',scope_id,'user_id',p_user_id,'case_id',p_case_id,'revision',current_revision+1,
    'site_url',req#>>'{business_identity,site_url}','primary_service',req->>'primary_service',
    'target_market',req#>>'{target_market,display_name}','target_pages','[]'::jsonb,
    'competitor_sites',(select jsonb_agg(value->>'website_url' order by ordinal) from jsonb_array_elements(req->'competitors') with ordinality c(value,ordinal)),
    'priority',null,'confirmation_source','seo_confirmation','confirmed_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  perform public.save_v22_business_scope(p_user_id,p_case_id,current_revision,scope);
  perform public.bind_v22_prospect_analysis(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_previous_job_id);
  perform public.begin_v22_acquisition_preparation(p_user_id,p_case_id,p_job_id,p_idempotency_key,scope_id,p_request_canonical);
  return public.lookup_v22_acquisition_intake(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_discovery_id,req,p_previous_job_id);
end;
$$;

create or replace function public.confirm_v22_first_service_entry(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_discovery_job_id uuid,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid,p_request_canonical text)
returns void language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; c public.workflow_charges; d public.capability_first_service_discoveries;
  saved public.capability_first_service_collections; prep public.capability_first_service_preparations;
  ids uuid[]; current_ids uuid[]; body jsonb; req jsonb; scope_id uuid; revision integer; scope jsonb;
begin
  if p_request_canonical is null or octet_length(p_request_canonical)>150000 then raise exception 'FIRST_SERVICE_COLLECTION_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'collection_request';
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}') into ids
    from public.case_source_bindings b join public.client_cases own on own.id=b.case_id
    where own.id=p_case_id and own.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=p_user_id order by id for share;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null or d.discovery_job_id is distinct from p_discovery_job_id then
    raise exception 'FIRST_SERVICE_CONTINUATION_CONFLICT' using errcode='40001'; end if;
  select * into saved from public.capability_first_service_collections where job_id=c.analysis_job_id;
  if saved.job_id is not null then
    select * into prep from public.capability_first_service_preparations where job_id=saved.job_id;
    if saved.request is distinct from body or saved.request_canonical is distinct from p_request_canonical
      or prep.gsc_snapshot_id is distinct from p_gsc_snapshot_id or prep.ga4_snapshot_id is distinct from p_ga4_snapshot_id then
      raise exception 'FIRST_SERVICE_CONTINUATION_CONFLICT' using errcode='40001'; end if;
    return;
  end if;
  if c.state<>'reserved' or c.analysis_job_id is not null or d.result is null then raise exception 'FIRST_SERVICE_DISCOVERY_CLOSED'; end if;
  select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}') into current_ids
    from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
  if current_ids is distinct from ids then raise exception 'FIRST_SERVICE_BINDING_CHANGED' using errcode='40001'; end if;
  if req->>'case_id' is distinct from p_case_id::text or jsonb_typeof(req->'competitors') is distinct from 'array'
    or jsonb_array_length(req->'competitors') not between 1 and 3
    or exists(select 1 from jsonb_array_elements(req->'competitors') v where not exists(
      select 1 from jsonb_array_elements(d.result->'candidates') candidate where
        v=jsonb_build_object('competitor_id',candidate->'competitor_id','business_name',candidate->'business_name',
          'website_url',candidate->'website_url','public_gbp_url',candidate->'public_gbp_url','confirmation_source','user')))
    or (select count(distinct v->>'website_url') from jsonb_array_elements(req->'competitors') v)<>jsonb_array_length(req->'competitors')
    then raise exception 'FIRST_SERVICE_DISCOVERY_SELECTION_INVALID'; end if;
  select coalesce(max(v.revision),0) into revision from public.case_business_scope_versions v where v.case_id=p_case_id;
  scope_id=gen_random_uuid();
  scope=jsonb_build_object('id',scope_id,'user_id',p_user_id,'case_id',p_case_id,'revision',revision+1,
    'site_url',cc.site_url,'primary_service',cc.primary_service,'target_market',cc.target_market->>'display_name',
    'target_pages','[]'::jsonb,'competitor_sites',(select jsonb_agg(v->>'website_url' order by ord) from jsonb_array_elements(req->'competitors') with ordinality x(v,ord)),
    'priority',null,'confirmation_source','seo_confirmation','confirmed_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  perform public.save_v22_business_scope(p_user_id,p_case_id,revision,scope);
  perform public.start_v22_first_service_preparation(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_gsc_snapshot_id,p_ga4_snapshot_id);
  perform public.begin_v22_first_service_collection(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_request_canonical);
end; $$;

commit;
