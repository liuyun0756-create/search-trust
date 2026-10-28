-- Preserve shared source identity; give each Case its own storage reference.
begin;

create function public.v22_case_market_binding_id(p_case_id uuid,p_source_id uuid)
returns uuid language plpgsql immutable strict set search_path=public as $$
declare hash text; variant text;
begin
  -- RFC UUIDv3 URL namespace, matching Python uuid3. Not a content checksum.
  hash=md5(decode('6ba7b8119dad11d180b400c04fd430c8','hex')||
    convert_to('searchtrust:capability:serp-binding:'||p_case_id::text||':'||p_source_id::text,'UTF8'));
  variant=substr('89ab',((get_byte(decode(hash,'hex'),8)>>4)&3)+1,1);
  return (substr(hash,1,8)||'-'||substr(hash,9,4)||'-3'||substr(hash,14,3)||'-'||variant||substr(hash,18,3)||'-'||substr(hash,21,12))::uuid;
end;
$$;

create table public.capability_shared_market_origins (
  source_id uuid primary key,
  source_header jsonb not null check(jsonb_typeof(source_header)='object'),
  payload_checksum text not null check(payload_checksum ~ '^sha256:[a-f0-9]{64}$'),
  fetched_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>fetched_at)
);
create table public.capability_case_market_bindings (
  snapshot_id uuid primary key references public.data_snapshots(id) deferrable initially deferred,
  case_id uuid not null references public.client_cases(id),
  source_id uuid not null references public.capability_shared_market_origins(source_id),
  unique(case_id,source_id)
);
alter table public.capability_shared_market_origins enable row level security;
alter table public.capability_case_market_bindings enable row level security;
revoke all on public.capability_shared_market_origins,public.capability_case_market_bindings from public,anon,authenticated,service_role;
create trigger immutable_capability_market_origin before update or delete on public.capability_shared_market_origins
for each row execute function public.reject_v22_capability_mutation();
create trigger immutable_capability_market_binding before update or delete on public.capability_case_market_bindings
for each row execute function public.reject_v22_capability_mutation();

-- Keep the established preparation transaction intact behind a service-only wrapper.
alter function public.prepare_v22_capability_analysis_input(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)
rename to prepare_v22_capability_analysis_input_core;
revoke all on function public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)
from public,anon,authenticated,service_role;

create function public.prepare_v22_capability_analysis_input(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_manifest jsonb,p_manifest_canonical text,p_recipe jsonb,p_generation_canonical text,
  p_public_source_canonicals jsonb,p_previous_canonical text,p_run_generation integer)
returns table(manifest_id uuid,input_checksum text,generation_input_checksum text)
language plpgsql security definer set search_path=public as $$
declare full_input jsonb; pub jsonb; source jsonb; shared jsonb; header jsonb; ref jsonb; origin uuid; local_id uuid;
  saved public.capability_shared_market_origins; binding public.capability_case_market_bindings; legacy public.data_snapshots;
