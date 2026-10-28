begin;

-- Purpose-specific material: never participates in ordinary latest-sync selection.
create table public.capability_collection_jobs (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  binding_id uuid not null references public.case_source_bindings(id),
  connection_id uuid not null references public.google_connections(id),
  case_updated_at timestamptz not null,
  selection jsonb not null,
  record jsonb not null,
  plan jsonb not null,
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
  lease_id uuid,
  lease_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check((status='queued' and lease_id is null and lease_expires_at is null)
    or (status<>'queued' and lease_id is not null and lease_expires_at is not null))
);
create unique index capability_collection_active_binding on public.capability_collection_jobs(binding_id)
  where status in ('queued','running');
create index capability_collection_owner on public.capability_collection_jobs(user_id,case_id,created_at desc);
create table public.capability_collections (
  id uuid primary key references public.capability_collection_jobs(id),
  payload jsonb not null,
  checksum text not null check(checksum ~ '^sha256:[a-f0-9]{64}$'),
  collected_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '7 days'
);
alter table public.capability_collection_jobs enable row level security;
alter table public.capability_collections enable row level security;
revoke all on public.capability_collection_jobs,public.capability_collections from public,anon,authenticated,service_role;
grant select on public.capability_collection_jobs,public.capability_collections to service_role;
create trigger immutable_collection before update or delete on public.capability_collections
  for each row execute function public.reject_v22_capability_mutation();

