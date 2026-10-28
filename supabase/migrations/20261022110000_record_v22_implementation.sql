begin;

-- User-reported work is not an observed page change or a measured outcome.
create table public.capability_implementation_records (
  id uuid not null,
  revision integer not null check(revision>0),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  delivery_revision_id uuid not null references public.report_content_revisions(id),
  payload jsonb not null,
  checksum text not null check(checksum ~ '^sha256:[a-f0-9]{64}$'),
  recorded_at timestamptz not null,
  primary key(id,revision),
  unique(delivery_revision_id,revision)
);
alter table public.capability_implementation_records enable row level security;
revoke all on public.capability_implementation_records from public,anon,authenticated,service_role;
grant select on public.capability_implementation_records to service_role;
create trigger immutable_implementation_record before update or delete on public.capability_implementation_records
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_implementation_source(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.capability_report_versions; d public.report_content_revisions;
begin
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  select * into d from public.report_content_revisions where id=p_delivery_revision_id
    and user_id=p_user_id and case_id=p_case_id and report_id=p_report_id and status='approved';
  if r.id is null or r.payload->>'report_type' is distinct from 'verified_execution' or d.id is null
    or d.content->>'source_checksum' is distinct from r.payload_checksum then raise exception 'IMPLEMENTATION_SOURCE_NOT_FOUND'; end if;
  return jsonb_build_object('report_checksum',r.payload_checksum,'generated_at',r.payload->>'generated_at','delivery_revision',d.revision,'actions',d.content->'actions');
end; $$;

create function public.get_v22_implementation_records(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns setof public.capability_implementation_records language plpgsql stable security definer set search_path=public as $$
begin
  perform public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  return query select * from public.capability_implementation_records where user_id=p_user_id and case_id=p_case_id
    and report_id=p_report_id and delivery_revision_id=p_delivery_revision_id order by revision desc limit 20;
end; $$;

create function public.save_v22_implementation_record(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid,
  p_expected_revision integer,p_payload jsonb,p_canonical_content text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source jsonb; saved public.capability_implementation_records; item jsonb; implementation_date date; recording_time timestamptz;
begin
  -- Shared report lock serializes record roots and corrections; no credit ledger mutation.
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  source=public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483646
    or p_canonical_content is null or octet_length(p_canonical_content)>40000
    or jsonb_typeof(p_payload) is distinct from 'object'
    or not(p_payload ?& array['schema_version','id','user_id','case_id','report_id','report_checksum','delivery_revision_id','delivery_revision','revision','recorded_at','entries','checksum'])
    or p_payload-array['schema_version','id','user_id','case_id','report_id','report_checksum','delivery_revision_id','delivery_revision','revision','recorded_at','entries','checksum']<>'{}'::jsonb
    or p_payload->>'schema_version' is distinct from 'v22_implementation_record_v1'
    or jsonb_typeof(p_payload->'id') is distinct from 'string'
    or p_payload->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_payload->>'user_id' is distinct from p_user_id::text or p_payload->>'case_id' is distinct from p_case_id::text
    or p_payload->>'report_id' is distinct from p_report_id::text or p_payload->>'delivery_revision_id' is distinct from p_delivery_revision_id::text
    or p_payload->'delivery_revision' is distinct from source->'delivery_revision'
    or p_payload->>'report_checksum' is distinct from source->>'report_checksum'
    or p_payload->'revision' is distinct from to_jsonb(p_expected_revision+1)
    or p_payload-'checksum' is distinct from p_canonical_content::jsonb
    or p_payload->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex')
    or jsonb_typeof(p_payload->'entries') is distinct from 'array'
    or jsonb_typeof(p_payload->'recorded_at') is distinct from 'string'
    or coalesce(p_payload->>'recorded_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    then raise exception 'IMPLEMENTATION_INVALID'; end if;
  recording_time=(p_payload->>'recorded_at')::timestamptz;
  if recording_time>clock_timestamp()+interval '1 minute' or recording_time<clock_timestamp()-interval '5 minutes'
    or recording_time<(source->>'generated_at')::timestamptz
    or jsonb_array_length(p_payload->'entries')>3
    or (select count(distinct e->>'action_id') from jsonb_array_elements(p_payload->'entries') e)<>jsonb_array_length(p_payload->'entries')
    then raise exception 'IMPLEMENTATION_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_payload->'entries') loop
    if jsonb_typeof(item) is distinct from 'object'
      or not(item ?& array['action_id','scope','implemented_on','timezone','note','responsible'])
      or item-array['action_id','scope','implemented_on','timezone','note','responsible']<>'{}'::jsonb
      or not exists(select 1 from jsonb_array_elements(source->'actions') a where a->>'id'=item->>'action_id' and jsonb_typeof(item->'action_id')='string')
      or jsonb_typeof(item->'scope') is distinct from 'string' or length(item->>'scope') not between 1 and 2000 or item->>'scope' !~ '\S'
      or jsonb_typeof(item->'implemented_on') is distinct from 'string' or item->>'implemented_on' !~ '^[1-9]\d{3}-\d{2}-\d{2}$'
      or jsonb_typeof(item->'timezone') is distinct from 'string' or length(item->>'timezone')>100
      or item->>'timezone' !~ '^(UTC|[A-Za-z_+-]+(/[A-Za-z0-9_+.-]+)+)$'
      or not exists(select 1 from pg_timezone_names where name=item->>'timezone')
      or (item->'note'<>'null'::jsonb and (jsonb_typeof(item->'note') is distinct from 'string' or length(item->>'note') not between 1 and 2000 or item->>'note' !~ '\S'))
      or (item->'responsible'<>'null'::jsonb and (jsonb_typeof(item->'responsible') is distinct from 'string' or length(item->>'responsible') not between 1 and 200 or item->>'responsible' !~ '\S'))
      then raise exception 'IMPLEMENTATION_INVALID'; end if;
    implementation_date=(item->>'implemented_on')::date;
    if implementation_date>(recording_time at time zone (item->>'timezone'))::date then raise exception 'IMPLEMENTATION_INVALID'; end if;
  end loop;
  select * into saved from public.capability_implementation_records where delivery_revision_id=p_delivery_revision_id order by revision desc limit 1;
  -- Recover the immediately succeeding identical save, including its original server timestamp.
  if saved.revision=p_expected_revision+1 and saved.payload->'entries'=p_payload->'entries' then return saved.payload; end if;
  if coalesce(saved.revision,0)<>p_expected_revision then raise exception 'IMPLEMENTATION_CONFLICT' using errcode='40001'; end if;
  if saved.id is not null and (p_payload->>'id' is distinct from saved.id::text or recording_time<saved.recorded_at)
    then raise exception 'IMPLEMENTATION_INVALID'; end if;
  insert into public.capability_implementation_records(id,revision,user_id,case_id,report_id,delivery_revision_id,payload,checksum,recorded_at)
    values((p_payload->>'id')::uuid,p_expected_revision+1,p_user_id,p_case_id,p_report_id,p_delivery_revision_id,p_payload,p_payload->>'checksum',recording_time);
  return p_payload;
exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then raise exception 'IMPLEMENTATION_INVALID';
end; $$;

revoke all on function public.v22_implementation_source(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_v22_implementation_records(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_v22_implementation_record(uuid,uuid,uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_v22_implementation_records(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.save_v22_implementation_record(uuid,uuid,uuid,uuid,integer,jsonb,text) to service_role;
commit;
