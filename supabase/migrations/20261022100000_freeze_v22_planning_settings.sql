begin;

-- Immutable optional settings; no client role can read/write another Case.
create table public.case_planning_settings (
  case_id uuid not null references public.client_cases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  revision integer not null check(revision>0),
  settings jsonb not null,
  created_at timestamptz not null default now(),
  primary key(case_id,revision)
);
alter table public.case_planning_settings enable row level security;
revoke all on public.case_planning_settings from public,anon,authenticated,service_role;
grant select on public.case_planning_settings to service_role;
create trigger immutable_planning_version before update or delete on public.case_planning_settings
  for each row execute function public.reject_v22_capability_mutation();

create function public.get_v22_case_planning_settings(p_user_id uuid,p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare cc public.client_cases; saved public.case_planning_settings;
begin
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if cc.id is null then raise exception 'PLANNING_CASE_NOT_FOUND'; end if;
  select * into saved from public.case_planning_settings where case_id=p_case_id and user_id=p_user_id order by revision desc limit 1;
  return jsonb_build_object('caseId',p_case_id,'siteUrl',cc.site_url,'revision',coalesce(saved.revision,0),
    'settings',coalesce(saved.settings,'{"schema_version":"v22_planning_settings_v1","priority":null,"target_pages":[],"execution_conditions":{"capacity":"unknown","publishing_access":"unknown"}}'::jsonb));
end; $$;

create function public.save_v22_case_planning_settings(p_user_id uuid,p_case_id uuid,p_expected_revision integer,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; saved public.case_planning_settings; page jsonb; host text; page_host text;
begin
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'PLANNING_CASE_NOT_FOUND'; end if;
  if p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_settings) is distinct from 'object'
    or octet_length(p_settings::text)>50000
    or p_settings-array['schema_version','priority','target_pages','execution_conditions']<>'{}'::jsonb
    or not(p_settings ?& array['schema_version','priority','target_pages','execution_conditions'])
    or p_settings->>'schema_version' is distinct from 'v22_planning_settings_v1'
    or (p_settings->'priority' is distinct from 'null'::jsonb and coalesce(p_settings->>'priority','') not in ('service_visibility','contact_path','business_identity'))
    or jsonb_typeof(p_settings->'target_pages') is distinct from 'array'
    or jsonb_typeof(p_settings->'execution_conditions') is distinct from 'object'
    or (p_settings->'execution_conditions')-array['capacity','publishing_access']<>'{}'::jsonb
    or coalesce(p_settings#>>'{execution_conditions,capacity}','') not in ('unknown','limited','available')
    or coalesce(p_settings#>>'{execution_conditions,publishing_access}','') not in ('unknown','needs_approval','available')
    then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
  if jsonb_array_length(p_settings->'target_pages')>20
    or (select count(distinct value) from jsonb_array_elements(p_settings->'target_pages'))<>jsonb_array_length(p_settings->'target_pages')
    then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
  host=lower((regexp_match(cc.site_url,'^https?://(?:www\.)?([^/:?#@]+)(?::[0-9]+)?(?:[/?#]|$)','i'))[1]);
  for page in select value from jsonb_array_elements(p_settings->'target_pages') loop
    if jsonb_typeof(page) is distinct from 'string' or length(page#>>'{}') not between 1 and 2000
      or (page#>>'{}') ~ '[[:space:]#\\]' or (page#>>'{}') !~ '^https?://[^/?#@]+/'
      then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
    page_host=lower((regexp_match(page#>>'{}','^https?://(?:www\.)?([^/:?#@]+)(?::[0-9]+)?(?:[/?#]|$)','i'))[1]);
    if host is null or page_host is null or page_host is distinct from host then raise exception 'PLANNING_SETTINGS_INVALID'; end if;
  end loop;
  select * into saved from public.case_planning_settings where case_id=p_case_id order by revision desc limit 1;
  -- Lost save responses may recover only the exact next version, never overwrite.
  if saved.revision is not null and saved.settings=p_settings
    and p_expected_revision in (saved.revision,saved.revision-1) then
    return public.get_v22_case_planning_settings(p_user_id,p_case_id);
  end if;
  if coalesce(saved.revision,0)<>p_expected_revision then raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'; end if;
  insert into public.case_planning_settings(case_id,user_id,revision,settings) values(p_case_id,p_user_id,p_expected_revision+1,p_settings);
  return public.get_v22_case_planning_settings(p_user_id,p_case_id);
end; $$;

-- Caller already holds the Case lock. Preserve old scopes when no settings exist.
create function public.apply_v22_case_planning(p_user_id uuid,p_case_id uuid,p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved jsonb;
begin
  saved=public.get_v22_case_planning_settings(p_user_id,p_case_id);
  if (saved->>'revision')::integer=0 then return p_scope; end if;
  return p_scope||jsonb_build_object('priority',saved#>'{settings,priority}','target_pages',saved#>'{settings,target_pages}',
    'execution_conditions',saved#>'{settings,execution_conditions}');
end; $$;


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
  scope=public.apply_v22_case_planning(p_user_id,p_case_id,scope);
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
  scope=public.apply_v22_case_planning(p_user_id,p_case_id,scope);
  perform public.save_v22_business_scope(p_user_id,p_case_id,revision,scope);
  perform public.start_v22_first_service_preparation(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_gsc_snapshot_id,p_ga4_snapshot_id);
  perform public.begin_v22_first_service_collection(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_request_canonical);
end; $$;

-- CAS and freeze share one Case lock. Replays recover the enrolled task first.
create function public.start_v22_acquisition_intake_with_planning(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_job_id uuid,p_idempotency_key text,p_discovery_id uuid,p_request_canonical text,p_previous_job_id uuid,p_planning_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved jsonb;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'PLANNING_CASE_NOT_FOUND'; end if;
  if not exists(select 1 from public.capability_acquisition_preparations where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id) then
    saved=public.get_v22_case_planning_settings(p_user_id,p_case_id);
    if p_planning_revision is null or (saved->>'revision')::integer<>p_planning_revision
      then raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'; end if;
  end if;
  return public.start_v22_acquisition_intake(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_discovery_id,p_request_canonical,p_previous_job_id);
end; $$;

create function public.confirm_v22_first_service_entry_with_planning(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_discovery_job_id uuid,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid,p_request_canonical text,p_planning_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare ids uuid[]; saved jsonb;
begin
  -- Keep the core's connection -> Case -> charge lock order.
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}') into ids
    from public.case_source_bindings b join public.client_cases own on own.id=b.case_id
    where own.id=p_case_id and own.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=p_user_id order by id for share;
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'PLANNING_CASE_NOT_FOUND'; end if;
  if not exists(select 1 from public.capability_first_service_collections where job_id=p_workflow_id and user_id=p_user_id and case_id=p_case_id) then
    saved=public.get_v22_case_planning_settings(p_user_id,p_case_id);
    if p_planning_revision is null or (saved->>'revision')::integer<>p_planning_revision
      then raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'; end if;
  end if;
  perform public.confirm_v22_first_service_entry(p_user_id,p_case_id,p_workflow_id,p_discovery_job_id,p_gsc_snapshot_id,p_ga4_snapshot_id,p_request_canonical);
end; $$;

create function public.enforce_v22_delivery_prerequisites()
returns trigger language plpgsql security definer set search_path=public as $$
declare report public.capability_report_versions; item jsonb; entry jsonb; source_action jsonb; dependency jsonb;
  seen text[]='{}'; layer integer=-1; current_layer integer;
begin
  select * into report from public.capability_report_versions where id=new.report_id and case_id=new.case_id and user_id=new.user_id;
  if report.payload#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v2' then return new; end if;
  for item in select value from jsonb_array_elements(new.content->'actions') loop
    select value into entry from jsonb_array_elements(report.payload#>'{prioritization,candidates}')
      where value#>>'{input,action_id}'=item->>'id';
    select value into source_action from jsonb_array_elements(report.payload->'actions') where value->>'id'=item->>'id';
    current_layer=case entry->>'prerequisite' when 'access_indexing' then 0 when 'measurement' then 1 when 'none' then 2 else null end;
    if current_layer is null or current_layer<layer or source_action is null then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    for dependency in select value from jsonb_array_elements(source_action->'dependencies') loop
      if not((dependency#>>'{}')=any(seen)) then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    end loop;
    seen=array_append(seen,item->>'id');layer=current_layer;
  end loop;
  return new;
end; $$;
create trigger delivery_prerequisites before insert on public.report_content_revisions
  for each row execute function public.enforce_v22_delivery_prerequisites();

revoke all on function public.get_v22_case_planning_settings(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_v22_case_planning_settings(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.apply_v22_case_planning(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.start_v22_acquisition_intake_with_planning(uuid,uuid,uuid,uuid,text,uuid,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.confirm_v22_first_service_entry_with_planning(uuid,uuid,uuid,uuid,uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.enforce_v22_delivery_prerequisites() from public,anon,authenticated,service_role;
grant execute on function public.get_v22_case_planning_settings(uuid,uuid) to service_role;
grant execute on function public.save_v22_case_planning_settings(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.start_v22_acquisition_intake_with_planning(uuid,uuid,uuid,uuid,text,uuid,text,uuid,integer) to service_role;
grant execute on function public.confirm_v22_first_service_entry_with_planning(uuid,uuid,uuid,uuid,uuid,uuid,text,integer) to service_role;
commit;

