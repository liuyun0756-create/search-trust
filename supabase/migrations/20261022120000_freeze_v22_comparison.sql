begin;

-- Free descriptive observations; no job, workflow charge or report is created.
create table public.capability_comparisons (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  implementation_id uuid not null,
  implementation_revision integer not null,
  before_snapshot_id uuid references public.data_snapshots(id),
  after_snapshot_id uuid references public.data_snapshots(id),
  selection jsonb not null,
  request jsonb not null,
  result jsonb not null,
  input_checksum text not null check(input_checksum ~ '^sha256:[a-f0-9]{64}$'),
  result_checksum text not null check(result_checksum ~ '^sha256:[a-f0-9]{64}$'),
  frozen_at timestamptz not null default clock_timestamp(),
  foreign key(implementation_id,implementation_revision) references public.capability_implementation_records(id,revision)
);
alter table public.capability_comparisons enable row level security;
revoke all on public.capability_comparisons from public,anon,authenticated,service_role;
grant select on public.capability_comparisons to service_role;
create index capability_comparisons_owner on public.capability_comparisons(user_id,case_id,frozen_at desc);
create trigger immutable_comparison before update or delete on public.capability_comparisons
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_comparison_owner(p_user_id uuid,p_case_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'COMPARISON_NOT_FOUND'; end if;
end; $$;

create function public.v22_lock_comparison_sources(p_user_id uuid,p_case_id uuid,p_selection jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  -- Same connection -> Case -> binding order as Google sync/revocation.
  perform 1 from public.google_connections g where g.user_id=p_user_id and g.id in (
    select b.connection_id from public.case_source_bindings b join public.data_snapshots s on s.binding_id=b.id
    where b.case_id=p_case_id and s.case_id=p_case_id
      and s.id in ((p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid)
  ) order by g.id for share;
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'COMPARISON_NOT_FOUND'; end if;
  perform 1 from public.case_source_bindings b where b.case_id=p_case_id and b.id in (
    select s.binding_id from public.data_snapshots s where s.case_id=p_case_id
      and s.id in ((p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid)
  ) order by b.id for share;
end; $$;

create function public.v22_comparison_snapshot(p_user_id uuid,p_case_id uuid,p_snapshot_id uuid,p_source text,p_current boolean,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.data_snapshots; b public.case_source_bindings; g public.google_connections; required_scope text;
begin
  if p_snapshot_id is null then return 'null'::jsonb; end if;
  select * into s from public.data_snapshots where id=p_snapshot_id and case_id=p_case_id for share;
  if s.id is null then raise exception 'COMPARISON_SOURCE_INVALID'; end if;
  select * into b from public.case_source_bindings where id=s.binding_id and case_id=p_case_id for share;
  select * into g from public.google_connections where id=b.connection_id and user_id=p_user_id for share;
  required_scope=case p_source when 'gsc' then 'https://www.googleapis.com/auth/webmasters.readonly'
    when 'ga4' then 'https://www.googleapis.com/auth/analytics.readonly' end;
  if b.id is null or g.id is null or required_scope is null or not(required_scope=any(g.granted_scopes))
    or g.status is distinct from 'active' or not b.is_active or b.disconnected_at is not null
    or b.identity_match_status is distinct from 'matched' or b.confirmed_by_user_id is distinct from p_user_id
    or b.confirmed_at is null or b.confirmed_at>p_evaluated_at
    or s.source_type is distinct from p_source or b.source_type is distinct from p_source
    or s.schema_version is distinct from (p_source||'_sync_v1')
    or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id
    or s.normalized_payload->>'resource_id' is distinct from b.external_resource_id
    or s.fetched_at>p_evaluated_at or s.expires_at is null or s.raw_payload is not null
    or s.retention_policy is distinct from 'standard' or s.health_status not in ('healthy','unhealthy')
    or s.coverage_start is null or s.coverage_end is null or s.coverage_start>s.coverage_end
    then raise exception 'COMPARISON_SOURCE_INVALID'; end if;
  if p_current and (s.expires_at<=p_evaluated_at or s.expires_at<=clock_timestamp()
    or b.health_status is distinct from s.health_status or b.health_reasons is distinct from s.health_reasons
    or exists(select 1 from public.data_snapshots newer where newer.binding_id=s.binding_id
      and (newer.fetched_at,newer.id)>(s.fetched_at,s.id))) then raise exception 'COMPARISON_SOURCE_CHANGED'; end if;
  return jsonb_build_object('snapshot_id',s.id,'case_id',s.case_id,'binding_id',s.binding_id,
    'source_type',s.source_type,'schema_version',s.schema_version,'fetched_at',s.fetched_at,'expires_at',s.expires_at,
    'identity_match_status',b.identity_match_status,'health_status',s.health_status,'health_reasons',s.health_reasons,
    'normalized_payload',s.normalized_payload,'raw_payload',null,'payload_checksum',s.payload_checksum,
    'external_resource_id',b.external_resource_id,'coverage_start',s.coverage_start,'coverage_end',s.coverage_end);
end; $$;

create function public.resolve_v22_comparison_input(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_implementation_records; ref jsonb; scope jsonb; f jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  if p_evaluated_at is null or not isfinite(p_evaluated_at) or p_evaluated_at>clock_timestamp()+interval '1 minute'
    or p_evaluated_at<clock_timestamp()-interval '5 minutes' or octet_length(p_selection::text)>20000
    or jsonb_typeof(p_selection) is distinct from 'object'
    or not(p_selection ?& array['implementation','action_id','days','scope','before_snapshot_id','after_snapshot_id','concurrent_changes'])
    or p_selection-array['implementation','action_id','days','scope','before_snapshot_id','after_snapshot_id','concurrent_changes']<>'{}'::jsonb
    or p_selection->'days' not in ('7'::jsonb,'14'::jsonb,'28'::jsonb,'90'::jsonb)
    or coalesce(p_selection->>'concurrent_changes','') not in ('unknown','reported','none_reported')
    or jsonb_typeof(p_selection->'action_id') is distinct from 'string'
    then raise exception 'COMPARISON_INVALID'; end if;
  ref=p_selection->'implementation'; scope=p_selection->'scope';
  if jsonb_typeof(ref) is distinct from 'object' or not(ref ?& array['id','revision','checksum'])
    or ref-array['id','revision','checksum']<>'{}'::jsonb
    or jsonb_typeof(scope) is distinct from 'object' or not(scope ?& array['source','dimension','key','channel','filters'])
    or scope-array['source','dimension','key','channel','filters']<>'{}'::jsonb
    or coalesce(scope->>'source','') not in ('gsc','ga4')
    or coalesce(scope->>'dimension','') not in ('property','page','query','device','country','landing_page')
    or coalesce(scope->>'channel','') not in ('all','organic_search')
    or (scope->>'source'='gsc' and scope->>'channel'<>'organic_search')
    or (scope->>'dimension'='property') is distinct from (scope->'key'='null'::jsonb)
    or (scope->>'dimension'<>'property' and (jsonb_typeof(scope->'key') is distinct from 'string' or length(scope->>'key') not between 1 and 2000))
    or jsonb_typeof(scope->'filters') is distinct from 'array' then raise exception 'COMPARISON_INVALID'; end if;
  if jsonb_array_length(scope->'filters')>4 then raise exception 'COMPARISON_INVALID'; end if;
  for f in select value from jsonb_array_elements(scope->'filters') loop
    if jsonb_typeof(f) is distinct from 'object' or not(f ?& array['dimension','value']) or f-array['dimension','value']<>'{}'::jsonb
      or coalesce(f->>'dimension','') not in ('page','query','device','country','landing_page')
      or jsonb_typeof(f->'value') is distinct from 'string' or length(f->>'value') not between 1 and 2000
      then raise exception 'COMPARISON_INVALID'; end if;
  end loop;
  perform public.v22_lock_comparison_sources(p_user_id,p_case_id,p_selection);
  select * into r from public.capability_implementation_records where id=(ref->>'id')::uuid and revision=(ref->>'revision')::integer
    and user_id=p_user_id and case_id=p_case_id;
  if r.id is null or ref is distinct from jsonb_build_object('id',r.id,'revision',r.revision,'checksum',r.checksum)
    or r.recorded_at>p_evaluated_at then raise exception 'COMPARISON_NOT_FOUND'; end if;
  perform public.v22_implementation_source(p_user_id,p_case_id,r.report_id,r.delivery_revision_id);
  if not exists(select 1 from jsonb_array_elements(r.payload->'entries') e where e->>'action_id'=p_selection->>'action_id')
    then raise exception 'COMPARISON_INVALID'; end if;
  return jsonb_build_object('schema_version','v22_comparison_request_v1','implementation',r.payload,
    'action_id',p_selection->'action_id','days',p_selection->'days','scope',scope,
    'evaluated_at',to_char(p_evaluated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'concurrent_changes',p_selection->'concurrent_changes',
    'before',public.v22_comparison_snapshot(p_user_id,p_case_id,(p_selection->>'before_snapshot_id')::uuid,scope->>'source',false,p_evaluated_at),
    'after',public.v22_comparison_snapshot(p_user_id,p_case_id,(p_selection->>'after_snapshot_id')::uuid,scope->>'source',true,p_evaluated_at));
end; $$;

create function public.get_v22_comparison(p_user_id uuid,p_case_id uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.capability_comparisons;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  select * into c from public.capability_comparisons where id=p_id and user_id=p_user_id and case_id=p_case_id;
  if c.id is null then return null; end if;
  perform public.v22_implementation_source(p_user_id,p_case_id,(c.request#>>'{implementation,report_id}')::uuid,
    (c.request#>>'{implementation,delivery_revision_id}')::uuid);
  return jsonb_build_object('schema_version','v22_frozen_comparison_v1','id',c.id,'user_id',c.user_id,'case_id',c.case_id,
    'selection',c.selection,'request',c.request,'result',c.result);
end; $$;

create function public.freeze_v22_comparison(p_user_id uuid,p_case_id uuid,p_id uuid,p_selection jsonb,
  p_request jsonb,p_canonical_request text,p_result jsonb,p_canonical_result text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved jsonb; expected jsonb; name text; actual jsonb; trusted jsonb; input_hash text;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  if p_id is null then raise exception 'COMPARISON_INVALID'; end if;
  -- Serialization does not reverse the Google connection/Case lock order.
  perform pg_advisory_xact_lock(hashtextextended('v22-comparison:'||p_id::text,0));
  saved=public.get_v22_comparison(p_user_id,p_case_id,p_id);
  if saved is not null then
    if saved->'selection' is distinct from p_selection then raise exception 'COMPARISON_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  if p_canonical_request is null or octet_length(p_canonical_request)>20000000
    or p_canonical_result is null or octet_length(p_canonical_result)>100000
    or p_request is distinct from p_canonical_request::jsonb
    or p_result-'checksum' is distinct from p_canonical_result::jsonb
    then raise exception 'COMPARISON_INVALID'; end if;
  input_hash='sha256:'||encode(sha256(convert_to(p_canonical_request,'UTF8')),'hex');
  expected=public.resolve_v22_comparison_input(p_user_id,p_case_id,p_selection,(p_request->>'evaluated_at')::timestamptz);
  -- Timestamps may use equivalent ISO encodings after strict model parsing.
  expected=jsonb_set(expected,'{evaluated_at}',p_request->'evaluated_at');
  foreach name in array array['before','after'] loop
    actual=p_request->name; trusted=expected->name;
    if trusted<>'null'::jsonb then
      if (actual->>'fetched_at')::timestamptz is distinct from (trusted->>'fetched_at')::timestamptz
        or (actual->>'expires_at')::timestamptz is distinct from (trusted->>'expires_at')::timestamptz
        then raise exception 'COMPARISON_SOURCE_CHANGED'; end if;
      expected=jsonb_set(expected,array[name],trusted||jsonb_build_object('fetched_at',actual->'fetched_at','expires_at',actual->'expires_at'));
    end if;
  end loop;
  if p_request is distinct from expected then raise exception 'COMPARISON_SOURCE_CHANGED'; end if;
  if jsonb_typeof(p_result) is distinct from 'object' or p_result->>'schema_version' is distinct from 'v22_comparison_result_v1'
    or p_result->>'ruleset_version' is distinct from 'v22_comparison_descriptive_v1'
    or p_result->>'input_checksum' is distinct from input_hash
    or p_result->'implementation' is distinct from p_selection->'implementation'
    or p_result->'action_id' is distinct from p_selection->'action_id' or p_result->'scope' is distinct from p_selection->'scope'
    or p_result->'evaluated_at' is distinct from p_request->'evaluated_at'
    or p_result#>'{windows,days}' is distinct from p_selection->'days'
    or p_result->>'effect_eligibility' is distinct from 'pending_metric_specific_calibration'
    or p_result->'effect_conclusion' is distinct from 'null'::jsonb or p_result->'causal_attribution' is distinct from 'false'::jsonb
    or coalesce(p_result->>'state','') not in ('waiting','insufficient','not_comparable','comparable')
    or jsonb_typeof(p_result->'metrics') is distinct from 'array'
    or (p_result->>'state'<>'comparable' and p_result->'metrics'<>'[]'::jsonb)
    or p_result->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_result,'UTF8')),'hex')
    then raise exception 'COMPARISON_INVALID'; end if;
  foreach name in array array['before','after'] loop
    actual=p_result->(name||'_source'); trusted=p_request->name;
    if trusted='null'::jsonb then
      if actual is distinct from 'null'::jsonb then raise exception 'COMPARISON_INVALID'; end if;
    elsif actual->'snapshot_id' is distinct from trusted->'snapshot_id' or actual->'binding_id' is distinct from trusted->'binding_id'
      or actual->'payload_checksum' is distinct from trusted->'payload_checksum'
      or actual->'resource_id' is distinct from trusted->'external_resource_id'
      or (actual->>'fetched_at')::timestamptz is distinct from (trusted->>'fetched_at')::timestamptz then
      raise exception 'COMPARISON_INVALID';
    end if;
  end loop;
  insert into public.capability_comparisons(id,user_id,case_id,implementation_id,implementation_revision,before_snapshot_id,after_snapshot_id,
    selection,request,result,input_checksum,result_checksum)
    values(p_id,p_user_id,p_case_id,(p_selection#>>'{implementation,id}')::uuid,(p_selection#>>'{implementation,revision}')::integer,
      (p_selection->>'before_snapshot_id')::uuid,(p_selection->>'after_snapshot_id')::uuid,p_selection,p_request,p_result,input_hash,p_result->>'checksum');
  return public.get_v22_comparison(p_user_id,p_case_id,p_id);
end; $$;

revoke all on function public.v22_comparison_owner(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.v22_lock_comparison_sources(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.v22_comparison_snapshot(uuid,uuid,uuid,text,boolean,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.resolve_v22_comparison_input(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.get_v22_comparison(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.freeze_v22_comparison(uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.resolve_v22_comparison_input(uuid,uuid,jsonb,timestamptz) to service_role;
grant execute on function public.get_v22_comparison(uuid,uuid,uuid) to service_role;
grant execute on function public.freeze_v22_comparison(uuid,uuid,uuid,jsonb,jsonb,text,jsonb,text) to service_role;
commit;
