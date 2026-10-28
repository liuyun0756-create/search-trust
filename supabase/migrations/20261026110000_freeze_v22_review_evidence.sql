begin;

-- Internal historical evidence only. No route, paid job, provider call or charge.
create table public.capability_review_evidence_bundles (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  delivery_id uuid not null references public.report_content_revisions(id),
  delivery_revision integer not null check(delivery_revision>0),
  implementation_id uuid not null,
  implementation_revision integer not null,
  selection jsonb not null,
  bundle jsonb not null,
  bundle_text text not null check(octet_length(bundle_text)<=2000000),
  canonical_core text not null,
  canonical_bundle text not null,
  evidence_checksum text not null check(evidence_checksum ~ '^sha256:[a-f0-9]{64}$'),
  checksum text not null check(checksum ~ '^sha256:[a-f0-9]{64}$'),
  evaluated_at timestamptz not null,
  frozen_at timestamptz not null default clock_timestamp(),
  foreign key(implementation_id,implementation_revision) references public.capability_implementation_records(id,revision)
);
alter table public.capability_review_evidence_bundles enable row level security;
revoke all on public.capability_review_evidence_bundles from public,anon,authenticated,service_role;
create index capability_review_evidence_owner on public.capability_review_evidence_bundles(user_id,case_id,frozen_at desc);
create trigger immutable_review_evidence before update or delete on public.capability_review_evidence_bundles
  for each row execute function public.reject_v22_capability_mutation();

-- JSONB alone discards duplicate object keys. Inspect the transport before conversion.
create function public.v22_review_unique_json(p_value json,p_depth integer default 0) returns boolean
language plpgsql immutable strict set search_path=public as $$
declare item json;
begin
  if p_depth>64 then return false; end if;
  if json_typeof(p_value)='object' then
    if (select count(*)<>count(distinct key) from json_each(p_value)) then return false; end if;
    for item in select value from json_each(p_value) loop
      if not public.v22_review_unique_json(item,p_depth+1) then return false; end if;
    end loop;
  elsif json_typeof(p_value)='array' then
    for item in select value from json_array_elements(p_value) loop
      if not public.v22_review_unique_json(item,p_depth+1) then return false; end if;
    end loop;
  end if;
  return true;
end; $$;

-- Sort object keys by UTF-16 code units, as the existing Verified digest does.
create function public.v22_review_utf16(p_text text) returns integer[]
language plpgsql immutable strict set search_path=public as $$
declare result integer[]='{}'; n integer; c text;
begin
  for c in select regexp_split_to_table(p_text,'') loop
    n=ascii(c);
    if n<65536 then result=array_append(result,n);
    else result=result||array[55296+(n-65536)/1024,56320+(n-65536)%1024]; end if;
  end loop;
  return result;
end; $$;

-- Bounded Verified canonical JSON. Source transport is NOT replaced by this:
-- legacy snapshot hashes distinguish 3.0 and 3. Native tests check both encodings.
create function public.v22_review_canonical(p_value jsonb,p_depth integer default 0) returns text
language plpgsql immutable strict set search_path=public set extra_float_digits=3 as $$
declare kind text=jsonb_typeof(p_value); result text; n double precision; rendered text; exponent integer;
begin
  if p_depth>64 then raise exception 'REVIEW_INVALID'; end if;
  if kind='object' then
    select '{'||coalesce(string_agg(to_json(k)::text||':'||public.v22_review_canonical(v,p_depth+1),','
      order by public.v22_review_utf16(k)),'')||'}' into result from jsonb_each(p_value) e(k,v);
  elsif kind='array' then
    select '['||coalesce(string_agg(public.v22_review_canonical(v,p_depth+1),',' order by ordinal),'')||']'
      into result from jsonb_array_elements(p_value) with ordinality e(v,ordinal);
  elsif kind='number' then
    n=(p_value::text)::double precision;
    if n in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then raise exception 'REVIEW_INVALID'; end if;
    if n=0 then return '0'; end if;
    rendered=n::text;
    if abs(n)>=0.000001 and abs(n)<1e21 then result=trim_scale(rendered::numeric)::text;
    elsif position('e' in rendered)>0 then
      exponent=split_part(rendered,'e',2)::integer;
      result=split_part(rendered,'e',1)||'e'||case when exponent>=0 then '+' else '-' end||abs(exponent)::text;
    else result=rendered; end if;
  else result=p_value::text;
  end if;
  return result;
end; $$;

create function public.v22_review_hash(p_value jsonb) returns text
language sql immutable strict set search_path=public as $$
  select 'sha256:'||encode(sha256(convert_to(public.v22_review_canonical(p_value),'UTF8')),'hex');
$$;

