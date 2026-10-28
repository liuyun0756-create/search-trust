begin;

-- Internal static-page checks only. No public route, dispatch, billing or source replacement.
create table public.capability_page_check_jobs (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  delivery_revision_id uuid not null references public.report_content_revisions(id),
  case_updated_at timestamptz not null,
  selection jsonb not null check(octet_length(selection::text)<=20480),
  plan jsonb not null check(octet_length(plan::text)<=65536),
  status text not null default 'queued' check(status in ('queued','running','completed','failed')),
  lease_id uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  error_code text check(error_code in ('PAGE_CHECK_SOURCE_CHANGED','PAGE_CHECK_EXPIRED','PAGE_CHECK_INTERRUPTED','PAGE_CHECK_FAILED')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check(num_nonnulls(lease_id,claimed_at,lease_expires_at) in (0,3)),
  check(status<>'queued' or lease_id is null),
  check(status not in ('running','completed') or lease_id is not null),
  check((status in ('completed','failed'))=(completed_at is not null)),
  check((status='failed')=(error_code is not null)),
  check(claimed_at>=created_at and lease_expires_at=claimed_at+interval '2 minutes'),
  check(completed_at>=created_at and completed_at>=claimed_at),
  check(status<>'completed' or completed_at<=lease_expires_at)
);
create unique index capability_page_check_active_case on public.capability_page_check_jobs(case_id) where status in ('queued','running');
create index capability_page_check_history on public.capability_page_check_jobs(user_id,case_id,created_at desc,id);
create table public.capability_page_observations (
  id uuid primary key references public.capability_page_check_jobs(id),
  payload jsonb not null check(octet_length(payload::text)<=65536),
  checksum text not null check(checksum ~ '^sha256:[a-f0-9]{64}$'),
  saved_at timestamptz not null
);
alter table public.capability_page_check_jobs enable row level security;
alter table public.capability_page_observations enable row level security;
revoke all on public.capability_page_check_jobs,public.capability_page_observations from public,anon,authenticated,service_role;
create trigger immutable_page_observation before update or delete on public.capability_page_observations
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_guard_page_check() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then raise exception 'PAGE_CHECK_IMMUTABLE'; end if;
  if old.status in ('completed','failed')
    or (to_jsonb(old)-array['status','lease_id','claimed_at','lease_expires_at','error_code','completed_at']) is distinct from
       (to_jsonb(new)-array['status','lease_id','claimed_at','lease_expires_at','error_code','completed_at'])
    or not((old.status='queued' and new.status in ('running','failed')) or (old.status='running' and new.status in ('completed','failed')))
    or (old.status='running' and (old.lease_id,old.claimed_at,old.lease_expires_at) is distinct from (new.lease_id,new.claimed_at,new.lease_expires_at))
    or (old.status='queued' and new.status='failed' and new.lease_id is not null)
    then raise exception 'PAGE_CHECK_IMMUTABLE'; end if;
  return new;
end; $$;
create trigger immutable_page_check before update or delete on public.capability_page_check_jobs
  for each row execute function public.v22_guard_page_check();

create function public.v22_page_check_coherent() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs; o public.capability_page_observations;
begin
  select * into j from public.capability_page_check_jobs where id=new.id;
  select * into o from public.capability_page_observations where id=new.id;
  if (j.status='completed') is distinct from (o.id is not null)
    or (o.id is not null and (o.payload->>'id' is distinct from j.id::text or o.payload->'plan' is distinct from j.plan
      or o.payload->>'checksum' is distinct from o.checksum or o.saved_at is distinct from j.completed_at))
    then raise exception 'PAGE_CHECK_INCOHERENT'; end if;
  return null;
end; $$;
create constraint trigger coherent_page_check after insert or update on public.capability_page_check_jobs
  deferrable initially deferred for each row execute function public.v22_page_check_coherent();
create constraint trigger coherent_page_observation after insert on public.capability_page_observations
  deferrable initially deferred for each row execute function public.v22_page_check_coherent();

create function public.v22_page_keys(v jsonb,keys text[]) returns boolean language sql immutable as $$
  select coalesce(jsonb_typeof(v)='object' and v ?& keys and v-keys='{}'::jsonb,false);
$$;
create function public.v22_page_time(v timestamptz) returns text language sql immutable as $$
  select to_char(v at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;
create function public.v22_page_url_valid(v text,site text) returns boolean language plpgsql immutable as $$
declare part text[]; decoded bytea=''::bytea; plain text; path text;
begin
  if v is null or site is null or length(v) not between 1 and 2000
    or site !~ '^https://[a-z0-9][a-z0-9.-]*/$' or left(v,length(site))<>site
    or v ~ '[[:space:][:cntrl:]?\\]' or v ~ '%([^0-9a-fA-F]|[0-9a-fA-F]([^0-9a-fA-F]|$)|$)' then return false; end if;
  for part in select regexp_matches(v,'%[0-9a-fA-F]{2}|[^%]','g') loop
    decoded=decoded||case when left(part[1],1)='%' then decode(substr(part[1],2),'hex') else convert_to(part[1],'UTF8') end;
  end loop;
  plain=convert_from(decoded,'UTF8');
  path=split_part(substr(plain,length(site)), '#',1);
  return plain !~ '[[:cntrl:]\\]' and path !~ '(^|/)[.]{1,2}(/|$)';
exception when others then return false;
end; $$;

-- Case -> report is also the order used before locking a page job. No HTTP in these transactions.
create function public.v22_page_check_source(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_current boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.client_cases; r public.capability_implementation_records; report public.capability_report_versions;
  d public.report_content_revisions; b public.case_business_scope_versions; ref jsonb; item jsonb;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if c.id is null then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  if not public.v22_page_keys(p_selection,array['implementation','action_id','target_url','conditions'])
    or octet_length(p_selection::text)>20480 or jsonb_typeof(p_selection->'action_id') is distinct from 'string'
    or length(p_selection->>'action_id') not between 1 and 200 or p_selection->>'action_id' !~ '\S'
    or p_selection->>'action_id' ~ '[[:cntrl:]]' or jsonb_typeof(p_selection->'target_url') is distinct from 'string'
    or jsonb_typeof(p_selection->'conditions') is distinct from 'array' then raise exception 'PAGE_CHECK_INVALID'; end if;
  ref=p_selection->'implementation';
  if not public.v22_page_keys(ref,array['id','revision','checksum']) then raise exception 'PAGE_CHECK_INVALID'; end if;
  select * into r from public.capability_implementation_records where id=(ref->>'id')::uuid
    and revision=(ref->>'revision')::integer and user_id=p_user_id and case_id=p_case_id;
  if r.id is null or ref is distinct from jsonb_build_object('id',r.id,'revision',r.revision,'checksum',r.checksum)
    then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  perform 1 from public.capability_report_versions where id=r.report_id for update;
  perform public.v22_implementation_source(p_user_id,p_case_id,r.report_id,r.delivery_revision_id);
  select * into report from public.get_v22_completed_capability_report(p_user_id,p_case_id,r.report_id);
  select * into d from public.report_content_revisions where id=r.delivery_revision_id;
  select * into b from public.case_business_scope_versions where id=(report.payload#>>'{input_manifest,business,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if b.id is null or b.scope is distinct from report.payload#>'{input_manifest,business}'
    or r.payload->>'report_checksum' is distinct from report.payload_checksum
    or r.payload->'delivery_revision' is distinct from to_jsonb(d.revision)
    or not exists(select 1 from jsonb_array_elements(r.payload->'entries') e where e->>'action_id'=p_selection->>'action_id')
    or not exists(select 1 from jsonb_array_elements(d.content->'actions') a where a->>'id'=p_selection->>'action_id')
    then raise exception 'PAGE_CHECK_SOURCE_CHANGED'; end if;
  if p_current and (exists(select 1 from public.capability_implementation_records where delivery_revision_id=r.delivery_revision_id and revision>r.revision)
    or exists(select 1 from public.case_business_scope_versions where case_id=p_case_id and revision>b.revision)
    or r.recorded_at>clock_timestamp() or c.updated_at>clock_timestamp()) then raise exception 'PAGE_CHECK_SOURCE_CHANGED'; end if;
  if not public.v22_page_url_valid(p_selection->>'target_url',b.scope->>'site_url')
    or jsonb_array_length(p_selection->'conditions') not between 1 and 5
    or (select count(distinct x->>'id') from jsonb_array_elements(p_selection->'conditions') x)<>jsonb_array_length(p_selection->'conditions')
    then raise exception 'PAGE_CHECK_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_selection->'conditions') loop
    if not public.v22_page_keys(item,array['id','kind','value'])
      or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[a-zA-Z0-9_-]{1,64}$'
      or jsonb_typeof(item->'kind') is distinct from 'string' or item->>'kind' not in ('text_present','link_present','anchor_present')
      or jsonb_typeof(item->'value') is distinct from 'string' or item->>'value' !~ '\S' or item->>'value' ~ '[[:cntrl:]]'
      or length(item->>'value') not between 1 and (case item->>'kind' when 'text_present' then 200 when 'anchor_present' then 128 else 2000 end)
      or (item->>'kind'='link_present' and not public.v22_page_url_valid(item->>'value',b.scope->>'site_url'))
      then raise exception 'PAGE_CHECK_INVALID'; end if;
  end loop;
  return jsonb_build_object('record',r.payload,'report',report.payload,'report_checksum',report.payload_checksum,
    'delivery',d.content,'delivery_id',d.id,'delivery_revision',d.revision,'business',b.scope,
    'case_updated_at',public.v22_page_time(c.updated_at));
end; $$;
create function public.resolve_v22_page_check_input(p_user_id uuid,p_case_id uuid,p_selection jsonb) returns jsonb
language sql security definer set search_path=public as $$
  select public.v22_page_check_source(p_user_id,p_case_id,p_selection,true);
$$;

create function public.v22_page_check_json(j public.capability_page_check_jobs) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('schema_version','v22_page_check_job_v1','id',j.id,'user_id',j.user_id,'case_id',j.case_id,
    'report_id',j.report_id,'delivery_revision_id',j.delivery_revision_id,'selection',j.selection,'plan',j.plan,
    'case_updated_at',public.v22_page_time(j.case_updated_at),'status',j.status,'lease_id',j.lease_id,
    'claimed_at',public.v22_page_time(j.claimed_at),'lease_expires_at',public.v22_page_time(j.lease_expires_at),
    'created_at',public.v22_page_time(j.created_at),'completed_at',public.v22_page_time(j.completed_at),'error_code',j.error_code,
    'observation',(select payload from public.capability_page_observations where id=j.id));
$$;
create function public.get_v22_page_check(p_user_id uuid,p_case_id uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare j public.capability_page_check_jobs;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  select * into j from public.capability_page_check_jobs where id=p_id and user_id=p_user_id and case_id=p_case_id;
  if j.id is null then return null; end if;
  perform public.v22_implementation_source(p_user_id,p_case_id,j.report_id,j.delivery_revision_id);
  return public.v22_page_check_json(j);
end; $$;
create function public.list_v22_page_checks(p_user_id uuid,p_case_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb='[]'; j public.capability_page_check_jobs;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  for j in select * from public.capability_page_check_jobs where user_id=p_user_id and case_id=p_case_id order by created_at desc,id limit 20 loop
    perform public.v22_implementation_source(p_user_id,p_case_id,j.report_id,j.delivery_revision_id);
    result=result||jsonb_build_array(jsonb_build_object('id',j.id,'user_id',j.user_id,'case_id',j.case_id,'report_id',j.report_id,
      'delivery_revision_id',j.delivery_revision_id,'status',j.status,'created_at',public.v22_page_time(j.created_at),
      'completed_at',public.v22_page_time(j.completed_at),'error_code',j.error_code));
  end loop;
  return result;
end; $$;

create function public.request_v22_page_check(p_user_id uuid,p_case_id uuid,p_id uuid,p_selection jsonb,p_plan jsonb,
  p_case_updated_at timestamptz,p_canonical_plan text,p_canonical_business text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare source jsonb; r jsonb; b jsonb; expected jsonb; j public.capability_page_check_jobs;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  select * into j from public.capability_page_check_jobs where id=p_id;
  if j.id is not null then
    if (j.user_id,j.case_id) is distinct from (p_user_id,p_case_id) then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
    if j.selection is distinct from p_selection then raise exception 'PAGE_CHECK_CONFLICT'; end if;
    return public.get_v22_page_check(p_user_id,p_case_id,p_id);
  end if;
  source=public.v22_page_check_source(p_user_id,p_case_id,p_selection,true); r=source->'record'; b=source->'business';
  if p_canonical_business is null or octet_length(p_canonical_business)>65536 or p_canonical_business::jsonb is distinct from b
    or p_case_updated_at is distinct from (source->>'case_updated_at')::timestamptz then raise exception 'PAGE_CHECK_SOURCE_CHANGED'; end if;
  expected=jsonb_build_object('user_id',p_user_id,'case_id',p_case_id,'report_id',r->'report_id','report_checksum',r->'report_checksum',
    'delivery_revision_id',r->'delivery_revision_id','delivery_revision',r->'delivery_revision',
    'implementation_id',r->'id','implementation_revision',r->'revision','implementation_checksum',r->'checksum',
    'implementation_recorded_at',r->'recorded_at','action_id',p_selection->'action_id','business_id',b->'id','business_revision',b->'revision',
    'business_checksum','sha256:'||encode(sha256(convert_to(p_canonical_business,'UTF8')),'hex'),'site_url',b->'site_url');
  if not public.v22_page_keys(p_plan,array['schema_version','rules_version','binding','target_url','conditions','checksum'])
    or p_plan->>'schema_version' is distinct from 'v22_page_implementation_plan_v1'
    or p_plan->>'rules_version' is distinct from 'v22_static_page_check_v1' or p_plan->'binding' is distinct from expected
    or p_plan->'target_url' is distinct from p_selection->'target_url' or p_plan->'conditions' is distinct from p_selection->'conditions'
    or p_canonical_plan is null or octet_length(p_canonical_plan)>65536 or octet_length(p_plan::text)>65536
    or p_plan-'checksum' is distinct from p_canonical_plan::jsonb
    or p_plan->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_plan,'UTF8')),'hex')
    then raise exception 'PAGE_CHECK_INVALID'; end if;
  insert into public.capability_page_check_jobs(id,user_id,case_id,report_id,delivery_revision_id,case_updated_at,selection,plan)
    values(p_id,p_user_id,p_case_id,(r->>'report_id')::uuid,(r->>'delivery_revision_id')::uuid,p_case_updated_at,p_selection,p_plan)
    on conflict(id) do nothing returning * into j;
  if j.id is null then raise exception 'PAGE_CHECK_UNAVAILABLE'; end if;
  return public.v22_page_check_json(j);
end; $$;

create function public.v22_lock_page_check(p_id uuid) returns public.capability_page_check_jobs
language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs;
begin
  select * into j from public.capability_page_check_jobs where id=p_id;
  if j.id is null then return null; end if;
  perform 1 from public.client_cases where id=j.case_id for update;
  perform 1 from public.capability_report_versions where id=j.report_id for update;
  select * into j from public.capability_page_check_jobs where id=p_id for update;
  return j;
end; $$;
create function public.v22_page_check_current(j public.capability_page_check_jobs) returns boolean
language plpgsql security definer set search_path=public as $$
declare source jsonb;
begin
  source=public.v22_page_check_source(j.user_id,j.case_id,j.selection,true);
  return (source->>'case_updated_at')::timestamptz=j.case_updated_at;
exception when others then return false;
end; $$;

create function public.expire_v22_page_check(p_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs;
begin
  j=public.v22_lock_page_check(p_id);
  if (j.status='queued' and j.created_at+interval '10 minutes'<=clock_timestamp())
    or (j.status='running' and j.lease_expires_at<=clock_timestamp()) then
    update public.capability_page_check_jobs set status='failed',completed_at=clock_timestamp(),
      error_code=case when j.status='queued' then 'PAGE_CHECK_EXPIRED' else 'PAGE_CHECK_INTERRUPTED' end where id=j.id;
    return true;
  end if;
  return false;
end; $$;
create function public.claim_v22_page_check(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs; stamp timestamptz;
begin
  j=public.v22_lock_page_check(p_id);
  if j.id is null or j.status<>'queued' then return null; end if;
  if public.expire_v22_page_check(j.id) then return null; end if;
  if not public.v22_page_check_current(j) then
    update public.capability_page_check_jobs set status='failed',completed_at=clock_timestamp(),error_code='PAGE_CHECK_SOURCE_CHANGED' where id=j.id;
    return null;
  end if;
  stamp=clock_timestamp();
  update public.capability_page_check_jobs set status='running',lease_id=gen_random_uuid(),claimed_at=stamp,lease_expires_at=stamp+interval '2 minutes'
    where id=j.id returning * into j;
  return public.v22_page_check_json(j);
end; $$;

create function public.finish_v22_page_check(p_id uuid,p_lease_id uuid,p_payload jsonb,p_canonical_payload text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs; item jsonb; i integer; stamp timestamptz; observed timestamptz;
begin
  j=public.v22_lock_page_check(p_id);
  if j.id is null or j.lease_id is distinct from p_lease_id or p_lease_id is null then raise exception 'PAGE_CHECK_LEASE_LOST'; end if;
  if j.status='completed' then
    if exists(select 1 from public.capability_page_observations where id=j.id and payload=p_payload) then return public.v22_page_check_json(j); end if;
    raise exception 'PAGE_CHECK_CONFLICT';
  end if;
  if j.status<>'running' then raise exception 'PAGE_CHECK_LEASE_LOST'; end if;
  if public.expire_v22_page_check(j.id) then
    select * into j from public.capability_page_check_jobs where id=p_id;
    return public.v22_page_check_json(j);
  end if;
  if not public.v22_page_check_current(j) then
    update public.capability_page_check_jobs set status='failed',completed_at=clock_timestamp(),error_code='PAGE_CHECK_SOURCE_CHANGED'
      where id=j.id returning * into j;
    return public.v22_page_check_json(j);
  end if;
  if not public.v22_page_keys(p_payload,array['schema_version','id','plan','observed_at','status','failure','failure_stage','http_status',
      'media_type','response_bytes','content_checksum','results','limitation','effect_conclusion','causal_eligible','checksum'])
    or p_payload->>'schema_version' is distinct from 'v22_page_implementation_observation_v1'
    or p_payload->>'id' is distinct from j.id::text or p_payload->'plan' is distinct from j.plan
    or p_canonical_payload is null or octet_length(p_canonical_payload)>65536 or octet_length(p_payload::text)>65536
    or p_payload-'checksum' is distinct from p_canonical_payload::jsonb
    or p_payload->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_payload,'UTF8')),'hex')
    or p_payload->>'limitation' is distinct from 'static_response_only_rendering_functionality_and_identity_not_verified'
    or p_payload->'effect_conclusion' is distinct from 'null'::jsonb or p_payload->'causal_eligible' is distinct from 'false'::jsonb
    or jsonb_typeof(p_payload->'observed_at') is distinct from 'string'
    or p_payload->>'observed_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    or p_payload->>'status' not in ('checked','unable_to_check') or jsonb_typeof(p_payload->'status') is distinct from 'string'
    or jsonb_typeof(p_payload->'results') is distinct from 'array'
    then raise exception 'PAGE_CHECK_INVALID'; end if;
  stamp=clock_timestamp(); observed=(p_payload->>'observed_at')::timestamptz;
  if observed<j.claimed_at or observed<(j.plan#>>'{binding,implementation_recorded_at}')::timestamptz or observed>stamp
    or jsonb_array_length(p_payload->'results')<>jsonb_array_length(j.plan->'conditions')
    or (p_payload->'http_status'<>'null'::jsonb and (jsonb_typeof(p_payload->'http_status') is distinct from 'number'
      or p_payload->>'http_status' !~ '^[1-5][0-9]{2}$'))
    or p_payload->'media_type' not in ('null'::jsonb,'"text/html"'::jsonb,'"application/xhtml+xml"'::jsonb)
    or (p_payload->'response_bytes'<>'null'::jsonb and (jsonb_typeof(p_payload->'response_bytes') is distinct from 'number'
      or p_payload->>'response_bytes' !~ '^[0-9]{1,7}$' or (p_payload->>'response_bytes')::integer>1048576))
    then raise exception 'PAGE_CHECK_INVALID'; end if;
  if p_payload->>'status'='checked' then
    if p_payload->'failure'<>'null'::jsonb or p_payload->'failure_stage'<>'null'::jsonb or p_payload->'http_status'<>'200'::jsonb
      or p_payload->'media_type'='null'::jsonb or p_payload->'response_bytes'='null'::jsonb or (p_payload->>'response_bytes')::integer<1
      or jsonb_typeof(p_payload->'content_checksum') is distinct from 'string' or p_payload->>'content_checksum' !~ '^sha256:[a-f0-9]{64}$'
      then raise exception 'PAGE_CHECK_INVALID'; end if;
  else
    if p_payload->'content_checksum'<>'null'::jsonb or jsonb_typeof(p_payload->'failure') is distinct from 'string'
      or p_payload->>'failure' not in ('unsafe_target','dns_unavailable','redirect_requires_confirmation','robots_unavailable',
        'robots_disallowed','robots_invalid','crawl_delay_exceeds_budget','page_timeout','http_error','http_status','content_unsupported',
        'response_too_large','empty_page','access_restricted','parse_failed')
      or p_payload->'failure_stage' not in ('"robots"'::jsonb,'"page"'::jsonb,'"check"'::jsonb)
      then raise exception 'PAGE_CHECK_INVALID'; end if;
  end if;
  for i in 0..jsonb_array_length(p_payload->'results')-1 loop
    item=p_payload->'results'->i;
    if not public.v22_page_keys(item,array['condition_id','state']) or item->'condition_id' is distinct from j.plan->'conditions'->i->'id'
      or (p_payload->>'status'='checked' and item->'state' not in ('"observed"'::jsonb,'"not_observed"'::jsonb))
      or (p_payload->>'status'='unable_to_check' and item->'state' is distinct from '"unable_to_check"'::jsonb)
      then raise exception 'PAGE_CHECK_INVALID'; end if;
  end loop;
  -- Recheck lease after validation, including any time spent waiting for locks.
  stamp=clock_timestamp();
  if public.expire_v22_page_check(j.id) then
    select * into j from public.capability_page_check_jobs where id=p_id;
    return public.v22_page_check_json(j);
  end if;
  insert into public.capability_page_observations(id,payload,checksum,saved_at) values(j.id,p_payload,p_payload->>'checksum',stamp);
  update public.capability_page_check_jobs set status='completed',completed_at=stamp where id=j.id returning * into j;
  return public.v22_page_check_json(j);
end; $$;
create function public.fail_v22_page_check(p_id uuid,p_lease_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare j public.capability_page_check_jobs;
begin
  j=public.v22_lock_page_check(p_id);
  if j.status='running' and j.lease_id=p_lease_id then
    if public.expire_v22_page_check(p_id) then return; end if;
    update public.capability_page_check_jobs set status='failed',completed_at=clock_timestamp(),error_code='PAGE_CHECK_FAILED' where id=p_id;
  end if;
end; $$;

-- All helpers/trigger functions are private; only narrowly scoped RPCs are executable.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('v22_guard_page_check','v22_page_check_coherent','v22_page_keys','v22_page_time',
      'v22_page_url_valid','v22_page_check_source','v22_page_check_json','v22_lock_page_check','v22_page_check_current',
      'resolve_v22_page_check_input','get_v22_page_check','list_v22_page_checks','request_v22_page_check',
      'claim_v22_page_check','finish_v22_page_check','fail_v22_page_check','expire_v22_page_check') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
  end loop;
end $$;
grant execute on function public.resolve_v22_page_check_input(uuid,uuid,jsonb),public.get_v22_page_check(uuid,uuid,uuid),
  public.list_v22_page_checks(uuid,uuid),public.request_v22_page_check(uuid,uuid,uuid,jsonb,jsonb,timestamptz,text,text),
  public.claim_v22_page_check(uuid),public.finish_v22_page_check(uuid,uuid,jsonb,text),public.fail_v22_page_check(uuid,uuid),
  public.expire_v22_page_check(uuid) to service_role;
commit;
