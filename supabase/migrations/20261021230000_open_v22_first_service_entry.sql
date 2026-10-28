begin;

-- Trusted read model, never returned verbatim to the browser. No collection or billing.
create function public.get_v22_first_service_workspace(p_user_id uuid,p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; c public.workflow_charges; d public.capability_first_service_discoveries;
  sources jsonb='{}'; source text; sid uuid; ready boolean; ids uuid[];
begin
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}') into ids
    from public.case_source_bindings b join public.client_cases own on own.id=b.case_id
    where own.id=p_case_id and own.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=p_user_id order by id for share;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  foreach source in array array['gsc','ga4'] loop
    select s.id into sid from public.data_snapshots s join public.case_source_bindings b on b.id=s.binding_id
      where b.case_id=p_case_id and b.is_active and b.source_type=source and s.source_type=source
      order by s.fetched_at desc,s.id desc limit 1;
    ready=false;
    begin perform public.check_v22_first_service_source(p_user_id,p_case_id,sid,source); ready=true;
    exception when raise_exception then ready=false; end;
    sources=sources||jsonb_build_object(source,jsonb_build_object('id',sid,'ready',ready));
  end loop;
  select w.* into c from public.workflow_charges w join public.capability_first_service_discoveries x on x.workflow_id=w.id
    where w.user_id=p_user_id and w.case_id=p_case_id order by w.created_at desc,w.id desc limit 1 for share of w;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  return jsonb_build_object('user_id',p_user_id,'case_id',p_case_id,
    'business',jsonb_build_object('business_identity',cc.business_identity,'primary_service',cc.primary_service,'target_market',cc.target_market),
    'sources',sources,'credit_balance',(select credit_balance from public.users where id=p_user_id),
    'other_work',cc.latest_report_id is not null or exists(select 1 from public.analysis_jobs where case_id=p_case_id
      and (status in ('queued','running') or capability_report_id is not null) and id is distinct from c.analysis_job_id)
      or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved' and id is distinct from c.id),
    'workflow',case when c.id is null then null else public.get_v22_first_service_discovery_state(p_user_id,p_case_id,c.id) end,
    'request',d.request,'result',d.result,
    'collection',(select request from public.capability_first_service_collections where job_id=c.analysis_job_id));
end; $$;
revoke all on function public.get_v22_first_service_workspace(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_first_service_workspace(uuid,uuid) to service_role;

-- Confirm and enroll in one transaction. The canonical request is constructed by
-- the authenticated server from saved candidates, not accepted from a browser.
create function public.confirm_v22_first_service_entry(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
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
    'priority',null,'confirmation_source','seo_confirmation','confirmed_at',now());
  perform public.save_v22_business_scope(p_user_id,p_case_id,revision,scope);
  perform public.start_v22_first_service_preparation(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_gsc_snapshot_id,p_ga4_snapshot_id);
  perform public.begin_v22_first_service_collection(p_user_id,p_case_id,c.id,c.idempotency_key,scope_id,p_request_canonical);
end; $$;
revoke all on function public.confirm_v22_first_service_entry(uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_v22_first_service_entry(uuid,uuid,uuid,uuid,uuid,uuid,text) to service_role;

-- Registration and queue publication cannot be one transaction. Poll this
-- durable outbox, then let the existing SQL lease authorize each execution.
create function public.list_v22_first_service_preparation_work(p_limit integer default 25,p_max_attempts integer default 3)
returns table(job_id uuid,run_generation integer) language plpgsql security definer set search_path=public as $$
begin
  if p_limit is null or p_limit not between 1 and 100 or p_max_attempts is null or p_max_attempts not between 1 and 10
    then raise exception 'FIRST_SERVICE_PREPARATION_INVALID'; end if;
  return query select j.id,j.run_generation
    from public.capability_first_service_collections p
    join public.analysis_jobs j on j.id=p.job_id and j.case_id=p.case_id
    join public.client_cases cc on cc.id=p.case_id and cc.user_id=p.user_id and cc.status='active'
    join public.workflow_charges c on c.analysis_job_id=j.id and c.user_id=p.user_id and c.case_id=p.case_id
      and c.workflow_kind='verified' and c.state='reserved'
    left join public.capability_first_service_runs r on r.job_id=j.id
    where j.status in ('queued','running') and j.deadline_at>now() and j.report_id is null and j.capability_report_id is null
      and exists(select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.kind='verified_debit' and l.delta=-1)
      and (exists(select 1 from public.analysis_input_manifests m where m.job_id=j.id)
        or (j.attempt_count<p_max_attempts and (r.job_id is null or r.lease_until<=now())))
    order by j.created_at,j.id limit p_limit;
end; $$;
revoke all on function public.list_v22_first_service_preparation_work(integer,integer) from public,anon,authenticated;
grant execute on function public.list_v22_first_service_preparation_work(integer,integer) to service_role;
commit;
