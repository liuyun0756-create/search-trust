-- V22-061: GA4 user-requested synchronization on the existing durable lifecycle.
-- Apply with both GA4 sync flags disabled. Existing GSC rows remain valid.
begin;

alter table public.google_sync_jobs
  drop constraint google_sync_jobs_source_type_check,
  add column filter_hosts text[],
  add constraint google_sync_jobs_source_type_check
    check (source_type in ('gsc','ga4')),
  add constraint google_sync_jobs_filter_hosts_check check (
    (source_type='gsc' and filter_hosts is null) or
    (source_type='ga4' and cardinality(filter_hosts) between 1 and 2
      and array_position(filter_hosts,null) is null
      and length(array_to_string(filter_hosts,',')) between 1 and 510
      and array_to_string(filter_hosts,',') ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:,[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)?$')
  );

-- Once multiple sources share the table, a GSC claimant must ignore GA4 rows.
create or replace function public.lock_v22_gsc_sync(p_job_id uuid) returns public.google_sync_jobs
language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='gsc';
  if not found then return null; end if;
  perform 1 from public.google_connections where id=j.connection_id for update;
  perform 1 from public.client_cases where id=j.case_id for update;
  perform 1 from public.case_source_bindings where id=j.binding_id for update;
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='gsc' for update;
  return j;
end; $$;

create function public.request_v22_ga4_sync(
  p_user_id uuid,p_case_id uuid,p_binding_id uuid,p_request_key uuid,p_filter_hosts text[]
) returns public.google_sync_jobs language plpgsql security definer set search_path=public as $$
declare b public.case_source_bindings; c public.client_cases; j public.google_sync_jobs; expected_domain text;
begin
  select * into b from public.case_source_bindings where id=p_binding_id;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.google_connections where id=b.connection_id and user_id=p_user_id and status='active'
    and granted_scopes @> array['openid','email','profile','https://www.googleapis.com/auth/analytics.readonly'] for update;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  select * into b from public.case_source_bindings where id=p_binding_id and case_id=p_case_id and source_type='ga4'
    and is_active and identity_match_status='matched' and confirmed_at is not null for update;
  if not found then raise exception 'SYNC_BINDING_CHANGED' using errcode='40001'; end if;
  expected_domain:=lower(c.normalized_domain);
  if b.external_resource_id !~ '^properties/[0-9]+$' or cardinality(p_filter_hosts) not between 1 and 2
    or p_filter_hosts[1] is distinct from expected_domain
    or (cardinality(p_filter_hosts)=2 and p_filter_hosts[2] is distinct from 'www.'||expected_domain) then
    raise exception 'INVALID_HOST_FILTER' using errcode='22023';
  end if;
  select * into j from public.google_sync_jobs where user_id=p_user_id and request_key=p_request_key;
  if found then
    if j.case_id<>p_case_id or j.binding_id<>p_binding_id or j.source_type<>'ga4'
      or j.filter_hosts is distinct from p_filter_hosts then
      raise exception 'SYNC_REQUEST_CONFLICT' using errcode='40001'; end if;
    return j;
  end if;
  select * into j from public.google_sync_jobs where binding_id=p_binding_id and status in ('queued','running');
  if found then raise exception 'SYNC_ALREADY_RUNNING' using errcode='P0060'; end if;
  insert into public.google_sync_jobs(user_id,case_id,binding_id,connection_id,source_type,resource_id,
    case_updated_at,request_key,coverage_end,filter_hosts)
    values(p_user_id,p_case_id,p_binding_id,b.connection_id,'ga4',b.external_resource_id,c.updated_at,p_request_key,
      (now() at time zone 'UTC')::date-2,p_filter_hosts) returning * into j;
  return j;
end; $$;

create function public.lock_v22_ga4_sync(p_job_id uuid) returns public.google_sync_jobs
language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='ga4';
  if not found then return null; end if;
  perform 1 from public.google_connections where id=j.connection_id for update;
  perform 1 from public.client_cases where id=j.case_id for update;
  perform 1 from public.case_source_bindings where id=j.binding_id for update;
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='ga4' for update;
  return j;
end; $$;

create function public.valid_v22_ga4_sync(j public.google_sync_jobs) returns boolean
language sql volatile security definer set search_path=public as $$
  select j.source_type='ga4' and exists(select 1 from public.client_cases c
    join public.case_source_bindings b on b.case_id=c.id
    join public.google_connections g on g.id=b.connection_id
    where c.id=j.case_id and c.user_id=j.user_id and c.status='active' and c.updated_at=j.case_updated_at
      and b.id=j.binding_id and b.is_active and b.source_type='ga4' and b.identity_match_status='matched'
      and b.confirmed_at is not null and b.external_resource_id=j.resource_id
      and g.id=j.connection_id and g.user_id=j.user_id and g.status='active'
      and g.granted_scopes @> array['openid','email','profile','https://www.googleapis.com/auth/analytics.readonly']
      and cardinality(j.filter_hosts) between 1 and 2 and j.filter_hosts[1]=lower(c.normalized_domain)
      and (cardinality(j.filter_hosts)=1 or j.filter_hosts[2]='www.'||lower(c.normalized_domain)));
$$;

create function public.claim_v22_ga4_sync(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  j:=public.lock_v22_ga4_sync(p_job_id);
  if j.id is null or j.status in ('succeeded','failed') or j.available_at>now()
    or (j.status='running' and j.lease_expires_at>now()) then return null; end if;
  if not public.valid_v22_ga4_sync(j) or j.attempt_count>=3 then
    update public.google_sync_jobs set status='failed',completed_at=now(),lease_id=null,lease_expires_at=null,
      error_code=case when j.attempt_count>=3 then 'SYNC_RETRY_EXHAUSTED' else 'SYNC_BINDING_CHANGED' end where id=j.id;
    return null;
  end if;
  update public.google_sync_jobs set status='running',attempt_count=attempt_count+1,
    lease_id=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',error_code=null
    where id=j.id returning * into j;
  return to_jsonb(j);
end; $$;

create function public.finish_v22_ga4_sync(
  p_job_id uuid,p_lease_id uuid,p_payload jsonb,p_checksum text,p_health text,p_reasons jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs; previous_id uuid;
begin
  j:=public.lock_v22_ga4_sync(p_job_id);
  if j.status='succeeded' then return j.snapshot_id; end if;
  if j.id is null or j.status<>'running' or j.lease_id is distinct from p_lease_id or j.lease_expires_at<=now() then
    raise exception 'SYNC_LEASE_LOST' using errcode='40001'; end if;
  if not public.valid_v22_ga4_sync(j) then
    update public.google_sync_jobs set status='failed',completed_at=now(),lease_id=null,lease_expires_at=null,
      error_code='SYNC_BINDING_CHANGED' where id=j.id;
    return null;
  end if;
  if p_health is null or p_health not in ('healthy','unhealthy') or jsonb_typeof(p_reasons) is distinct from 'array'
    or p_payload->>'schema_version' is distinct from 'ga4_sync_v1'
    or p_payload->>'resource_id' is distinct from j.resource_id
    or p_payload->'host_filter' is distinct from to_jsonb(j.filter_hosts)
    or p_payload#>>'{current,end_date}' is distinct from j.coverage_end::text
    or p_payload#>>'{current,start_date}' is distinct from (j.coverage_end-89)::text
    or p_payload#>>'{previous,end_date}' is distinct from (j.coverage_end-90)::text
    or p_payload#>>'{previous,start_date}' is distinct from (j.coverage_end-179)::text
    or p_checksum is null or p_checksum !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'INVALID_SYNC_RESULT' using errcode='22023'; end if;
  select id into previous_id from public.data_snapshots where binding_id=j.binding_id and source_type='ga4'
    order by fetched_at desc limit 1;
  insert into public.data_snapshots(id,case_id,binding_id,source_type,schema_version,coverage_start,coverage_end,
    expires_at,sync_trigger,health_status,health_reasons,normalized_payload,payload_checksum,
    provider_request_context,supersedes_snapshot_id)
    values(j.id,j.case_id,j.binding_id,'ga4','ga4_sync_v1',j.coverage_end-179,j.coverage_end,
      now()+interval '7 days','user_sync',p_health,p_reasons,p_payload,p_checksum,
      jsonb_build_object('external_resource_id',j.resource_id,'platform','web','host_filter',j.filter_hosts,
        'landing_page_row_limit',500,'key_event_row_limit',200,'case_updated_at',j.case_updated_at),previous_id);
  update public.case_source_bindings set health_status=p_health,health_reasons=p_reasons,last_synced_at=now()
    where id=j.binding_id;
  update public.google_sync_jobs set status='succeeded',snapshot_id=j.id,completed_at=now(),error_code=null,
    lease_id=null,lease_expires_at=null where id=j.id;
  return j.id;
end; $$;

create function public.fail_v22_ga4_sync(p_job_id uuid,p_lease_id uuid,p_code text,p_retryable boolean)
returns void language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='ga4' for update;
  if not found or j.status<>'running' or j.lease_id is distinct from p_lease_id then return; end if;
  if p_code is null or p_code !~ '^SYNC_[A-Z0-9_]{1,70}$' then p_code:='SYNC_FAILED'; end if;
  update public.google_sync_jobs set status=case when p_retryable and j.attempt_count<3 then 'queued' else 'failed' end,
    available_at=now()+interval '30 seconds',lease_id=null,lease_expires_at=null,
    error_code=case when p_retryable and j.attempt_count>=3 then 'SYNC_RETRY_EXHAUSTED' else p_code end,
    completed_at=case when p_retryable and j.attempt_count<3 then null else now() end where id=j.id;
end; $$;

revoke all on function public.request_v22_ga4_sync(uuid,uuid,uuid,uuid,text[]) from public,anon,authenticated;
revoke all on function public.lock_v22_ga4_sync(uuid) from public,anon,authenticated;
revoke all on function public.valid_v22_ga4_sync(public.google_sync_jobs) from public,anon,authenticated;
revoke all on function public.claim_v22_ga4_sync(uuid) from public,anon,authenticated;
revoke all on function public.finish_v22_ga4_sync(uuid,uuid,jsonb,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.fail_v22_ga4_sync(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.request_v22_ga4_sync(uuid,uuid,uuid,uuid,text[]) to service_role;
grant execute on function public.claim_v22_ga4_sync(uuid) to service_role;
grant execute on function public.finish_v22_ga4_sync(uuid,uuid,jsonb,text,text,jsonb) to service_role;
grant execute on function public.fail_v22_ga4_sync(uuid,uuid,text,boolean) to service_role;

commit;

-- Rollback: keep GA4 jobs/snapshots for audit, disable GA4 flags and stop dispatch.
