begin;

-- Bounded current-plan source. Original report rows/checksums are never changed.
create function public.v22_review_plan_basis(p jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare b jsonb;
begin
  if p->>'schema_version'='2.2.2' then return p; end if;
  if p->>'schema_version' is distinct from '2.2.3' or p->>'checksum' is distinct from public.v22_review_hash(p-'checksum')
    then raise exception 'REVIEW_INVALID'; end if;
  b=jsonb_build_object('schema_version','v22_review_plan_basis_v1','source_schema_version','2.2.3',
    'id',p->'id','report_type',p->'report_type','version',p->'version','generated_at',p->'generated_at',
    'business',p->'business','title',p->'title','summary',p->'summary','action_state',p->'action_state',
    'actions',p->'actions','limitations',p->'limitations','prior_diagnosis',p#>'{content,prior_diagnosis}',
    'source_checksum',public.v22_review_hash(p));
  return b||jsonb_build_object('checksum',public.v22_review_hash(b));
end; $$;

-- Internal plan consumers only. This row's payload is a plan basis for 2.2.3;
-- payload_checksum still identifies the ORIGINAL complete report. Legacy PDF,
-- share and report readers keep their original version checks.
create function public.get_v22_completed_plan_source(p_user_id uuid,p_case_id uuid,p_report_id uuid)
returns setof public.capability_report_versions language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; full_report jsonb;
begin
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null then return; end if;
  if r.schema_version='2.2.2' then
    return query select * from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  elsif r.schema_version='2.2.3' then
    full_report=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
    if full_report is null or full_report->'report' is distinct from r.payload
      or full_report->>'payload_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
    r.payload=public.v22_review_plan_basis(r.payload);
    return next r;
  end if;
end; $$;
revoke all on function public.v22_review_plan_basis(jsonb),public.get_v22_completed_plan_source(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.v22_implementation_source(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.capability_report_versions; d public.report_content_revisions;
begin
  select * into r from public.get_v22_completed_plan_source(p_user_id,p_case_id,p_report_id);
  select * into d from public.report_content_revisions where id=p_delivery_revision_id
    and user_id=p_user_id and case_id=p_case_id and report_id=p_report_id and status='approved';
  if r.id is null or r.payload->>'report_type' is distinct from 'verified_execution' or d.id is null
    or d.content->>'source_checksum' is distinct from r.payload_checksum then raise exception 'IMPLEMENTATION_SOURCE_NOT_FOUND'; end if;
  return jsonb_build_object('report_checksum',r.payload_checksum,'generated_at',r.payload->>'generated_at','delivery_revision',d.revision,'actions',d.content->'actions');
end; $$;

create or replace function public.get_v22_review_workspace_basis(p_user_id uuid,p_case_id uuid,p_report_id uuid,
  p_delivery_id uuid,p_implementation_id uuid,p_implementation_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; d public.report_content_revisions;
  i public.capability_implementation_records; choices jsonb;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_plan_source(p_user_id,p_case_id,p_report_id);
  select * into d from public.report_content_revisions where id=p_delivery_id and user_id=p_user_id
    and case_id=p_case_id and report_id=p_report_id and status='approved';
  select * into i from public.capability_implementation_records where id=p_implementation_id and revision=p_implementation_revision
    and user_id=p_user_id and case_id=p_case_id and report_id=p_report_id and delivery_revision_id=p_delivery_id;
  if r.id is null or d.id is null or i.id is null or r.payload->>'report_type' is distinct from 'verified_execution'
    or d.content->>'source_checksum' is distinct from r.payload_checksum
    or i.payload->>'report_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('action_id',a->>'id','page_current_id',null,'page_previous_id',null,
    'gsc_id',null,'ga4_id',null) order by n),'[]') into choices
    from jsonb_array_elements(d.content->'actions') with ordinality as t(a,n);
  return jsonb_build_object('report',jsonb_build_object('id',r.id,'checksum',r.payload_checksum),
    'delivery',jsonb_build_object('id',d.id,'revision',d.revision,'checksum',public.v22_review_hash(d.content)),
    'implementation',jsonb_build_object('id',i.id,'revision',i.revision,'checksum',i.checksum),'actions',choices);
end; $$;

create or replace function public.list_v22_review_workspace(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_kind text,
  p_delivery_id uuid default null,p_implementation_id uuid default null,p_implementation_revision integer default null,
  p_action_id text default null,p_cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; basis jsonb; result jsonb; next_cursor jsonb;
  cut_at timestamptz; cut_id uuid; cut_revision integer;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_plan_source(p_user_id,p_case_id,p_report_id);
  if r.id is null or r.payload->>'report_type' is distinct from 'verified_execution' then raise exception 'REVIEW_UNAVAILABLE'; end if;
  if p_kind is null or p_kind not in ('deliveries','implementations','history','page','gsc','ga4') then raise exception 'REVIEW_INVALID'; end if;
  if p_cursor is not null then
    if not public.v22_page_keys(p_cursor,array['at','id','revision']) or octet_length(p_cursor::text)>256
      or jsonb_typeof(p_cursor->'at') is distinct from 'string' or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or jsonb_typeof(p_cursor->'revision') is distinct from 'number' or p_cursor->>'revision' !~ '^(0|[1-9][0-9]*)$'
      then raise exception 'REVIEW_INVALID'; end if;
    cut_at=(p_cursor->>'at')::timestamptz; cut_id=(p_cursor->>'id')::uuid; cut_revision=(p_cursor->>'revision')::integer;
    if not isfinite(cut_at) then raise exception 'REVIEW_INVALID'; end if;
  end if;
  if p_kind in ('deliveries','history') then
    if num_nonnulls(p_delivery_id,p_implementation_id,p_implementation_revision,p_action_id)<>0 then raise exception 'REVIEW_INVALID'; end if;
  elsif p_kind='implementations' then
    if p_delivery_id is null or num_nonnulls(p_implementation_id,p_implementation_revision,p_action_id)<>0 then raise exception 'REVIEW_INVALID'; end if;
    if not exists(select 1 from public.report_content_revisions d where d.id=p_delivery_id and d.user_id=p_user_id
      and d.case_id=p_case_id and d.report_id=p_report_id and d.status='approved' and d.content->>'source_checksum'=r.payload_checksum)
      then raise exception 'REVIEW_UNAVAILABLE'; end if;
  else
    if num_nonnulls(p_delivery_id,p_implementation_id,p_implementation_revision,p_action_id)<>4 then raise exception 'REVIEW_INVALID'; end if;
    basis=public.get_v22_review_workspace_basis(p_user_id,p_case_id,p_report_id,p_delivery_id,p_implementation_id,p_implementation_revision);
    if not exists(select 1 from jsonb_array_elements(basis->'actions') a where a->>'action_id'=p_action_id)
      then raise exception 'REVIEW_UNAVAILABLE'; end if;
  end if;
  with candidates as (
    select d.id,d.revision,d.approved_at as at,d.id as delivery_id,d.revision as delivery_revision
      from public.report_content_revisions d where p_kind='deliveries' and d.user_id=p_user_id and d.case_id=p_case_id
      and d.report_id=p_report_id and d.status='approved' and d.content->>'source_checksum'=r.payload_checksum
    union all
    select i.id,i.revision,i.recorded_at,i.delivery_revision_id,(i.payload->>'delivery_revision')::integer
      from public.capability_implementation_records i where p_kind='implementations' and i.user_id=p_user_id and i.case_id=p_case_id
      and i.report_id=p_report_id and i.delivery_revision_id=p_delivery_id and i.payload->>'report_checksum'=r.payload_checksum
    union all
    select s.id,0,s.frozen_at,s.delivery_id,s.delivery_revision from public.capability_review_evidence_bundles s
      where p_kind='history' and s.user_id=p_user_id and s.case_id=p_case_id and s.report_id=p_report_id
    union all
    select j.id,0,j.completed_at,j.delivery_revision_id,(basis#>>'{delivery,revision}')::integer
      from public.capability_page_check_jobs j join public.capability_page_observations o on o.id=j.id
      where p_kind='page' and j.user_id=p_user_id and j.case_id=p_case_id and j.report_id=p_report_id
      and j.delivery_revision_id=p_delivery_id and j.status='completed' and j.selection->'implementation'=basis->'implementation'
      and j.selection->>'action_id'=p_action_id and o.payload->'plan'=j.plan
    union all
    select c.id,0,c.frozen_at,p_delivery_id,(basis#>>'{delivery,revision}')::integer from public.capability_comparisons c
      where p_kind='gsc' and c.user_id=p_user_id and c.case_id=p_case_id and c.implementation_id=p_implementation_id
      and c.implementation_revision=p_implementation_revision and c.selection->'implementation'=basis->'implementation'
      and c.selection->>'action_id'=p_action_id and c.request#>>'{scope,source}'='gsc'
      and c.request#>>'{implementation,report_id}'=p_report_id::text and c.request#>>'{implementation,delivery_revision_id}'=p_delivery_id::text
    union all
    select j.id,0,j.completed_at,p_delivery_id,(basis#>>'{delivery,revision}')::integer from public.capability_ga4_collection_jobs j
      join public.capability_ga4_collections o on o.id=j.id
      where p_kind='ga4' and j.user_id=p_user_id and j.case_id=p_case_id and j.status='succeeded'
      and j.selection->'implementation'=basis->'implementation' and j.selection->>'action_id'=p_action_id
      and j.record->>'report_id'=p_report_id::text and j.record->>'delivery_revision_id'=p_delivery_id::text
  ), page as (
    select * from candidates where p_cursor is null or (at,id,revision)<(cut_at,cut_id,cut_revision)
      order by at desc,id desc,revision desc limit 21
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,
      'at',to_char(at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'delivery_id',delivery_id,'delivery_revision',delivery_revision) order by at desc,id desc,revision desc),'[]') into result from page;
  next_cursor=null;
  if jsonb_array_length(result)>20 then
    result=result-20; next_cursor=(result->19)-array['delivery_id','delivery_revision'];
  end if;
  return jsonb_build_object('case_id',p_case_id,'report_id',p_report_id,'kind',p_kind,'items',result,'next_cursor',next_cursor);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then raise exception 'REVIEW_INVALID';
end; $$;

create or replace function public.resolve_v22_review_evidence(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.client_cases; r public.capability_report_versions; d public.report_content_revisions;
  i public.capability_implementation_records; choice jsonb; action jsonb; selections jsonb='[]';
  page jsonb; job jsonb; gsc jsonb; ga4 jsonb; obs jsonb; ref jsonb; name text; site text; source jsonb;
  ordinal integer=0; binding jsonb;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if c.id is null then raise exception 'REVIEW_UNAVAILABLE'; end if;
  if p_selection is null or octet_length(p_selection::text)>32768 then raise exception 'REVIEW_TOO_LARGE'; end if;
  if not public.v22_page_keys(p_selection,array['report','delivery','implementation','actions'])
    or not public.v22_page_keys(p_selection->'report',array['id','checksum'])
    or not public.v22_page_keys(p_selection->'delivery',array['id','revision','checksum'])
    or not public.v22_page_keys(p_selection->'implementation',array['id','revision','checksum'])
    or jsonb_typeof(p_selection->'actions') is distinct from 'array'
    or p_evaluated_at is null or not isfinite(p_evaluated_at) then raise exception 'REVIEW_INVALID'; end if;
  if p_evaluated_at>clock_timestamp()+interval '1 minute' or p_evaluated_at<clock_timestamp()-interval '5 minutes'
    then raise exception 'REVIEW_STALE'; end if;
  if jsonb_array_length(p_selection->'actions')>3 then raise exception 'REVIEW_INVALID'; end if;
  foreach name in array array['delivery','implementation'] loop
    if jsonb_typeof(p_selection#>array[name,'revision']) is distinct from 'number'
      or p_selection#>>array[name,'revision'] !~ '^[1-9][0-9]*$' then raise exception 'REVIEW_INVALID'; end if;
  end loop;
  perform 1 from public.capability_report_versions where id=(p_selection#>>'{report,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_plan_source(p_user_id,p_case_id,(p_selection#>>'{report,id}')::uuid);
  select * into d from public.report_content_revisions where id=(p_selection#>>'{delivery,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id and report_id=r.id and status='approved';
  select * into i from public.capability_implementation_records where id=(p_selection#>>'{implementation,id}')::uuid
    and revision=(p_selection#>>'{implementation,revision}')::integer and user_id=p_user_id and case_id=p_case_id
    and report_id=r.id and delivery_revision_id=d.id;
  if r.id is null or d.id is null or i.id is null or r.payload->>'report_type' is distinct from 'verified_execution'
    then raise exception 'REVIEW_UNAVAILABLE'; end if;
  if p_selection->'report' is distinct from jsonb_build_object('id',r.id,'checksum',r.payload_checksum)
    or p_selection->'delivery' is distinct from jsonb_build_object('id',d.id,'revision',d.revision,'checksum',public.v22_review_hash(d.content))
    or p_selection->'implementation' is distinct from jsonb_build_object('id',i.id,'revision',i.revision,'checksum',i.checksum)
    or d.content->>'source_checksum' is distinct from r.payload_checksum
    or i.payload->>'report_checksum' is distinct from r.payload_checksum
    or i.payload->'delivery_revision' is distinct from to_jsonb(d.revision)
    or i.recorded_at>p_evaluated_at or (r.payload->>'generated_at')::timestamptz>p_evaluated_at
    or jsonb_array_length(p_selection->'actions')<>jsonb_array_length(d.content->'actions')
    then raise exception 'REVIEW_INVALID'; end if;
  site=public.v22_review_host(coalesce(r.payload#>>'{business,site_url}',r.payload#>>'{input_manifest,business,site_url}'));
  ref=p_selection->'implementation';
  for choice in select value from jsonb_array_elements(p_selection->'actions') loop
    if not public.v22_page_keys(choice,array['action_id','page_current_id','page_previous_id','gsc_id','ga4_id'])
      or choice->'action_id' is distinct from d.content#>array['actions',ordinal::text,'id']
      or (choice->'page_current_id'='null'::jsonb and choice->'page_previous_id'<>'null'::jsonb)
      then raise exception 'REVIEW_INVALID'; end if;
    ordinal=ordinal+1; page='null'; gsc='null'; ga4='null';
    if choice->'page_current_id'<>'null'::jsonb then
      page='{}';
      foreach name in array array['current','previous'] loop
        obs='null';
        if choice->('page_'||name||'_id')<>'null'::jsonb then
          job=public.get_v22_page_check(p_user_id,p_case_id,(choice->>('page_'||name||'_id'))::uuid);
          obs=job->'observation';
          if job is null or job->>'status' is distinct from 'completed' or obs is null or obs='null'::jsonb
            or job->'selection'->'implementation' is distinct from ref
            or job#>'{selection,action_id}' is distinct from choice->'action_id'
            or obs->'id' is distinct from job->'id' or obs->'plan' is distinct from job->'plan'
            or (obs->>'observed_at')::timestamptz>p_evaluated_at
            or (job->>'completed_at')::timestamptz>p_evaluated_at then raise exception 'REVIEW_INVALID'; end if;
          binding=obs#>'{plan,binding}';
          if binding->>'report_id' is distinct from r.id::text or binding->>'delivery_revision_id' is distinct from d.id::text
            or binding->>'site_url' is distinct from coalesce(r.payload#>>'{business,site_url}',r.payload#>>'{input_manifest,business,site_url}')
            or binding->>'implementation_checksum' is distinct from i.checksum then raise exception 'REVIEW_INVALID'; end if;
        end if;
        page=page||jsonb_build_object(name,obs);
      end loop;
    end if;
    if choice->'gsc_id'<>'null'::jsonb then
      gsc=public.get_v22_comparison(p_user_id,p_case_id,(choice->>'gsc_id')::uuid);
      if gsc is null or gsc#>'{request,implementation}' is distinct from i.payload
        or gsc#>'{request,action_id}' is distinct from choice->'action_id'
        or gsc#>>'{request,scope,source}' is distinct from 'gsc'
        or (gsc#>>'{request,evaluated_at}')::timestamptz>p_evaluated_at then raise exception 'REVIEW_INVALID'; end if;
      foreach name in array array['before','after'] loop
        source=gsc#>array['request',name];
        if source<>'null'::jsonb and public.v22_review_host(source->>'external_resource_id') is distinct from site
          then raise exception 'REVIEW_INVALID'; end if;
      end loop;
    end if;
    if choice->'ga4_id'<>'null'::jsonb then
      ga4=public.get_v22_ga4_collection(p_user_id,p_case_id,(choice->>'ga4_id')::uuid);
      if ga4 is null or ga4->>'status' is distinct from 'succeeded' or ga4->'record' is distinct from i.payload
        or ga4#>'{selection,action_id}' is distinct from choice->'action_id'
        or (ga4->>'completed_at')::timestamptz>p_evaluated_at
        or ga4->'collection' is null or ga4->'collection'='null'::jsonb
        or ga4#>'{collection,plan}' is distinct from ga4->'plan'
        or jsonb_array_length(ga4#>'{plan,scope,hosts}')=0 then raise exception 'REVIEW_INVALID'; end if;
      for name in select jsonb_array_elements_text(ga4#>'{plan,scope,hosts}') loop
        if public.v22_review_host(name) is distinct from site then raise exception 'REVIEW_INVALID'; end if;
      end loop;
    end if;
    selections=selections||jsonb_build_array(jsonb_build_object('action_id',choice->'action_id','page',page,'gsc',gsc,'ga4',ga4));
  end loop;
  return jsonb_build_object('case_updated_at',public.v22_page_time(c.updated_at),'core',jsonb_build_object(
    'user_id',p_user_id,'case_id',p_case_id,'evaluated_at',public.v22_page_time(p_evaluated_at),
    'rules_version','v22_review_projection_rules_v1','report',r.payload,'report_checksum',r.payload_checksum,
    'delivery_id',d.id,'delivery_revision',d.revision,'delivery',d.content,'delivery_checksum',public.v22_review_hash(d.content),
    'implementation',i.payload,'selections',selections));
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception 'REVIEW_INVALID';
end; $$;

create or replace function public.v22_page_check_source(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_current boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.client_cases; r public.capability_implementation_records; report public.capability_report_versions;
  d public.report_content_revisions; b public.case_business_scope_versions; ref jsonb; item jsonb;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if c.id is null then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  if not public.v22_page_keys(p_selection,array['implementation','action_id','target_url','conditions'])
    or octet_length(p_selection::text)>20480 or jsonb_typeof(p_selection->'action_id') is distinct from 'string'
    or length(p_selection->>'action_id') not between 1 and 200 or p_selection->>'action_id' !~ '\S'
    or p_selection->>'action_id' ~ '[[:cntrl:]]' or jsonb_typeof(p_selection->'target_url') is distinct from 'string'
    or jsonb_typeof(p_selection->'conditions') is distinct from 'array' then raise exception 'PAGE_CHECK_INVALID'; end if;
  ref=p_selection->'implementation';
  if not public.v22_page_keys(ref,array['id','revision','checksum']) then raise exception 'PAGE_CHECK_INVALID'; end if;
  select * into r from public.capability_implementation_records where id=(ref->>'id')::uuid
    and revision=(ref->>'revision')::integer and user_id=p_user_id and case_id=p_case_id;
  if r.id is null or ref is distinct from jsonb_build_object('id',r.id,'revision',r.revision,'checksum',r.checksum)
    then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=r.report_id for update;
  perform public.v22_implementation_source(p_user_id,p_case_id,r.report_id,r.delivery_revision_id);
  select * into report from public.get_v22_completed_plan_source(p_user_id,p_case_id,r.report_id);
  select * into d from public.report_content_revisions where id=r.delivery_revision_id;
  select * into b from public.case_business_scope_versions where id=(coalesce(report.payload#>>'{business,id}',report.payload#>>'{input_manifest,business,id}'))::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if b.id is null or b.scope is distinct from coalesce(report.payload->'business',report.payload#>'{input_manifest,business}')
    or r.payload->>'report_checksum' is distinct from report.payload_checksum
    or r.payload->'delivery_revision' is distinct from to_jsonb(d.revision)
    or not exists(select 1 from jsonb_array_elements(r.payload->'entries') e where e->>'action_id'=p_selection->>'action_id')
    or not exists(select 1 from jsonb_array_elements(d.content->'actions') a where a->>'id'=p_selection->>'action_id')
    then raise exception 'PAGE_CHECK_SOURCE_CHANGED'; end if;
  if p_current and (exists(select 1 from public.capability_implementation_records where delivery_revision_id=r.delivery_revision_id and revision>r.revision)
    or exists(select 1 from public.case_business_scope_versions where case_id=p_case_id and revision>b.revision)
    or r.recorded_at>clock_timestamp() or c.updated_at>clock_timestamp()) then raise exception 'PAGE_CHECK_SOURCE_CHANGED'; end if;
  if not public.v22_page_url_valid(p_selection->>'target_url',b.scope->>'site_url')
    or jsonb_array_length(p_selection->'conditions') not between 1 and 5
    or (select count(distinct x->>'id') from jsonb_array_elements(p_selection->'conditions') x)<>jsonb_array_length(p_selection->'conditions')
    then raise exception 'PAGE_CHECK_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_selection->'conditions') loop
    if not public.v22_page_keys(item,array['id','kind','value'])
      or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[a-zA-Z0-9_-]{1,64}$'
      or jsonb_typeof(item->'kind') is distinct from 'string' or item->>'kind' not in ('text_present','link_present','anchor_present')
      or jsonb_typeof(item->'value') is distinct from 'string' or item->>'value' !~ '\S' or item->>'value' ~ '[[:cntrl:]]'
      or length(item->>'value') not between 1 and (case item->>'kind' when 'text_present' then 200 when 'anchor_present' then 128 else 2000 end)
      or (item->>'kind'='link_present' and not public.v22_page_url_valid(item->>'value',b.scope->>'site_url'))
      then raise exception 'PAGE_CHECK_INVALID'; end if;
  end loop;
  return jsonb_build_object('record',r.payload,'report',report.payload,'report_checksum',report.payload_checksum,
    'delivery',d.content,'delivery_id',d.id,'delivery_revision',d.revision,'business',b.scope,
    'case_updated_at',public.v22_page_time(c.updated_at));
end; $$;

create or replace function public.v22_check_review_report(p jsonb,v jsonb,r jsonb) returns void
language plpgsql immutable set search_path=public as $$
declare c jsonb; a jsonb; approved jsonb; selected jsonb; client jsonb; facts jsonb; source jsonb; next jsonb;
  i integer=0; next_work jsonb; n jsonb; new_items jsonb='[]'; new_client jsonb='[]'; limits jsonb; findings jsonb;
begin
  c=p->'content';next_work=public.v22_review_report_actions(v);
  select jsonb_agg(value order by first_position) into limits from (
    select value,min(position) first_position from jsonb_array_elements(
      jsonb_build_array('Observed changes do not establish that this work caused a business result.')||(v#>'{evidence,bundle,report,limitations}'))
      with ordinality a(value,position) group by value order by min(position) limit 40) x;
  if public.v22_page_keys(p,array['schema_version','id','report_type','version','generated_at','input_reference','business','title','summary',
      'content','action_state','actions','limitations','delivery_state','settlement_policy','checksum']) is not true
    or p->>'schema_version' is distinct from '2.2.3' or p->>'report_type' is distinct from 'verified_execution'
    or p->'id' is distinct from v->'job_id' or p->'version' is distinct from to_jsonb((v#>>'{evidence,bundle,report,version}')::integer+1)
    or p->'generated_at' is distinct from v->'prepared_at' or p->'input_reference' is distinct from r
    or p->'business' is distinct from coalesce(v#>'{evidence,bundle,report,business}',v#>'{evidence,bundle,report,input_manifest,business}')
    or p->>'title' is distinct from 'Verified Action Plan · Review'
    or p->>'summary' is distinct from 'Review the recorded work, the selected evidence and the next actions before client delivery.'
    or p->>'delivery_state' is distinct from 'requires_delivery_review'
    or p->>'settlement_policy' is distinct from 'one_credit_per_completed_analysis'
    or p->>'checksum' is distinct from public.v22_review_hash(p-'checksum')
    or p->'actions' is distinct from next_work or jsonb_array_length(next_work)>3
    or p->>'action_state' is distinct from (case when jsonb_array_length(next_work)>0 then 'actions_supported' else 'no_next_actions' end)
    or p->'limitations' is distinct from limits then raise exception 'REVIEW_REPORT_INVALID'; end if;
  if public.v22_page_keys(c,array['schema_version','rules_version','job_id','user_id','case_id','base_report_id','report_type',
      'proposed_version','prepared_at','input_checksum','review_id','review_checksum','decision_id','decision_checksum','delivery_state',
      'prior_diagnosis','seo_actions','seo_new_decisions','client_actions','client_new_decisions','effect','causal_attribution','checksum']) is not true
    or c->>'schema_version' is distinct from 'v22_review_generation_content_v1' or c->'rules_version' is distinct from v->'rules_version'
    or c->'job_id' is distinct from v->'job_id' or c->'user_id' is distinct from v->'user_id' or c->'case_id' is distinct from v->'case_id'
    or c->'base_report_id' is distinct from v->'report_id' or c->'report_type' is distinct from p->'report_type'
    or c->'proposed_version' is distinct from p->'version' or c->'prepared_at' is distinct from v->'prepared_at'
    or c->'input_checksum' is distinct from v->'checksum' or c->'review_id' is distinct from r->'review_id'
    or c->'review_checksum' is distinct from r->'review_checksum' or c->'decision_id' is distinct from r->'decision_id'
    or c->'decision_checksum' is distinct from r->'decision_checksum' or c->'delivery_state' is distinct from p->'delivery_state'
    or c->'effect' is distinct from 'null'::jsonb or c->'causal_attribution' is distinct from 'false'::jsonb
    or c->>'checksum' is distinct from public.v22_review_hash(c-'checksum')
    then raise exception 'REVIEW_REPORT_INVALID'; end if;
  -- Select only the historical diagnosis fields; rule metadata never changes its meaning.
  select coalesce(jsonb_agg(jsonb_build_object('classification',f->'classification','target',f->'target',
    'observed_fact',f->'observed_fact','observed_at',f->'observed_at','comparison_scope',f->'comparison_scope',
    'judgment',f->'judgment','interpretation',f->'interpretation','limitations',f->'limitations') order by position),'[]'::jsonb)
    into findings from jsonb_array_elements(v#>'{evidence,bundle,report,findings}') with ordinality a(f,position);
  if c->'prior_diagnosis' is distinct from coalesce(v#>'{evidence,bundle,report,prior_diagnosis}',jsonb_build_object('source','prior_report_not_rechecked',
    'title',v#>'{evidence,bundle,delivery,title}','summary',v#>'{evidence,bundle,delivery,summary}',
    'action_state',v#>'{evidence,bundle,report,action_state}','findings',findings,'limitations',v#>'{evidence,bundle,report,limitations}'))
    then raise exception 'REVIEW_REPORT_INVALID'; end if;
  if jsonb_typeof(c->'seo_actions') is distinct from 'array' or jsonb_typeof(c->'client_actions') is distinct from 'array'
    or jsonb_array_length(c->'seo_actions')<>(select jsonb_array_length(v#>'{evidence,bundle,delivery,actions}'))
    or jsonb_array_length(c->'client_actions')<>jsonb_array_length(c->'seo_actions') then raise exception 'REVIEW_REPORT_INVALID'; end if;
  for a in select value from jsonb_array_elements(c->'seo_actions') loop
    approved=v#>array['evidence','bundle','delivery','actions',i::text];
    source=v#>array['evidence','bundle','selections',i::text];
    select value into selected from jsonb_array_elements(v#>'{decision,decisions}') where value->'action_id'=approved->'id';
    client=c#>array['client_actions',i::text];facts=a->'facts';next=client->'next_decision';
    if public.v22_page_keys(a,array['facts','approved_action','source_references','selected_decision']) is not true
      or public.v22_page_keys(client,array['facts','next_decision']) is not true
      or public.v22_page_keys(facts,array['action_id','title','target','recorded_work','page','gsc','ga4','checks','effect','causal_attribution']) is not true
      or a->'approved_action' is distinct from approved or a->'selected_decision' is distinct from coalesce(selected,'null'::jsonb)
      or facts->'action_id' is distinct from approved->'id' or facts->'title' is distinct from approved->'title'
      or facts->'target' is distinct from approved->'target' or client->'facts' is distinct from facts
      or facts->'effect' is distinct from 'null'::jsonb or facts->'causal_attribution' is distinct from 'false'::jsonb
      or facts#>'{recorded_work,system_completion_verified}' is distinct from 'false'::jsonb
      or public.v22_page_keys(next,array['action_id','decision_state','disposition','text','system_completion_verified']) is not true
      or next->'action_id' is distinct from approved->'id'
      or next->'disposition' is distinct from coalesce(selected->'disposition','null'::jsonb)
      or next->>'decision_state' is distinct from (case when selected is null then 'needs_review' else 'seo_recorded' end)
      or next->'system_completion_verified' is distinct from 'false'::jsonb
      or next is distinct from public.v22_review_decision_summary(approved->'id',selected)
      then raise exception 'REVIEW_REPORT_INVALID'; end if;
    if source->'gsc'='null'::jsonb then
      if facts->'gsc'<>'null'::jsonb then raise exception 'REVIEW_REPORT_INVALID'; end if;
    elsif facts#>'{gsc,metrics}' is distinct from source#>'{gsc,result,metrics}'
      or facts#>'{gsc,state}' is distinct from source#>'{gsc,result,state}'
      or facts#>'{gsc,scope}' is distinct from source#>'{gsc,result,scope}'
      or facts#>'{gsc,windows}' is distinct from source#>'{gsc,result,windows}' then raise exception 'REVIEW_REPORT_INVALID'; end if;
    i=i+1;
  end loop;
  for n in select value from jsonb_array_elements(v#>'{decision,decisions}') where value->>'disposition'='new' loop
    new_items=new_items||jsonb_build_array(n);
    new_client=new_client||jsonb_build_array(public.v22_review_decision_summary(n->'action_id',n));
  end loop;
  if c->'seo_new_decisions' is distinct from new_items or jsonb_typeof(c->'client_new_decisions') is distinct from 'array'
    or c->'client_new_decisions' is distinct from new_client then raise exception 'REVIEW_REPORT_INVALID'; end if;
end; $$;

create or replace function public.start_v22_review_generation(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_command_text text,p_input_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c jsonb; existing jsonb; r jsonb; j uuid; balance integer; base public.capability_report_versions; input jsonb;
begin
  c=public.v22_review_start_command(p_command_text);j=(c->>'job_id')::uuid;
  -- Serialize all review intakes in a Case, including identical requests.
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  existing=public.lookup_v22_review_generation(p_user_id,p_case_id,p_report_id,p_command_text);
  if existing is not null then return existing; end if;
  if exists(select 1 from public.analysis_jobs where id=j)
    or exists(select 1 from public.capability_review_generation_requests q join public.analysis_jobs a on a.id=q.job_id
      where q.case_id=p_case_id and q.review_id=(c->>'review_id')::uuid and q.decision_id=(c->>'decision_id')::uuid and a.status<>'failed')
    then raise exception 'REVIEW_START_CONFLICT' using errcode='40001'; end if;
  select * into base from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id
    and payload->>'report_type'='verified_execution' and schema_version in ('2.2.2','2.2.3');
  if base.id is null then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  if exists(select 1 from public.capability_report_versions where case_id=p_case_id and payload->>'report_type'='verified_execution'
    and (payload->>'version')::integer>(base.payload->>'version')::integer) then raise exception 'REVIEW_START_STALE'; end if;
  r=public.v22_review_generation_recipe(p_user_id,p_case_id,j,p_input_text);
  if r->'report_id' is distinct from to_jsonb(p_report_id::text)
    or r->'review_id' is distinct from c->'review_id' or r->'review_checksum' is distinct from c->'review_checksum'
    or r->'decision_id' is distinct from c->'decision_id' or r->'decision_checksum' is distinct from c->'decision_checksum'
    then raise exception 'REVIEW_START_INVALID'; end if;
  if exists(select 1 from public.analysis_jobs where case_id=p_case_id and status in ('queued','running'))
    or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then raise exception 'REVIEW_START_BUSY'; end if;
  update public.users set credit_balance=credit_balance-1,updated_at=now() where id=p_user_id and credit_balance>=1 returning credit_balance into balance;
  if balance is null then raise exception 'REVIEW_START_INSUFFICIENT_CREDITS'; end if;
  if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then raise exception 'REVIEW_START_BUSY'; end if;
  insert into public.analysis_jobs(id,case_id,job_type,status,current_stage,state_revision,idempotency_key,deadline_at)
    values(j,p_case_id,'verified_report','queued','queued',1,'review:'||j::text,clock_timestamp()+interval '20 minutes');
  insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id)
    values(j,p_user_id,p_case_id,'verified','review:'||j::text,j);
  insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
    values(p_user_id,p_case_id,j,j,'verified_debit',-1,balance,'workflow:'||j::text||':debit');
  input=public.freeze_v22_review_generation_input(p_user_id,p_case_id,j,1,p_input_text);
  insert into public.capability_review_generation_requests(job_id,user_id,case_id,report_id,review_id,decision_id,command)
    values(j,p_user_id,p_case_id,p_report_id,(c->>'review_id')::uuid,(c->>'decision_id')::uuid,c);
  insert into public.capability_review_generation_work(job_id) values(j);
  return public.get_v22_review_generation_status(p_user_id,p_case_id,p_report_id,j);
end; $$;

commit;
