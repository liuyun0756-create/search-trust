begin;

-- Keep alternative source identifiers unambiguous across both stores, including
-- concurrent ordinary sync insertion. User-chosen collection IDs must not shadow
-- another snapshot or an ordinary sync which has not published its snapshot yet.
create function public.guard_v22_collection_source_id() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('v22-source-id:'||new.id::text,0));
  if tg_table_name='capability_collection_jobs' then
    if exists(select 1 from data_snapshots where id=new.id) or exists(select 1 from google_sync_jobs where id=new.id)
      then raise exception 'COLLECTION_ID_CONFLICT'; end if;
  elsif exists(select 1 from capability_collection_jobs where id=new.id) then
    raise exception 'COLLECTION_ID_CONFLICT';
  end if;
  return new;
end; $$;
create trigger collection_source_id before insert on public.capability_collection_jobs for each row execute function public.guard_v22_collection_source_id();
create trigger ordinary_snapshot_source_id before insert on public.data_snapshots for each row execute function public.guard_v22_collection_source_id();
create trigger ordinary_sync_source_id before insert on public.google_sync_jobs for each row execute function public.guard_v22_collection_source_id();
revoke all on function public.guard_v22_collection_source_id() from public,anon,authenticated,service_role;

create function public.get_v22_collection_context(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bindings jsonb; jobs jsonb; implementation jsonb; implementation_record jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  perform public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  select jsonb_build_object('id',id,'revision',revision,'checksum',checksum) into implementation
    from public.capability_implementation_records where user_id=p_user_id and case_id=p_case_id
      and report_id=p_report_id and delivery_revision_id=p_delivery_revision_id order by revision desc limit 1;
  select payload into implementation_record from capability_implementation_records
    where id=(implementation->>'id')::uuid and revision=(implementation->>'revision')::integer;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'resource',b.external_resource_id) order by b.id),'[]') into bindings
    from public.case_source_bindings b join public.google_connections g on g.id=b.connection_id
    where b.case_id=p_case_id and b.source_type='gsc' and b.is_active and b.disconnected_at is null
      and b.identity_match_status='matched' and b.confirmed_by_user_id=p_user_id and b.confirmed_at<=clock_timestamp()
      and g.user_id=p_user_id and g.status='active' and 'https://www.googleapis.com/auth/webmasters.readonly'=any(g.granted_scopes);
  select coalesce(jsonb_agg(jsonb_build_object('schema_version','v22_collection_view_v1','id',j.id,
    'case_id',j.case_id,'report_id',j.record->'report_id','delivery_revision_id',j.record->'delivery_revision_id',
    'selection',j.selection,'windows',j.plan->'windows','resource',j.plan->'resource_id','status',j.status,
    'created_at',to_char(j.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'completed_at',to_char(j.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'error_code',j.error_code)
    order by j.created_at desc,j.id),'[]') into jobs from (
    select * from public.capability_collection_jobs where user_id=p_user_id and case_id=p_case_id
      and record->>'report_id'=p_report_id::text and record->>'delivery_revision_id'=p_delivery_revision_id::text
    order by created_at desc,id limit 20
  ) j;
  return jsonb_build_object('implementation',implementation,'implementation_record',implementation_record,'bindings',bindings,'jobs',jobs);
end; $$;

create function public.pending_v22_collections() returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(id),'[]') from (select id from capability_collection_jobs
    where status='queued' or (status='running' and lease_expires_at<=clock_timestamp()) order by created_at,id limit 20) j;
$$;

-- IDs can now reference either immutable ordinary snapshots or dedicated
-- collections. Resolver/save functions enforce the alternative foreign source;
-- direct INSERT/UPDATE remains denied and comparisons remain immutable.
alter table public.capability_comparisons drop constraint capability_comparisons_before_snapshot_id_fkey;
alter table public.capability_comparisons drop constraint capability_comparisons_after_snapshot_id_fkey;

create or replace function public.v22_lock_comparison_sources(p_user_id uuid,p_case_id uuid,p_selection jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare ids uuid[];
begin
  select array_agg(binding_id) into ids from (
    select binding_id from data_snapshots where case_id=p_case_id and id in ((p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid)
    union select binding_id from capability_collection_jobs where user_id=p_user_id and case_id=p_case_id
      and id in ((p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid)
  ) sources;
  perform 1 from google_connections where user_id=p_user_id and id in (select connection_id from case_source_bindings where id=any(ids)) order by id for share;
  perform 1 from client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'COMPARISON_NOT_FOUND'; end if;
  perform 1 from case_source_bindings where case_id=p_case_id and id=any(ids) order by id for share;
end; $$;

alter function public.v22_comparison_snapshot(uuid,uuid,uuid,text,boolean,timestamptz) rename to v22_ordinary_comparison_snapshot;
create function public.v22_comparison_snapshot(p_user_id uuid,p_case_id uuid,p_snapshot_id uuid,p_source text,p_current boolean,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs; c public.capability_collections;
begin
  select * into j from capability_collection_jobs where id=p_snapshot_id and user_id=p_user_id and case_id=p_case_id;
  if j.id is null then return public.v22_ordinary_comparison_snapshot(p_user_id,p_case_id,p_snapshot_id,p_source,p_current,p_evaluated_at); end if;
  select * into c from capability_collections where id=j.id;
  if p_source<>'gsc' or j.status<>'succeeded' or c.id is null or not public.v22_collection_valid(j)
    or c.collected_at>p_evaluated_at or (p_current and (c.expires_at<=p_evaluated_at or c.expires_at<=clock_timestamp()))
    then raise exception 'COMPARISON_SOURCE_CHANGED'; end if;
  return jsonb_build_object('snapshot_id',j.id,'case_id',j.case_id,'binding_id',j.binding_id,'source_type','gsc','schema_version','gsc_sync_v1',
    'fetched_at',c.collected_at,'expires_at',c.expires_at,'identity_match_status','matched',
    'health_status',c.payload->'health_status','health_reasons',c.payload->'health_reasons','normalized_payload',c.payload->'snapshot',
    'raw_payload',null,'payload_checksum',c.payload->'payload_checksum','external_resource_id',j.plan->'resource_id',
    'coverage_start',j.plan#>'{windows,before,start}','coverage_end',j.plan#>'{windows,after,end}');
end; $$;

alter function public.resolve_v22_comparison_input(uuid,uuid,jsonb,timestamptz) rename to resolve_v22_ordinary_comparison_input;
create function public.resolve_v22_comparison_input(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs;
begin
  for j in select * from capability_collection_jobs where id in ((p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid) loop
    if j.user_id<>p_user_id or j.case_id<>p_case_id or j.plan->'implementation' is distinct from p_selection->'implementation'
      or j.plan->'action_id' is distinct from p_selection->'action_id' or j.plan#>'{windows,days}' is distinct from p_selection->'days'
      or p_selection->>'before_snapshot_id' is distinct from j.id::text or p_selection->>'after_snapshot_id' is distinct from j.id::text
      then raise exception 'COMPARISON_SOURCE_CHANGED'; end if;
  end loop;
  return public.resolve_v22_ordinary_comparison_input(p_user_id,p_case_id,p_selection,p_evaluated_at);
end; $$;

alter function public.get_v22_comparison_context(uuid,uuid,uuid,uuid) rename to get_v22_ordinary_comparison_context;
create function public.get_v22_comparison_context(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare base jsonb; collected jsonb;
begin
  base=public.get_v22_ordinary_comparison_context(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  select coalesce(jsonb_agg(item order by collected_at desc),'[]') into collected from (
    select c.collected_at,jsonb_build_object('id',j.id,'source','gsc','resource',j.plan->'resource_id',
      'coverage_start',j.plan#>'{windows,before,start}','coverage_end',j.plan#>'{windows,after,end}',
      'fetched_at',to_char(c.collected_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'expires_at',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'current_eligible',c.expires_at>clock_timestamp()) item
    from capability_collection_jobs j join capability_collections c on c.id=j.id
    where j.user_id=p_user_id and j.case_id=p_case_id and j.status='succeeded' and public.v22_collection_valid(j)
      and j.plan->'implementation'=base->'implementation' and c.collected_at<=clock_timestamp()
      and j.record->>'report_id'=p_report_id::text and j.record->>'delivery_revision_id'=p_delivery_revision_id::text
    order by c.collected_at desc limit 20
  ) sources;
  return jsonb_set(base,'{sources}',(select coalesce(jsonb_agg(value),'[]') from (
    select value from jsonb_array_elements(collected||(base->'sources')) limit 50) all_sources));
end; $$;

revoke all on function public.get_v22_ordinary_comparison_context(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.resolve_v22_ordinary_comparison_input(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.v22_comparison_snapshot(uuid,uuid,uuid,text,boolean,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.get_v22_comparison_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.resolve_v22_comparison_input(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.get_v22_collection_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.pending_v22_collections() from public,anon,authenticated;
grant execute on function public.get_v22_comparison_context(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.resolve_v22_comparison_input(uuid,uuid,jsonb,timestamptz) to service_role;
grant execute on function public.get_v22_collection_context(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.pending_v22_collections() to service_role;
commit;