begin
  -- Preserve Case -> job -> source lock order, including leased worker callers.
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  perform 1 from public.analysis_jobs where id=p_job_id and case_id=p_case_id
    and run_generation=p_run_generation and status in ('queued','running') for update;
  if not found then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if p_generation_canonical is null or octet_length(p_generation_canonical)>20000000 then
    raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  for source in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    shared=source->'shared_snapshot';
    if shared is null or shared='null'::jsonb then continue; end if;
    if source->>'kind' is distinct from 'serp' or shared->>'schema_version' is distinct from 'competitor_shared_market_v1'
      or shared-array['schema_version','snapshot_id','source_job_id','input_digest','snapshot_checksum','created_at','expires_at','snapshot']<>'{}'::jsonb
      or source#>>'{payload,schema_version}' is distinct from 'serp_market_snapshot_v1'
      or shared->'snapshot' is distinct from source->'payload'
      or shared->>'source_job_id' is distinct from source#>>'{payload,job_id}'
      or coalesce(shared->>'input_digest','') !~ '^sha256:[a-f0-9]{64}$'
      or shared->>'snapshot_checksum' is distinct from source#>>'{binding,payload_checksum}'
      or (shared->>'expires_at')::timestamptz is distinct from (source#>>'{binding,expires_at}')::timestamptz
      or shared->>'created_at' is null or shared->>'source_job_id' is null
      or (shared->>'created_at')::timestamptz>(p_manifest->>'evaluated_at')::timestamptz
      or (shared->>'created_at')::timestamptz>=(shared->>'expires_at')::timestamptz
      or (shared->>'expires_at')::timestamptz<=now()
      or source#>>'{binding,case_id}' is distinct from p_case_id::text then
      raise exception 'CAPABILITY_SHARED_SOURCE_INVALID'; end if;
    origin=(shared->>'snapshot_id')::uuid;
    local_id=(source#>>'{binding,snapshot_id}')::uuid;
    if origin is null or local_id is null then raise exception 'CAPABILITY_SHARED_SOURCE_INVALID'; end if;
    -- Legacy recipes retain their direct source ID. New recipes must use the exact local reference.
    if local_id=origin then continue; end if;
    if local_id<>public.v22_case_market_binding_id(p_case_id,origin) then raise exception 'CAPABILITY_SHARED_BINDING_INVALID'; end if;
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'='serp';
    if ref->>'snapshot_id' is distinct from local_id::text then raise exception 'CAPABILITY_SHARED_BINDING_INVALID'; end if;
    select * into legacy from public.data_snapshots where id=origin;
    if legacy.id is not null and (legacy.source_type<>'serp' or legacy.payload_checksum is distinct from shared->>'snapshot_checksum'
      or legacy.normalized_payload is distinct from source->'payload'
      or legacy.fetched_at is distinct from (source#>>'{binding,fetched_at}')::timestamptz
      or legacy.expires_at is distinct from (shared->>'expires_at')::timestamptz) then
      raise exception 'CAPABILITY_SHARED_SOURCE_CONFLICT'; end if;
    header=shared-'snapshot';
    insert into public.capability_shared_market_origins(source_id,source_header,payload_checksum,fetched_at,expires_at)
      values(origin,header,shared->>'snapshot_checksum',(source#>>'{binding,fetched_at}')::timestamptz,(shared->>'expires_at')::timestamptz)
      on conflict(source_id) do nothing;
    select * into saved from public.capability_shared_market_origins where source_id=origin;
    if saved.source_header is distinct from header or saved.payload_checksum is distinct from shared->>'snapshot_checksum'
      or saved.fetched_at is distinct from (source#>>'{binding,fetched_at}')::timestamptz
      or saved.expires_at is distinct from (shared->>'expires_at')::timestamptz then
      raise exception 'CAPABILITY_SHARED_SOURCE_CONFLICT'; end if;
    insert into public.capability_case_market_bindings(snapshot_id,case_id,source_id) values(local_id,p_case_id,origin)
      on conflict(snapshot_id) do nothing;
    select * into binding from public.capability_case_market_bindings where snapshot_id=local_id;
    if binding.case_id is distinct from p_case_id or binding.source_id is distinct from origin then
      raise exception 'CAPABILITY_SHARED_BINDING_INVALID'; end if;
  end loop;
  return query select * from public.prepare_v22_capability_analysis_input_core(p_user_id,p_case_id,p_job_id,
    p_manifest,p_manifest_canonical,p_recipe,p_generation_canonical,p_public_source_canonicals,p_previous_canonical,p_run_generation);
end;
$$;
revoke all on function public.v22_case_market_binding_id(uuid,uuid) from public,anon,authenticated;
grant execute on function public.v22_case_market_binding_id(uuid,uuid) to service_role;
revoke all on function public.prepare_v22_capability_analysis_input(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.prepare_v22_capability_analysis_input(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer) to service_role;
commit;
