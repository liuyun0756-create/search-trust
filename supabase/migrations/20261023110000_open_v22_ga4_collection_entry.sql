begin;

-- GA4 tasks also share logical-job cost storage: IDs must not shadow another job.
create or replace function public.guard_v22_collection_source_id() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('v22-source-id:'||new.id::text,0));
  if tg_table_name='analysis_jobs' then
    if exists(select 1 from capability_ga4_collection_jobs where id=new.id) then raise exception 'COLLECTION_ID_CONFLICT'; end if;
    return new;
  end if;
  if tg_table_name='capability_ga4_collection_jobs' then
    if exists(select 1 from data_snapshots where id=new.id) or exists(select 1 from google_sync_jobs where id=new.id)
      or exists(select 1 from capability_collection_jobs where id=new.id) or exists(select 1 from analysis_jobs where id=new.id)
      then raise exception 'COLLECTION_ID_CONFLICT'; end if;
  elsif exists(select 1 from capability_ga4_collection_jobs where id=new.id) then
    raise exception 'COLLECTION_ID_CONFLICT';
  elsif tg_table_name='capability_collection_jobs' then
    if exists(select 1 from data_snapshots where id=new.id) or exists(select 1 from google_sync_jobs where id=new.id)
      then raise exception 'COLLECTION_ID_CONFLICT'; end if;
  elsif exists(select 1 from capability_collection_jobs where id=new.id) then
    raise exception 'COLLECTION_ID_CONFLICT';
  end if;
  return new;
end; $$;
create trigger ga4_collection_source_id before insert on public.capability_ga4_collection_jobs
  for each row execute function public.guard_v22_collection_source_id();
create trigger ga4_collection_analysis_id before insert on public.analysis_jobs
  for each row execute function public.guard_v22_collection_source_id();

create function public.get_v22_ga4_collection_context(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare record jsonb; candidates jsonb; jobs jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  perform public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  select payload into record from capability_implementation_records
    where user_id=p_user_id and case_id=p_case_id and report_id=p_report_id and delivery_revision_id=p_delivery_revision_id
    order by revision desc limit 1;
  -- Full authorization/scope/checksum validation happens again in resolve_plan.
  select coalesce(jsonb_agg(item),'[]'::jsonb) into candidates from (
    select jsonb_build_object('binding_id',b.id,'scope_snapshot_id',s.id,
      'observed_at',to_char(s.fetched_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) item
    from case_source_bindings b join lateral (
      select id,fetched_at,expires_at from data_snapshots where binding_id=b.id and case_id=p_case_id and source_type='ga4'
        order by fetched_at desc,id desc limit 1
    ) s on s.expires_at>clock_timestamp() and s.fetched_at<=clock_timestamp()
    where b.case_id=p_case_id and b.source_type='ga4' and b.is_active and b.disconnected_at is null limit 20
  ) eligible;
  select coalesce(jsonb_agg(id order by created_at desc,id),'[]'::jsonb) into jobs from (
    select j.id,j.created_at from capability_ga4_collection_jobs j where j.user_id=p_user_id and j.case_id=p_case_id
      and j.record->>'report_id'=p_report_id::text and j.record->>'delivery_revision_id'=p_delivery_revision_id::text
      order by j.created_at desc,j.id limit 20
  ) history;
  return jsonb_build_object('record',record,'candidates',candidates,'job_ids',jobs);
end; $$;
revoke all on function public.get_v22_ga4_collection_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_ga4_collection_context(uuid,uuid,uuid,uuid) to service_role;
commit;
