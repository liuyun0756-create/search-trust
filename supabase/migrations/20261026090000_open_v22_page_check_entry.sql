begin;

-- The clock is supplied only by private server functions, never by an owner request.
-- Keep this calculation shared by the read snapshot and the insert guard.
create function public.v22_page_check_limits(p_case_id uuid,p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare used integer; latest timestamptz; tenth timestamptz; active boolean; next_at timestamptz;
begin
  select count(*),max(created_at) into used,latest from public.capability_page_check_jobs
    where case_id=p_case_id and created_at>p_now-interval '24 hours';
  select created_at into tenth from public.capability_page_check_jobs
    where case_id=p_case_id and created_at>p_now-interval '24 hours'
    order by created_at desc,id offset 9 limit 1;
  select exists(select 1 from public.capability_page_check_jobs where case_id=p_case_id and status in ('queued','running')) into active;
  next_at=greatest(p_now,latest+interval '5 minutes',tenth+interval '24 hours');
  return jsonb_build_object('used',used,'active',active,'server_time',public.v22_page_time(p_now),
    'next_request_at',public.v22_page_time(next_at),'reason',case when active then 'active'
      when used>=10 then 'quota' when next_at>p_now then 'cooldown' else null end);
end; $$;

-- Every insertion path (including the existing RPC) passes here, after source validation.
-- Existing-ID recovery returns before INSERT and never consumes another allowance.
create function public.v22_guard_page_check_rate() returns trigger
language plpgsql security definer set search_path=public as $$
declare limits jsonb; stamp timestamptz;
begin
  perform 1 from public.client_cases where id=new.case_id and user_id=new.user_id and status='active' for update;
  if not found then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  stamp=clock_timestamp();
  limits=public.v22_page_check_limits(new.case_id,stamp);
  if limits->>'reason' is not null then
    raise sqlstate 'PT429' using message='PAGE_CHECK_RATE_LIMIT',detail=limits::text;
  end if;
  new.created_at=stamp;
  return new;
end; $$;
create trigger page_check_rate before insert on public.capability_page_check_jobs
  for each row execute function public.v22_guard_page_check_rate();
create index capability_page_check_case_time on public.capability_page_check_jobs(case_id,created_at desc,id);

create function public.get_v22_page_check_context(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source jsonb; record jsonb; site text; eligible boolean=false; history jsonb; actions jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  source=public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  select payload into record from public.capability_implementation_records
    where user_id=p_user_id and case_id=p_case_id and report_id=p_report_id and delivery_revision_id=p_delivery_revision_id
    order by revision desc limit 1;
  select payload#>>'{input_manifest,business,site_url}' into site from public.capability_report_versions where id=p_report_id;
  if record is not null and jsonb_array_length(record->'entries')>0 then
    -- Validate current sources without creating a task, expiring a task or visiting a URL.
    begin
      perform public.v22_page_check_source(p_user_id,p_case_id,jsonb_build_object(
        'implementation',jsonb_build_object('id',record->'id','revision',record->'revision','checksum',record->'checksum'),
        'action_id',record#>'{entries,0,action_id}','target_url',site,
        'conditions',jsonb_build_array(jsonb_build_object('id','context','kind','text_present','value','Context validation'))),true);
      eligible=true;
    exception when raise_exception then eligible=false;
    end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a->'id','title',a->'title')),'[]'::jsonb) into actions
    from jsonb_array_elements(source->'actions') a
    where exists(select 1 from jsonb_array_elements(record->'entries') e where e->>'action_id'=a->>'id');
  select coalesce(jsonb_agg(item order by created_at desc,id),'[]'::jsonb) into history from (
    select j.id,j.created_at,jsonb_build_object('id',j.id,'user_id',j.user_id,'case_id',j.case_id,
      'report_id',j.report_id,'delivery_revision_id',j.delivery_revision_id,'status',j.status,
      'created_at',public.v22_page_time(j.created_at),'completed_at',public.v22_page_time(j.completed_at),'error_code',j.error_code) item
    from public.capability_page_check_jobs j where j.user_id=p_user_id and j.case_id=p_case_id
      and j.report_id=p_report_id and j.delivery_revision_id=p_delivery_revision_id
    order by j.created_at desc,j.id limit 20
  ) selected_history;
  return jsonb_build_object('record',record,'actions',actions,'site_url',site,'eligible',eligible,
    'delivery_revision',source->'delivery_revision','history',history,
    'limits',public.v22_page_check_limits(p_case_id,clock_timestamp()));
end; $$;

-- Expiry is a background mutation, never an owner GET. No fetch or requeue occurs here.
create function public.prepare_v22_page_check_dispatch() returns jsonb
language plpgsql security definer set search_path=public as $$
declare item record; result jsonb;
begin
  for item in select id from public.capability_page_check_jobs
    where (status='queued' and created_at+interval '10 minutes'<=clock_timestamp())
       or (status='running' and lease_expires_at<=clock_timestamp()) order by created_at,id limit 20 loop
    perform public.expire_v22_page_check(item.id);
  end loop;
  select coalesce(jsonb_agg(id order by created_at,id),'[]'::jsonb) into result from (
    select id,created_at from public.capability_page_check_jobs where status='queued'
      and created_at+interval '10 minutes'>clock_timestamp() order by created_at,id limit 20
  ) pending;
  return result;
end; $$;

revoke all on function public.v22_page_check_limits(uuid,timestamptz),public.v22_guard_page_check_rate(),
  public.get_v22_page_check_context(uuid,uuid,uuid,uuid),public.prepare_v22_page_check_dispatch()
  from public,anon,authenticated,service_role;
grant execute on function public.get_v22_page_check_context(uuid,uuid,uuid,uuid),public.prepare_v22_page_check_dispatch() to service_role;
commit;
