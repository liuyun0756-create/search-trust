begin;

-- Read-only directories for the owner workspace. No provider, credit or report writes.
create function public.get_v22_review_workspace_basis(p_user_id uuid,p_case_id uuid,p_report_id uuid,
  p_delivery_id uuid,p_implementation_id uuid,p_implementation_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; d public.report_content_revisions;
  i public.capability_implementation_records; choices jsonb;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
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

create function public.list_v22_review_workspace(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_kind text,
  p_delivery_id uuid default null,p_implementation_id uuid default null,p_implementation_revision integer default null,
  p_action_id text default null,p_cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; basis jsonb; result jsonb; next_cursor jsonb;
  cut_at timestamptz; cut_id uuid; cut_revision integer;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
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

revoke all on function public.get_v22_review_workspace_basis(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.list_v22_review_workspace(uuid,uuid,uuid,text,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.get_v22_review_workspace_basis(uuid,uuid,uuid,uuid,uuid,integer) to service_role;
grant execute on function public.list_v22_review_workspace(uuid,uuid,uuid,text,uuid,uuid,integer,text,jsonb) to service_role;
commit;