-- Internal helpers are intentionally not executable by service_role.
create function public.v22_collection_json(j public.capability_collection_jobs) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('schema_version','v22_collection_job_v1','id',j.id,'user_id',j.user_id,'case_id',j.case_id,
    'connection_id',j.connection_id,'selection',j.selection,'record',j.record,'plan',j.plan,'status',j.status,
    'lease_id',j.lease_id,'lease_expires_at',to_char(j.lease_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'created_at',to_char(j.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'completed_at',to_char(j.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'error_code',j.error_code,'collection',(select payload from public.capability_collections where id=j.id));
$$;

create function public.resolve_v22_collection_input(p_user_id uuid,p_case_id uuid,p_selection jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.case_source_bindings; g public.google_connections; c public.client_cases;
  r public.capability_implementation_records; ref jsonb;
begin
  if jsonb_typeof(p_selection) is distinct from 'object'
    or not(p_selection ?& array['implementation','action_id','days','binding_id'])
    or p_selection-array['implementation','action_id','days','binding_id']<>'{}'::jsonb
    or octet_length(p_selection::text)>10000 or p_selection->'days' not in ('7','14','28','90')
    or jsonb_typeof(p_selection->'action_id') is distinct from 'string'
    then raise exception 'COLLECTION_INVALID'; end if;
  ref=p_selection->'implementation';
  select * into b from public.case_source_bindings where id=(p_selection->>'binding_id')::uuid;
  -- Shared global lock order with revocation and source replacement.
  select * into g from public.google_connections where id=b.connection_id for update;
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  select * into b from public.case_source_bindings where id=(p_selection->>'binding_id')::uuid for update;
  if c.id is null or b.id is null or g.id is null or b.case_id<>c.id or g.user_id<>p_user_id
    or g.status<>'active' or b.connection_id<>g.id or not b.is_active or b.disconnected_at is not null
    or b.source_type<>'gsc' or b.identity_match_status<>'matched' or b.confirmed_by_user_id is distinct from p_user_id
    or b.confirmed_at is null or b.confirmed_at>clock_timestamp()
    or not('https://www.googleapis.com/auth/webmasters.readonly'=any(g.granted_scopes))
    then raise exception 'COLLECTION_SOURCE_INVALID'; end if;
  select * into r from public.capability_implementation_records where id=(ref->>'id')::uuid
    and revision=(ref->>'revision')::integer and user_id=p_user_id and case_id=p_case_id;
  if r.id is null or ref is distinct from jsonb_build_object('id',r.id,'revision',r.revision,'checksum',r.checksum)
    or exists(select 1 from public.capability_implementation_records newer where newer.id=r.id and newer.revision>r.revision)
    or not exists(select 1 from jsonb_array_elements(r.payload->'entries') e where e->>'action_id'=p_selection->>'action_id')
    then raise exception 'COLLECTION_RECORD_CHANGED'; end if;
  perform public.v22_implementation_source(p_user_id,p_case_id,r.report_id,r.delivery_revision_id);
  return jsonb_build_object('record',r.payload,'resource_id',b.external_resource_id,'connection_id',g.id,
    'case_updated_at',c.updated_at,'prepared_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end; $$;

create function public.get_v22_collection(p_user_id uuid,p_case_id uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  select * into j from public.capability_collection_jobs where id=p_id and user_id=p_user_id and case_id=p_case_id;
  if j.id is null then return null; end if;
  perform public.v22_implementation_source(p_user_id,p_case_id,(j.record->>'report_id')::uuid,(j.record->>'delivery_revision_id')::uuid);
  return public.v22_collection_json(j);
end; $$;

create function public.request_v22_collection(p_user_id uuid,p_case_id uuid,p_id uuid,p_selection jsonb,p_plan jsonb,p_canonical_plan text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs; resolved jsonb; entry jsonb; first_day date; last_day date;
  local_day date; local_zone text; days integer; expected jsonb; prepared timestamptz; saved jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  if p_id is null then raise exception 'COLLECTION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('v22-collection:'||p_id::text,0));
  saved=public.get_v22_collection(p_user_id,p_case_id,p_id);
  if saved is not null then
    if saved->'selection' is distinct from p_selection then raise exception 'COLLECTION_CONFLICT'; end if;
    return saved;
  end if;
  resolved=public.resolve_v22_collection_input(p_user_id,p_case_id,p_selection);
  if p_canonical_plan is null or octet_length(p_canonical_plan)>20000
    or p_plan-'checksum' is distinct from p_canonical_plan::jsonb
    or p_plan->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_plan,'UTF8')),'hex')
    then raise exception 'COLLECTION_INVALID'; end if;
  prepared=(p_plan->>'prepared_at')::timestamptz;
  if prepared is null or not isfinite(prepared) or prepared>clock_timestamp()
    or prepared<clock_timestamp()-interval '5 minutes' or prepared<(resolved#>>'{record,recorded_at}')::timestamptz
    then raise exception 'COLLECTION_INVALID'; end if;
  select e into entry from jsonb_array_elements(resolved#>'{record,entries}') e where e->>'action_id'=p_selection->>'action_id';
  local_day=(entry->>'implemented_on')::date; local_zone=entry->>'timezone'; days=(p_selection->>'days')::integer;
  first_day=((local_day::timestamp at time zone local_zone) at time zone 'America/Los_Angeles')::date;
  last_day=((((local_day+1)::timestamp at time zone local_zone)-interval '1 microsecond') at time zone 'America/Los_Angeles')::date;
  if (prepared at time zone 'America/Los_Angeles')::date<=last_day+days then raise exception 'COLLECTION_WAITING'; end if;
  expected=jsonb_build_object('schema_version','v22_gsc_comparison_plan_v1','user_id',p_user_id,'case_id',p_case_id,
    'report_id',resolved#>'{record,report_id}','delivery_revision_id',resolved#>'{record,delivery_revision_id}',
    'implementation',p_selection->'implementation','action_id',p_selection->'action_id','binding_id',p_selection->'binding_id',
    'resource_id',resolved->'resource_id','prepared_at',p_plan->'prepared_at','state','collectable','expected_requests',12,
    'windows',jsonb_build_object('days',days,'timezone','America/Los_Angeles',
      'before',jsonb_build_object('start',first_day-days,'end',first_day-1),
      'excluded',jsonb_build_object('start',first_day,'end',last_day),
      'after',jsonb_build_object('start',last_day+1,'end',last_day+days)));
  if p_plan-'checksum' is distinct from expected then raise exception 'COLLECTION_INVALID'; end if;
  if exists(select 1 from public.capability_collection_jobs where binding_id=(p_selection->>'binding_id')::uuid and status in ('queued','running'))
    then raise exception 'COLLECTION_ALREADY_RUNNING'; end if;
  insert into public.capability_collection_jobs(id,user_id,case_id,binding_id,connection_id,case_updated_at,selection,record,plan)
    values(p_id,p_user_id,p_case_id,(p_selection->>'binding_id')::uuid,(resolved->>'connection_id')::uuid,
      (resolved->>'case_updated_at')::timestamptz,p_selection,resolved->'record',p_plan) returning * into j;
  return public.v22_collection_json(j);
end; $$;

create function public.v22_lock_collection(p_id uuid) returns public.capability_collection_jobs
language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs;
begin
  select * into j from public.capability_collection_jobs where id=p_id;
  if j.id is null then return null; end if;
  perform 1 from public.google_connections where id=j.connection_id for update;
  perform 1 from public.client_cases where id=j.case_id for update;
  perform 1 from public.case_source_bindings where id=j.binding_id for update;
  select * into j from public.capability_collection_jobs where id=p_id for update;
  return j;
end; $$;

create function public.v22_collection_valid(j public.capability_collection_jobs) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.client_cases c join public.case_source_bindings b on b.case_id=c.id
    join public.google_connections g on g.id=b.connection_id where c.id=j.case_id and c.user_id=j.user_id
      and c.status='active' and c.updated_at=j.case_updated_at and b.id=j.binding_id and b.is_active
      and b.disconnected_at is null and b.source_type='gsc' and b.identity_match_status='matched'
      and b.confirmed_by_user_id=j.user_id and b.confirmed_at<=clock_timestamp()
      and b.external_resource_id=j.plan->>'resource_id' and g.id=j.connection_id and g.user_id=j.user_id
      and g.status='active' and 'https://www.googleapis.com/auth/webmasters.readonly'=any(g.granted_scopes)) then return false; end if;
  begin
    perform public.v22_implementation_source(j.user_id,j.case_id,(j.record->>'report_id')::uuid,(j.record->>'delivery_revision_id')::uuid);
  exception when others then return false;
  end;
  return true;
end; $$;

create function public.claim_v22_collection(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs;
begin
  j=public.v22_lock_collection(p_id);
  if j.id is null or j.status in ('succeeded','failed') or (j.status='running' and j.lease_expires_at>clock_timestamp()) then return null; end if;
  -- Never repeat external calls after an uncertain attempt, even if Redis expired.
  if j.status='running' or not public.v22_collection_valid(j) then
    update public.capability_collection_jobs set status='failed',completed_at=clock_timestamp(),
      lease_id=coalesce(lease_id,gen_random_uuid()),lease_expires_at=coalesce(lease_expires_at,clock_timestamp()),
      error_code=case when j.status='running' then 'SYNC_INTERRUPTED' else 'SYNC_BINDING_CHANGED' end where id=j.id;
    return null;
  end if;
  update public.capability_collection_jobs set status='running',lease_id=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '5 minutes'
    where id=j.id returning * into j;
  return public.v22_collection_json(j);
end; $$;

create function public.finish_v22_collection(p_id uuid,p_lease_id uuid,p_payload jsonb,p_canonical_payload text,p_canonical_snapshot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_collection_jobs; existing jsonb;
begin
  j=public.v22_lock_collection(p_id);
  if j.id is null or p_lease_id is null or j.lease_id is distinct from p_lease_id then raise exception 'COLLECTION_LEASE_LOST'; end if;
  if j.status='succeeded' then
    select payload into existing from public.capability_collections where id=j.id;
    if existing is distinct from p_payload then raise exception 'COLLECTION_CONFLICT'; end if;
    return public.v22_collection_json(j);
  end if;
  if j.status<>'running' or j.lease_expires_at<=clock_timestamp() then raise exception 'COLLECTION_LEASE_LOST'; end if;
  if not public.v22_collection_valid(j) then
    update public.capability_collection_jobs set status='failed',error_code='SYNC_BINDING_CHANGED',completed_at=clock_timestamp() where id=j.id returning * into j;
    return public.v22_collection_json(j);
  end if;
  if p_canonical_payload is null or octet_length(p_canonical_payload)>2000000
    or p_canonical_snapshot is null or octet_length(p_canonical_snapshot)>2000000
    or p_payload->'snapshot' is distinct from p_canonical_snapshot::jsonb
    or p_payload->>'payload_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_snapshot,'UTF8')),'hex')
    or p_payload-array['schema_version','plan','state','snapshot','payload_checksum','health_status','health_reasons','checksum']<>'{}'::jsonb
    or p_payload-'checksum' is distinct from p_canonical_payload::jsonb
    or p_payload->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_payload,'UTF8')),'hex')
    or p_payload->>'schema_version' is distinct from 'v22_gsc_comparison_collection_v1'
    or p_payload->'plan' is distinct from j.plan or p_payload->>'state' is distinct from 'collected'
    or p_payload#>>'{snapshot,schema_version}' is distinct from 'gsc_sync_v1'
    or p_payload#>'{snapshot,resource_id}' is distinct from j.plan->'resource_id'
    or p_payload#>>'{snapshot,timezone}' is distinct from 'America/Los_Angeles'
    or p_payload#>'{snapshot,previous,start_date}' is distinct from j.plan#>'{windows,before,start}'
    or p_payload#>'{snapshot,previous,end_date}' is distinct from j.plan#>'{windows,before,end}'
    or p_payload#>'{snapshot,current,start_date}' is distinct from j.plan#>'{windows,after,start}'
    or p_payload#>'{snapshot,current,end_date}' is distinct from j.plan#>'{windows,after,end}'
    or coalesce(p_payload->>'health_status','') not in ('healthy','unhealthy')
    or jsonb_typeof(p_payload->'health_reasons') is distinct from 'array'
    or coalesce(p_payload->>'payload_checksum','') !~ '^sha256:[a-f0-9]{64}$'
    then raise exception 'COLLECTION_INVALID'; end if;
  insert into public.capability_collections(id,payload,checksum) values(j.id,p_payload,p_payload->>'checksum');
  update public.capability_collection_jobs set status='succeeded',completed_at=clock_timestamp(),error_code=null where id=j.id returning * into j;
  return public.v22_collection_json(j);
end; $$;

create function public.fail_v22_collection(p_id uuid,p_lease_id uuid,p_code text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if p_code is null or p_code not in ('SYNC_TIMEOUT','SYNC_FAILED','SYNC_INTERRUPTED','SYNC_COST_LIMIT',
    'SYNC_COST_LEDGER_REQUIRED','SYNC_GOOGLE_TOKEN_EXPIRED','SYNC_GOOGLE_ACCESS_DENIED','SYNC_GOOGLE_UNAVAILABLE',
    'SYNC_GOOGLE_REJECTED','SYNC_AUTH_REQUIRED','SYNC_BROKER_UNAVAILABLE','SYNC_BINDING_CHANGED') then p_code='SYNC_FAILED'; end if;
  update public.capability_collection_jobs set status='failed',error_code=p_code,completed_at=clock_timestamp()
    where id=p_id and status='running' and lease_id=p_lease_id and lease_expires_at>clock_timestamp();
end; $$;

revoke all on function public.v22_collection_json(public.capability_collection_jobs) from public,anon,authenticated,service_role;
revoke all on function public.v22_lock_collection(uuid) from public,anon,authenticated,service_role;
revoke all on function public.v22_collection_valid(public.capability_collection_jobs) from public,anon,authenticated,service_role;
revoke all on function public.resolve_v22_collection_input(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_v22_collection(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.request_v22_collection(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.claim_v22_collection(uuid) from public,anon,authenticated;
revoke all on function public.finish_v22_collection(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.fail_v22_collection(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_v22_collection_input(uuid,uuid,jsonb) to service_role;
grant execute on function public.get_v22_collection(uuid,uuid,uuid) to service_role;
grant execute on function public.request_v22_collection(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
grant execute on function public.claim_v22_collection(uuid) to service_role;
grant execute on function public.finish_v22_collection(uuid,uuid,jsonb,text,text) to service_role;
grant execute on function public.fail_v22_collection(uuid,uuid,text) to service_role;
commit;