create function public.v22_review_host(p_value text) returns text
language plpgsql immutable strict set search_path=public as $$
declare host text;
begin
  if p_value like 'sc-domain:%' then host=substr(p_value,11);
  elsif p_value ~ '^https?://[^/@?#:]+(:[0-9]+)?/?$' then
    host=substring(p_value from '^https?://([^/:]+)');
  elsif p_value !~ '[/@?#:]' then host=p_value;
  else raise exception 'REVIEW_INVALID'; end if;
  return regexp_replace(lower(rtrim(host,'.')),'^www\.','');
end; $$;

create function public.resolve_v22_review_evidence(p_user_id uuid,p_case_id uuid,p_selection jsonb,p_evaluated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.client_cases; r public.capability_report_versions; d public.report_content_revisions;
  i public.capability_implementation_records; choice jsonb; action jsonb; selections jsonb='[]';
  page jsonb; job jsonb; gsc jsonb; ga4 jsonb; obs jsonb; ref jsonb; name text; site text; source jsonb;
  ordinal integer=0; binding jsonb;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if c.id is null then raise exception 'REVIEW_UNAVAILABLE'; end if;
  if p_selection is null or octet_length(p_selection::text)>32768 then raise exception 'REVIEW_TOO_LARGE'; end if;
  if not public.v22_page_keys(p_selection,array['report','delivery','implementation','actions'])
    or not public.v22_page_keys(p_selection->'report',array['id','checksum'])
    or not public.v22_page_keys(p_selection->'delivery',array['id','revision','checksum'])
    or not public.v22_page_keys(p_selection->'implementation',array['id','revision','checksum'])
    or jsonb_typeof(p_selection->'actions') is distinct from 'array'
    or p_evaluated_at is null or not isfinite(p_evaluated_at) then raise exception 'REVIEW_INVALID'; end if;
  if p_evaluated_at>clock_timestamp()+interval '1 minute' or p_evaluated_at<clock_timestamp()-interval '5 minutes'
    then raise exception 'REVIEW_STALE'; end if;
  if jsonb_array_length(p_selection->'actions')>3 then raise exception 'REVIEW_INVALID'; end if;
  foreach name in array array['delivery','implementation'] loop
    if jsonb_typeof(p_selection#>array[name,'revision']) is distinct from 'number'
      or p_selection#>>array[name,'revision'] !~ '^[1-9][0-9]*$' then raise exception 'REVIEW_INVALID'; end if;
  end loop;
  perform 1 from public.capability_report_versions where id=(p_selection#>>'{report,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id for share;
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,(p_selection#>>'{report,id}')::uuid);
  select * into d from public.report_content_revisions where id=(p_selection#>>'{delivery,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id and report_id=r.id and status='approved';
  select * into i from public.capability_implementation_records where id=(p_selection#>>'{implementation,id}')::uuid
    and revision=(p_selection#>>'{implementation,revision}')::integer and user_id=p_user_id and case_id=p_case_id
    and report_id=r.id and delivery_revision_id=d.id;
  if r.id is null or d.id is null or i.id is null or r.payload->>'report_type' is distinct from 'verified_execution'
    then raise exception 'REVIEW_UNAVAILABLE'; end if;
  if p_selection->'report' is distinct from jsonb_build_object('id',r.id,'checksum',r.payload_checksum)
    or p_selection->'delivery' is distinct from jsonb_build_object('id',d.id,'revision',d.revision,'checksum',public.v22_review_hash(d.content))
    or p_selection->'implementation' is distinct from jsonb_build_object('id',i.id,'revision',i.revision,'checksum',i.checksum)
    or d.content->>'source_checksum' is distinct from r.payload_checksum
    or i.payload->>'report_checksum' is distinct from r.payload_checksum
    or i.payload->'delivery_revision' is distinct from to_jsonb(d.revision)
    or i.recorded_at>p_evaluated_at or (r.payload->>'generated_at')::timestamptz>p_evaluated_at
    or jsonb_array_length(p_selection->'actions')<>jsonb_array_length(d.content->'actions')
    then raise exception 'REVIEW_INVALID'; end if;
  site=public.v22_review_host(r.payload#>>'{input_manifest,business,site_url}');
  ref=p_selection->'implementation';
  for choice in select value from jsonb_array_elements(p_selection->'actions') loop
    if not public.v22_page_keys(choice,array['action_id','page_current_id','page_previous_id','gsc_id','ga4_id'])
      or choice->'action_id' is distinct from d.content#>array['actions',ordinal::text,'id']
      or (choice->'page_current_id'='null'::jsonb and choice->'page_previous_id'<>'null'::jsonb)
      then raise exception 'REVIEW_INVALID'; end if;
    ordinal=ordinal+1; page='null'; gsc='null'; ga4='null';
    if choice->'page_current_id'<>'null'::jsonb then
      page='{}';
      foreach name in array array['current','previous'] loop
        obs='null';
        if choice->('page_'||name||'_id')<>'null'::jsonb then
          job=public.get_v22_page_check(p_user_id,p_case_id,(choice->>('page_'||name||'_id'))::uuid);
          obs=job->'observation';
          if job is null or job->>'status' is distinct from 'completed' or obs is null or obs='null'::jsonb
            or job->'selection'->'implementation' is distinct from ref
            or job#>'{selection,action_id}' is distinct from choice->'action_id'
            or obs->'id' is distinct from job->'id' or obs->'plan' is distinct from job->'plan'
            or (obs->>'observed_at')::timestamptz>p_evaluated_at
            or (job->>'completed_at')::timestamptz>p_evaluated_at then raise exception 'REVIEW_INVALID'; end if;
          binding=obs#>'{plan,binding}';
          if binding->>'report_id' is distinct from r.id::text or binding->>'delivery_revision_id' is distinct from d.id::text
            or binding->>'site_url' is distinct from r.payload#>>'{input_manifest,business,site_url}'
            or binding->>'implementation_checksum' is distinct from i.checksum then raise exception 'REVIEW_INVALID'; end if;
        end if;
        page=page||jsonb_build_object(name,obs);
      end loop;
    end if;
    if choice->'gsc_id'<>'null'::jsonb then
      gsc=public.get_v22_comparison(p_user_id,p_case_id,(choice->>'gsc_id')::uuid);
      if gsc is null or gsc#>'{request,implementation}' is distinct from i.payload
        or gsc#>'{request,action_id}' is distinct from choice->'action_id'
        or gsc#>>'{request,scope,source}' is distinct from 'gsc'
        or (gsc#>>'{request,evaluated_at}')::timestamptz>p_evaluated_at then raise exception 'REVIEW_INVALID'; end if;
      foreach name in array array['before','after'] loop
        source=gsc#>array['request',name];
        if source<>'null'::jsonb and public.v22_review_host(source->>'external_resource_id') is distinct from site
          then raise exception 'REVIEW_INVALID'; end if;
      end loop;
    end if;
    if choice->'ga4_id'<>'null'::jsonb then
      ga4=public.get_v22_ga4_collection(p_user_id,p_case_id,(choice->>'ga4_id')::uuid);
      if ga4 is null or ga4->>'status' is distinct from 'succeeded' or ga4->'record' is distinct from i.payload
        or ga4#>'{selection,action_id}' is distinct from choice->'action_id'
        or (ga4->>'completed_at')::timestamptz>p_evaluated_at
        or ga4->'collection' is null or ga4->'collection'='null'::jsonb
        or ga4#>'{collection,plan}' is distinct from ga4->'plan'
        or jsonb_array_length(ga4#>'{plan,scope,hosts}')=0 then raise exception 'REVIEW_INVALID'; end if;
      for name in select jsonb_array_elements_text(ga4#>'{plan,scope,hosts}') loop
        if public.v22_review_host(name) is distinct from site then raise exception 'REVIEW_INVALID'; end if;
      end loop;
    end if;
    selections=selections||jsonb_build_array(jsonb_build_object('action_id',choice->'action_id','page',page,'gsc',gsc,'ga4',ga4));
  end loop;
  return jsonb_build_object('case_updated_at',public.v22_page_time(c.updated_at),'core',jsonb_build_object(
    'user_id',p_user_id,'case_id',p_case_id,'evaluated_at',public.v22_page_time(p_evaluated_at),
    'rules_version','v22_review_projection_rules_v1','report',r.payload,'report_checksum',r.payload_checksum,
    'delivery_id',d.id,'delivery_revision',d.revision,'delivery',d.content,'delivery_checksum',public.v22_review_hash(d.content),
    'implementation',i.payload,'selections',selections));
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception 'REVIEW_INVALID';
end; $$;

create function public.get_v22_review_evidence(p_user_id uuid,p_case_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.capability_review_evidence_bundles;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  select * into b from public.capability_review_evidence_bundles where id=p_id and user_id=p_user_id and case_id=p_case_id;
  if b.id is null then return null; end if;
  if b.bundle_text::jsonb is distinct from b.bundle or b.bundle->>'checksum' is distinct from b.checksum
    or b.bundle->>'evidence_checksum' is distinct from b.evidence_checksum
    or public.v22_review_canonical(b.bundle-'checksum') is distinct from b.canonical_bundle
    or public.v22_review_canonical(b.bundle-array['schema_version','evidence_checksum','decisions','checksum']) is distinct from b.canonical_core
    or public.v22_review_hash(b.bundle-'checksum') is distinct from b.checksum
    or public.v22_review_hash(b.bundle-array['schema_version','evidence_checksum','decisions','checksum']) is distinct from b.evidence_checksum
    then raise exception 'REVIEW_INVALID'; end if;
  return jsonb_build_object('schema_version','v22_saved_review_evidence_v1','id',b.id,'user_id',b.user_id,'case_id',b.case_id,
    'selection',b.selection,'bundle_text',b.bundle_text,'frozen_at',public.v22_page_time(b.frozen_at));
end; $$;

create function public.freeze_v22_review_evidence(p_user_id uuid,p_case_id uuid,p_id uuid,p_selection jsonb,
  p_case_updated_at timestamptz,p_bundle_text text,p_canonical_core text,p_canonical_bundle text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare saved public.capability_review_evidence_bundles; expected jsonb; b jsonb; core jsonb;
begin
  if p_id is null then raise exception 'REVIEW_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('v22-review-evidence:'||p_id::text,0));
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
  select * into saved from public.capability_review_evidence_bundles where id=p_id;
  if saved.id is not null then
    if (saved.user_id,saved.case_id) is distinct from (p_user_id,p_case_id) then raise exception 'REVIEW_UNAVAILABLE'; end if;
    if saved.selection is distinct from p_selection then raise exception 'REVIEW_CONFLICT'; end if;
    return public.get_v22_review_evidence(p_user_id,p_case_id,p_id);
  end if;
  if p_bundle_text is null or p_canonical_core is null or p_canonical_bundle is null then raise exception 'REVIEW_INVALID'; end if;
  if greatest(octet_length(p_bundle_text),octet_length(p_canonical_core),octet_length(p_canonical_bundle))>2000000
    then raise exception 'REVIEW_TOO_LARGE'; end if;
  if not public.v22_review_unique_json(p_bundle_text::json) then raise exception 'REVIEW_INVALID'; end if;
  b=p_bundle_text::jsonb;
  if b->>'schema_version' is distinct from 'v22_review_evidence_bundle_v1' or b->'decisions' is distinct from '[]'::jsonb
    then raise exception 'REVIEW_INVALID'; end if;
  expected=public.resolve_v22_review_evidence(p_user_id,p_case_id,p_selection,(b->>'evaluated_at')::timestamptz);
  if p_case_updated_at is distinct from (expected->>'case_updated_at')::timestamptz then raise exception 'REVIEW_STALE'; end if;
  core=b-array['schema_version','evidence_checksum','decisions','checksum'];
  -- Accept only the canonical UTC spelling returned by the trusted resolver.
  if core::text is distinct from (expected->'core')::text or public.v22_review_canonical(core) is distinct from p_canonical_core
    or public.v22_review_canonical(b-'checksum') is distinct from p_canonical_bundle
    or b->>'evidence_checksum' is distinct from public.v22_review_hash(core)
    or b->>'checksum' is distinct from public.v22_review_hash(b-'checksum') then raise exception 'REVIEW_INVALID'; end if;
  insert into public.capability_review_evidence_bundles(id,user_id,case_id,report_id,delivery_id,delivery_revision,
    implementation_id,implementation_revision,selection,bundle,bundle_text,canonical_core,canonical_bundle,evidence_checksum,checksum,evaluated_at)
    values(p_id,p_user_id,p_case_id,(p_selection#>>'{report,id}')::uuid,(p_selection#>>'{delivery,id}')::uuid,
      (p_selection#>>'{delivery,revision}')::integer,(p_selection#>>'{implementation,id}')::uuid,
      (p_selection#>>'{implementation,revision}')::integer,p_selection,b,p_bundle_text,p_canonical_core,p_canonical_bundle,
      b->>'evidence_checksum',b->>'checksum',(b->>'evaluated_at')::timestamptz);
  return public.get_v22_review_evidence(p_user_id,p_case_id,p_id);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception 'REVIEW_INVALID';
end; $$;

revoke all on function public.v22_review_unique_json(json,integer) from public,anon,authenticated,service_role;
revoke all on function public.v22_review_utf16(text) from public,anon,authenticated,service_role;
revoke all on function public.v22_review_canonical(jsonb,integer) from public,anon,authenticated,service_role;
revoke all on function public.v22_review_hash(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.v22_review_host(text) from public,anon,authenticated,service_role;
revoke all on function public.resolve_v22_review_evidence(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.get_v22_review_evidence(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.freeze_v22_review_evidence(uuid,uuid,uuid,jsonb,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.resolve_v22_review_evidence(uuid,uuid,jsonb,timestamptz) to service_role;
grant execute on function public.get_v22_review_evidence(uuid,uuid,uuid) to service_role;
grant execute on function public.freeze_v22_review_evidence(uuid,uuid,uuid,jsonb,timestamptz,text,text,text) to service_role;
commit;
