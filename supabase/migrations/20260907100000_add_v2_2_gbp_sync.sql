-- V22-062: user-requested, read-only GBP synchronization and 30-day Content cleanup.
-- Apply with GOOGLE_GBP_SYNC_ENABLED and V22_GBP_SYNC_ENABLED disabled.
begin;

alter table public.google_sync_jobs
  drop constraint google_sync_jobs_source_type_check,
  drop constraint google_sync_jobs_filter_hosts_check,
  add constraint google_sync_jobs_source_type_check
    check (source_type in ('gsc','ga4','gbp')),
  add constraint google_sync_jobs_filter_hosts_check check (
    (source_type in ('gsc','gbp') and filter_hosts is null) or
    (source_type='ga4' and cardinality(filter_hosts) between 1 and 2
      and array_position(filter_hosts,null) is null
      and length(array_to_string(filter_hosts,',')) between 1 and 510
      and array_to_string(filter_hosts,',') ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:,[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)?$')
  );

-- Tighten the existing one-way exception: raw GBP Content cannot be cleared
-- before the snapshot's declared expiry instant.
create or replace function public.enforce_v22_snapshot_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(
    new.id, new.case_id, new.binding_id, new.source_type, new.schema_version,
    new.coverage_start, new.coverage_end, new.fetched_at, new.expires_at,
    new.sync_trigger, new.health_status, new.health_reasons,
    new.normalized_payload, new.payload_checksum, new.provider_request_context,
    new.retention_policy, new.supersedes_snapshot_id, new.created_at
  ) is distinct from row(
    old.id, old.case_id, old.binding_id, old.source_type, old.schema_version,
    old.coverage_start, old.coverage_end, old.fetched_at, old.expires_at,
    old.sync_trigger, old.health_status, old.health_reasons,
    old.normalized_payload, old.payload_checksum, old.provider_request_context,
    old.retention_policy, old.supersedes_snapshot_id, old.created_at
  ) then
    raise exception using errcode = '23514', message = 'data snapshots are immutable';
  end if;

  if not (
    old.retention_policy = 'gbp_content_30d' and
    old.raw_payload is not null and new.raw_payload is null and
    old.raw_content_deleted_at is null and new.raw_content_deleted_at is not null and
    old.expires_at is not null and new.raw_content_deleted_at >= old.expires_at
  ) then
    raise exception using errcode = '23514', message = 'only one-way expired GBP raw content cleanup is allowed';
  end if;
  return new;
end;
$$;

create function public.request_v22_gbp_sync(
  p_user_id uuid,p_case_id uuid,p_binding_id uuid,p_request_key uuid
) returns public.google_sync_jobs language plpgsql security definer set search_path=public as $$
declare b public.case_source_bindings; c public.client_cases; j public.google_sync_jobs;
begin
  select * into b from public.case_source_bindings where id=p_binding_id;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.google_connections where id=b.connection_id and user_id=p_user_id and status='active'
    and granted_scopes @> array['openid','email','profile','https://www.googleapis.com/auth/business.manage'] for update;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'SYNC_FORBIDDEN' using errcode='42501'; end if;
  select * into b from public.case_source_bindings where id=p_binding_id and case_id=p_case_id and source_type='gbp'
    and is_active and identity_match_status='matched' and confirmed_at is not null for update;
  if not found then raise exception 'SYNC_BINDING_CHANGED' using errcode='40001'; end if;
  if b.external_resource_id !~ '^locations/[0-9]+$' then
    raise exception 'INVALID_GBP_LOCATION' using errcode='22023';
  end if;
  select * into j from public.google_sync_jobs where user_id=p_user_id and request_key=p_request_key;
  if found then
    if j.case_id<>p_case_id or j.binding_id<>p_binding_id or j.source_type<>'gbp' then
      raise exception 'SYNC_REQUEST_CONFLICT' using errcode='40001'; end if;
    return j;
  end if;
  select * into j from public.google_sync_jobs where binding_id=p_binding_id and status in ('queued','running');
  if found then raise exception 'SYNC_ALREADY_RUNNING' using errcode='P0060'; end if;
  insert into public.google_sync_jobs(user_id,case_id,binding_id,connection_id,source_type,resource_id,
    case_updated_at,request_key,coverage_end,filter_hosts)
    values(p_user_id,p_case_id,p_binding_id,b.connection_id,'gbp',b.external_resource_id,c.updated_at,p_request_key,
      (now() at time zone 'UTC')::date-3,null) returning * into j;
  return j;
end; $$;

create function public.lock_v22_gbp_sync(p_job_id uuid) returns public.google_sync_jobs
language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='gbp';
  if not found then return null; end if;
  perform 1 from public.google_connections where id=j.connection_id for update;
  perform 1 from public.client_cases where id=j.case_id for update;
  perform 1 from public.case_source_bindings where id=j.binding_id for update;
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='gbp' for update;
  return j;
end; $$;

create function public.valid_v22_gbp_sync(j public.google_sync_jobs) returns boolean
language sql volatile security definer set search_path=public as $$
  select j.source_type='gbp' and j.filter_hosts is null and j.resource_id ~ '^locations/[0-9]+$'
    and exists(select 1 from public.client_cases c
      join public.case_source_bindings b on b.case_id=c.id
      join public.google_connections g on g.id=b.connection_id
      where c.id=j.case_id and c.user_id=j.user_id and c.status='active' and c.updated_at=j.case_updated_at
        and b.id=j.binding_id and b.is_active and b.source_type='gbp' and b.identity_match_status='matched'
        and b.confirmed_at is not null and b.external_resource_id=j.resource_id
        and g.id=j.connection_id and g.user_id=j.user_id and g.status='active'
        and g.granted_scopes @> array['openid','email','profile','https://www.googleapis.com/auth/business.manage']);
$$;

create function public.claim_v22_gbp_sync(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  j:=public.lock_v22_gbp_sync(p_job_id);
  if j.id is null or j.status in ('succeeded','failed') or j.available_at>now()
    or (j.status='running' and j.lease_expires_at>now()) then return null; end if;
  if not public.valid_v22_gbp_sync(j) or j.attempt_count>=3 then
    update public.google_sync_jobs set status='failed',completed_at=now(),lease_id=null,lease_expires_at=null,
      error_code=case when j.attempt_count>=3 then 'SYNC_RETRY_EXHAUSTED' else 'SYNC_BINDING_CHANGED' end where id=j.id;
    return null;
  end if;
  update public.google_sync_jobs set status='running',attempt_count=attempt_count+1,
    lease_id=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',error_code=null
    where id=j.id returning * into j;
  return to_jsonb(j);
end; $$;

create function public.finish_v22_gbp_sync(
  p_job_id uuid,p_lease_id uuid,p_manifest jsonb,p_raw_payload jsonb,p_checksum text,p_health text,p_reasons jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs; previous_id uuid;
begin
  j:=public.lock_v22_gbp_sync(p_job_id);
  if j.status='succeeded' then return j.snapshot_id; end if;
  if j.id is null or j.status<>'running' or j.lease_id is distinct from p_lease_id or j.lease_expires_at<=now() then
    raise exception 'SYNC_LEASE_LOST' using errcode='40001'; end if;
  if not public.valid_v22_gbp_sync(j) then
    update public.google_sync_jobs set status='failed',completed_at=now(),lease_id=null,lease_expires_at=null,
      error_code='SYNC_BINDING_CHANGED' where id=j.id;
    return null;
  end if;
  if p_health is null or p_health not in ('healthy','unhealthy')
    or jsonb_typeof(p_reasons) is distinct from 'array'
    or jsonb_typeof(p_manifest) is distinct from 'object'
    or p_manifest->>'schema_version' is distinct from 'gbp_sync_v1'
    or p_manifest->>'resource_id' is distinct from j.resource_id
    or p_manifest#>>'{current,end_date}' is distinct from j.coverage_end::text
    or p_manifest#>>'{current,start_date}' is distinct from (j.coverage_end-89)::text
    or p_manifest#>>'{previous,end_date}' is distinct from (j.coverage_end-90)::text
    or p_manifest#>>'{previous,start_date}' is distinct from (j.coverage_end-179)::text
    or jsonb_typeof(p_manifest->'profile_checks') is distinct from 'object'
    or jsonb_typeof(p_manifest->'keywords') is distinct from 'object'
    or jsonb_typeof(p_manifest->'limitations') is distinct from 'array'
    or jsonb_typeof(p_raw_payload) is distinct from 'object'
    or jsonb_typeof(p_raw_payload->'business_information') is distinct from 'object'
    or p_raw_payload#>>'{business_information,name}' is distinct from j.resource_id
    or jsonb_typeof(p_raw_payload->'performance') is distinct from 'object'
    or jsonb_typeof(p_raw_payload->'keyword_pages') is distinct from 'array'
    or p_checksum is null or p_checksum !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'INVALID_SYNC_RESULT' using errcode='22023';
  end if;
  select id into previous_id from public.data_snapshots where binding_id=j.binding_id and source_type='gbp'
    order by fetched_at desc limit 1;
  insert into public.data_snapshots(id,case_id,binding_id,source_type,schema_version,coverage_start,coverage_end,
    expires_at,sync_trigger,health_status,health_reasons,normalized_payload,raw_payload,payload_checksum,
    provider_request_context,retention_policy,supersedes_snapshot_id)
    values(j.id,j.case_id,j.binding_id,'gbp','gbp_sync_v1',j.coverage_end-179,j.coverage_end,
      now()+interval '30 days','user_sync',p_health,p_reasons,p_manifest,p_raw_payload,p_checksum,
      jsonb_build_object('external_resource_id',j.resource_id,'api_mode','read_only','daily_metric_count',7,
        'keyword_page_limit',10,'case_updated_at',j.case_updated_at),'gbp_content_30d',previous_id);
  update public.case_source_bindings set health_status=p_health,health_reasons=p_reasons,last_synced_at=now()
    where id=j.binding_id;
  update public.google_sync_jobs set status='succeeded',snapshot_id=j.id,completed_at=now(),error_code=null,
    lease_id=null,lease_expires_at=null where id=j.id;
  return j.id;
end; $$;

create function public.fail_v22_gbp_sync(p_job_id uuid,p_lease_id uuid,p_code text,p_retryable boolean)
returns void language plpgsql security definer set search_path=public as $$
declare j public.google_sync_jobs;
begin
  select * into j from public.google_sync_jobs where id=p_job_id and source_type='gbp' for update;
  if not found or j.status<>'running' or j.lease_id is distinct from p_lease_id then return; end if;
  if p_code is null or p_code !~ '^SYNC_[A-Z0-9_]{1,70}$' then p_code:='SYNC_FAILED'; end if;
  update public.google_sync_jobs set status=case when p_retryable and j.attempt_count<3 then 'queued' else 'failed' end,
    available_at=now()+interval '30 seconds',lease_id=null,lease_expires_at=null,
    error_code=case when p_retryable and j.attempt_count>=3 then 'SYNC_RETRY_EXHAUSTED' else p_code end,
    completed_at=case when p_retryable and j.attempt_count<3 then null else now() end where id=j.id;
end; $$;

create function public.cleanup_v22_expired_gbp_content(
  p_now timestamptz default now(),p_batch_size integer default 100
) returns integer language plpgsql security definer set search_path=public as $$
declare target record; cleaned integer:=0;
begin
  if p_now is null or p_batch_size is null or p_batch_size<1 or p_batch_size>500 then
    raise exception 'INVALID_CLEANUP_REQUEST' using errcode='22023';
  end if;
  for target in
    select id,binding_id from public.data_snapshots
      where source_type='gbp' and retention_policy='gbp_content_30d' and raw_payload is not null and expires_at<=p_now
      order by expires_at,id limit p_batch_size for update skip locked
  loop
    update public.data_snapshots set raw_payload=null,raw_content_deleted_at=p_now where id=target.id;
    cleaned:=cleaned+1;
    update public.case_source_bindings b set health_status='expired',health_reasons='["GBP_CONTENT_EXPIRED"]'::jsonb
      where b.id=target.binding_id and b.is_active
        and target.id=(select s.id from public.data_snapshots s
          where s.binding_id=b.id and s.source_type='gbp' order by s.fetched_at desc,s.created_at desc,s.id desc limit 1);
  end loop;
  return cleaned;
end; $$;

revoke all on function public.request_v22_gbp_sync(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.lock_v22_gbp_sync(uuid) from public,anon,authenticated;
revoke all on function public.valid_v22_gbp_sync(public.google_sync_jobs) from public,anon,authenticated;
revoke all on function public.claim_v22_gbp_sync(uuid) from public,anon,authenticated;
revoke all on function public.finish_v22_gbp_sync(uuid,uuid,jsonb,jsonb,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.fail_v22_gbp_sync(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.cleanup_v22_expired_gbp_content(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.request_v22_gbp_sync(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.claim_v22_gbp_sync(uuid) to service_role;
grant execute on function public.finish_v22_gbp_sync(uuid,uuid,jsonb,jsonb,text,text,jsonb) to service_role;
grant execute on function public.fail_v22_gbp_sync(uuid,uuid,text,boolean) to service_role;
grant execute on function public.cleanup_v22_expired_gbp_content(timestamptz,integer) to service_role;

commit;

-- Rollback: disable both GBP sync flags and stop new dispatch. Keep this additive
-- schema and cleanup function until every restricted GBP Content row is cleared.
