begin;

-- Free, internal SEO statements. Never update evidence, reports, jobs or credits.
create table public.capability_review_decision_revisions (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  review_id uuid not null references public.capability_review_evidence_bundles(id),
  revision integer not null check(revision>0 and revision<2147483647),
  previous_id uuid references public.capability_review_decision_revisions(id),
  recorded_at timestamptz not null,
  request jsonb not null,
  payload jsonb not null check(octet_length(payload::text)<=131072),
  unique(review_id,revision),
  check((revision=1)=(previous_id is null))
);
alter table public.capability_review_decision_revisions enable row level security;
revoke all on public.capability_review_decision_revisions from public,anon,authenticated,service_role;
create trigger immutable_review_decision before update or delete on public.capability_review_decision_revisions
  for each row execute function public.reject_v22_capability_mutation();

-- Match Python's whitespace and plain-text rules without locale-dependent \s.
create function public.v22_decision_text(v jsonb, maximum integer) returns boolean
language plpgsql immutable set search_path=public as $$
declare s text; c text; n integer; has_content boolean=false;
begin
  if jsonb_typeof(v) is distinct from 'string' then return false; end if;
  s=v#>>'{}';
  if char_length(s)<1 or char_length(s)>maximum then return false; end if;
  for c in select regexp_split_to_table(s,'') loop
    n=ascii(c);
    if (n<32 and n not in (9,10)) or n=127 then return false; end if;
    if n not in (9,10,11,12,13,28,29,30,31,32,133,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288)
      then has_content=true; end if;
  end loop;
  return has_content;
end; $$;

create function public.v22_decision_basis(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_review_id uuid,p_lock boolean)
returns public.capability_review_evidence_bundles language plpgsql security definer set search_path=public as $$
declare b public.capability_review_evidence_bundles;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_DECISION_UNAVAILABLE'; end if;
  if p_lock then
    select * into b from public.capability_review_evidence_bundles where id=p_review_id and user_id=p_user_id
      and case_id=p_case_id and report_id=p_report_id for update;
  else
    select * into b from public.capability_review_evidence_bundles where id=p_review_id and user_id=p_user_id
      and case_id=p_case_id and report_id=p_report_id;
  end if;
  if b.id is null then raise exception 'REVIEW_DECISION_UNAVAILABLE'; end if;
  -- Reuse historical integrity verification; do not resolve or re-collect sources.
  perform public.get_v22_review_evidence(p_user_id,p_case_id,p_review_id);
  if b.bundle->'decisions' is distinct from '[]'::jsonb
    or b.bundle#>>'{report,id}' is distinct from p_report_id::text then raise exception 'REVIEW_DECISION_INVALID'; end if;
  return b;
end; $$;

create function public.v22_normalize_decision_request(b jsonb, req jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare d jsonb; s jsonb; entry jsonb; r jsonb; action jsonb; name text; ref text;
  ids text[]='{}'; allowed text[]; original boolean; implemented boolean; edited boolean;
  ordered jsonb='[]'; normalized jsonb='[]'; refs jsonb; active_count integer=0;
begin
  if public.v22_page_keys(req,array['id','review_id','previous_id','previous_checksum','decisions']) is not true
    then raise exception 'REVIEW_DECISION_INVALID'; end if;
  foreach name in array array['id','review_id'] loop
    if jsonb_typeof(req->name) is distinct from 'string' or req->>name !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      then raise exception 'REVIEW_DECISION_INVALID'; end if;
    req=jsonb_set(req,array[name],to_jsonb((req->>name)::uuid::text));
  end loop;
  if (req->'previous_id'='null'::jsonb) is distinct from (req->'previous_checksum'='null'::jsonb)
    then raise exception 'REVIEW_DECISION_INVALID'; end if;
  if req->'previous_id'<>'null'::jsonb then
    if jsonb_typeof(req->'previous_id') is distinct from 'string'
      or req->>'previous_id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or jsonb_typeof(req->'previous_checksum') is distinct from 'string'
      or req->>'previous_checksum' !~ '^sha256:[a-f0-9]{64}$' then raise exception 'REVIEW_DECISION_INVALID'; end if;
    req=jsonb_set(req,'{previous_id}',to_jsonb((req->>'previous_id')::uuid::text));
    if req->'previous_id'=req->'id' then raise exception 'REVIEW_DECISION_INVALID'; end if;
  end if;
  if jsonb_typeof(req->'decisions') is distinct from 'array' then raise exception 'REVIEW_DECISION_INVALID'; end if;
  if jsonb_array_length(req->'decisions')>6 then raise exception 'REVIEW_DECISION_INVALID'; end if;
  for d in select value from jsonb_array_elements(req->'decisions') loop
    if public.v22_page_keys(d,array['source','action_id','disposition','reason','references','target','work','completion_statement','reconsider_when']) is not true
      or d->>'source' is distinct from 'seo_recorded' or jsonb_typeof(d->'source') is distinct from 'string'
      or jsonb_typeof(d->'disposition') is distinct from 'string'
      or d->>'disposition' not in ('continue','adjust','observe','defer','new')
      or not public.v22_decision_text(d->'action_id',200) or not public.v22_decision_text(d->'reason',1200)
      then raise exception 'REVIEW_DECISION_INVALID'; end if;
    if d->>'action_id'=any(ids) then raise exception 'REVIEW_DECISION_INVALID'; end if;
    ids=array_append(ids,d->>'action_id');
    if d->>'disposition'<>'defer' then active_count=active_count+1; end if;
    if active_count>3 then raise exception 'REVIEW_DECISION_INVALID'; end if;
    edited=d->>'disposition' in ('adjust','new');
    if edited then
      if not public.v22_decision_text(d->'target',2000) or not public.v22_decision_text(d->'work',4000)
        then raise exception 'REVIEW_DECISION_INVALID'; end if;
    elsif d->'target'<>'null'::jsonb or d->'work'<>'null'::jsonb then raise exception 'REVIEW_DECISION_INVALID'; end if;
    if d->>'disposition'='observe' then
      if not public.v22_decision_text(d->'completion_statement',1200) then raise exception 'REVIEW_DECISION_INVALID'; end if;
    elsif d->'completion_statement'<>'null'::jsonb then raise exception 'REVIEW_DECISION_INVALID'; end if;
    if d->>'disposition'='defer' then
      if not public.v22_decision_text(d->'reconsider_when',1200) then raise exception 'REVIEW_DECISION_INVALID'; end if;
    elsif d->'reconsider_when'<>'null'::jsonb then raise exception 'REVIEW_DECISION_INVALID'; end if;
    select exists(select 1 from jsonb_array_elements(b#>'{delivery,actions}') a where a->'id'=d->'action_id') into original;
    if (d->>'disposition'='new')=original then raise exception 'REVIEW_DECISION_INVALID'; end if;
    select exists(select 1 from jsonb_array_elements(b#>'{implementation,entries}') e where e->'action_id'=d->'action_id') into implemented;
    if d->>'disposition'='observe' and not implemented then raise exception 'REVIEW_DECISION_INVALID'; end if;
    if jsonb_typeof(d->'references') is distinct from 'array' then raise exception 'REVIEW_DECISION_INVALID'; end if;
    if jsonb_array_length(d->'references')>12 or (edited and jsonb_array_length(d->'references')=0)
      or (select count(*)<>count(distinct value) from jsonb_array_elements(d->'references')) then raise exception 'REVIEW_DECISION_INVALID'; end if;
    allowed='{}';
    for s in select value from jsonb_array_elements(b->'selections') loop
      if d->>'disposition'<>'new' and s->'action_id'<>d->'action_id' then continue; end if;
      if exists(select 1 from jsonb_array_elements(b#>'{implementation,entries}') e where e->'action_id'=s->'action_id') then
        allowed=array_append(allowed,'implementation:'||(b#>>'{implementation,id}')||':'||(s->>'action_id'));
      end if;
      if s->'page'<>'null'::jsonb then
        allowed=array_append(allowed,'page:'||(s#>>'{page,current,id}'));
        if s#>'{page,previous}'<>'null'::jsonb then allowed=array_append(allowed,'page:'||(s#>>'{page,previous,id}')); end if;
      end if;
      foreach name in array array['gsc','ga4'] loop
        if s->name<>'null'::jsonb then allowed=array_append(allowed,name||':'||(s#>>array[name,'id'])); end if;
      end loop;
    end loop;
    for r in select value from jsonb_array_elements(d->'references') loop
      if not public.v22_decision_text(r,200) or not coalesce((r#>>'{}')=any(allowed),false) then raise exception 'REVIEW_DECISION_INVALID'; end if;
    end loop;
    select coalesce(jsonb_agg(value order by value#>>'{}' collate "C"),'[]') into refs from jsonb_array_elements(d->'references');
    normalized=normalized||jsonb_build_array(jsonb_set(d,'{references}',refs));
  end loop;
  for action in select value from jsonb_array_elements(b#>'{delivery,actions}') loop
    for d in select value from jsonb_array_elements(normalized) where value->'action_id'=action->'id' loop
      ordered=ordered||jsonb_build_array(d);
    end loop;
  end loop;
  for d in select value from jsonb_array_elements(normalized) where value->>'disposition'='new' loop
    ordered=ordered||jsonb_build_array(d);
  end loop;
  req=jsonb_set(req,'{decisions}',ordered);
  if octet_length(public.v22_review_canonical(req))>65536 then raise exception 'REVIEW_DECISION_TOO_LARGE'; end if;
  return req;
end; $$;

create function public.get_v22_review_decision(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_review_id uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.capability_review_evidence_bundles; d public.capability_review_decision_revisions; prev public.capability_review_decision_revisions;
begin
  b=public.v22_decision_basis(p_user_id,p_case_id,p_report_id,p_review_id,false);
  select * into d from public.capability_review_decision_revisions where id=p_id and user_id=p_user_id and case_id=p_case_id
    and report_id=p_report_id and review_id=p_review_id;
  if d.id is null then raise exception 'REVIEW_DECISION_UNAVAILABLE'; end if;
  if d.previous_id is not null then
    select * into prev from public.capability_review_decision_revisions where id=d.previous_id and review_id=d.review_id;
    if prev.id is null or prev.revision<>d.revision-1 or d.payload->>'previous_checksum' is distinct from prev.payload->>'checksum'
      then raise exception 'REVIEW_DECISION_INVALID'; end if;
  end if;
  if d.payload->>'checksum' is distinct from public.v22_review_hash(d.payload-'checksum')
    or d.payload->>'request_checksum' is distinct from public.v22_review_hash(d.request)
    or d.payload->>'evidence_checksum' is distinct from b.evidence_checksum or d.payload->>'bundle_checksum' is distinct from b.checksum
    or d.request is distinct from public.v22_normalize_decision_request(b.bundle,d.request)
    or d.request is distinct from jsonb_build_object('id',d.payload->'id','review_id',d.payload->'review_id',
      'previous_id',d.payload->'previous_id','previous_checksum',d.payload->'previous_checksum','decisions',d.payload->'decisions')
    or d.recorded_at<greatest(b.frozen_at,b.evaluated_at)
    or d.payload->>'id' is distinct from d.id::text or d.payload->>'user_id' is distinct from d.user_id::text
    or d.payload->>'case_id' is distinct from d.case_id::text or d.payload->>'report_id' is distinct from d.report_id::text
    or d.payload->>'review_id' is distinct from d.review_id::text or d.payload->'revision' is distinct from to_jsonb(d.revision)
    or d.payload->'previous_id' is distinct from coalesce(to_jsonb(d.previous_id),'null'::jsonb)
    or d.payload->>'recorded_at' is distinct from public.v22_page_time(d.recorded_at)
    then raise exception 'REVIEW_DECISION_INVALID'; end if;
  if octet_length(d.payload::text)>131072 then raise exception 'REVIEW_DECISION_TOO_LARGE'; end if;
  return d.payload;
end; $$;

create function public.save_v22_review_decision(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_review_id uuid,p_request_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.capability_review_evidence_bundles; req jsonb; saved public.capability_review_decision_revisions;
  head public.capability_review_decision_revisions; identifier uuid; at_time timestamptz; next_revision integer; payload jsonb;
begin
  if p_request_text is null then raise exception 'REVIEW_DECISION_INVALID'; end if;
  if octet_length(p_request_text)>65536 then raise exception 'REVIEW_DECISION_TOO_LARGE'; end if;
  if not public.v22_review_unique_json(p_request_text::json) then raise exception 'REVIEW_DECISION_INVALID'; end if;
  req=p_request_text::jsonb;
  -- The ID lock also serializes malicious reuse across different snapshots.
  identifier=(req->>'id')::uuid;
  if identifier is null then raise exception 'REVIEW_DECISION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('v22-review-decision:'||identifier::text,0));
  b=public.v22_decision_basis(p_user_id,p_case_id,p_report_id,p_review_id,true);
  req=public.v22_normalize_decision_request(b.bundle,req);
  if req->>'review_id' is distinct from p_review_id::text then raise exception 'REVIEW_DECISION_UNAVAILABLE'; end if;
  select * into saved from public.capability_review_decision_revisions where id=identifier;
  if saved.id is not null then
    if (saved.user_id,saved.case_id,saved.report_id) is distinct from (p_user_id,p_case_id,p_report_id)
      then raise exception 'REVIEW_DECISION_UNAVAILABLE'; end if;
    if saved.review_id<>p_review_id or saved.request is distinct from req then raise exception 'REVIEW_DECISION_CONFLICT'; end if;
    return public.get_v22_review_decision(p_user_id,p_case_id,p_report_id,p_review_id,identifier);
  end if;
  select * into head from public.capability_review_decision_revisions where review_id=p_review_id order by revision desc limit 1;
  if req->'previous_id' is distinct from coalesce(to_jsonb(head.id),'null'::jsonb)
    or req->'previous_checksum' is distinct from coalesce(head.payload->'checksum','null'::jsonb) then raise exception 'REVIEW_DECISION_STALE'; end if;
  if head.id is not null then perform public.get_v22_review_decision(p_user_id,p_case_id,p_report_id,p_review_id,head.id); end if;
  next_revision=coalesce(head.revision,0)+1;
  if next_revision>=2147483647 then raise exception 'REVIEW_DECISION_INVALID'; end if;
  at_time=clock_timestamp();
  if at_time<greatest(b.evaluated_at,b.frozen_at) then raise exception 'REVIEW_DECISION_STALE'; end if;
  payload=req||jsonb_build_object('schema_version','v22_review_decision_revision_v1','user_id',p_user_id,'case_id',p_case_id,
    'report_id',p_report_id,'evidence_checksum',b.evidence_checksum,'bundle_checksum',b.checksum,'revision',next_revision,
    'recorded_at',public.v22_page_time(at_time),'request_checksum',public.v22_review_hash(req));
  payload=payload||jsonb_build_object('checksum',public.v22_review_hash(payload));
  if octet_length(payload::text)>131072 then raise exception 'REVIEW_DECISION_TOO_LARGE'; end if;
  insert into public.capability_review_decision_revisions(id,user_id,case_id,report_id,review_id,revision,previous_id,recorded_at,request,payload)
    values(identifier,p_user_id,p_case_id,p_report_id,p_review_id,next_revision,head.id,at_time,req,payload);
  return payload;
exception when invalid_text_representation or numeric_value_out_of_range or character_not_in_repertoire or untranslatable_character then
  raise exception 'REVIEW_DECISION_INVALID';
end; $$;

create function public.list_v22_review_decisions(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_review_id uuid,p_cursor integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.capability_review_evidence_bundles; d public.capability_review_decision_revisions; items jsonb='[]'; result jsonb; last_revision integer;
begin
  b=public.v22_decision_basis(p_user_id,p_case_id,p_report_id,p_review_id,false);
  if p_cursor is not null and (p_cursor<1 or p_cursor>=2147483647) then raise exception 'REVIEW_DECISION_INVALID'; end if;
  for d in select * from public.capability_review_decision_revisions where review_id=p_review_id and user_id=p_user_id
      and case_id=p_case_id and report_id=p_report_id and (p_cursor is null or revision<p_cursor) order by revision desc limit 20 loop
    perform public.get_v22_review_decision(p_user_id,p_case_id,p_report_id,p_review_id,d.id);
    items=items||jsonb_build_array(jsonb_build_object('id',d.id,'revision',d.revision,'previous_id',d.previous_id,
      'recorded_at',public.v22_page_time(d.recorded_at),'checksum',d.payload->'checksum','decision_count',jsonb_array_length(d.payload->'decisions')));
    last_revision=d.revision;
  end loop;
  result=jsonb_build_object('review_id',p_review_id,'report_id',p_report_id,'items',items,
    'next_cursor',case when jsonb_array_length(items)=20 and last_revision>1 then last_revision else null end);
  if octet_length(result::text)>32768 then raise exception 'REVIEW_DECISION_TOO_LARGE'; end if;
  return result;
end; $$;

revoke all on function public.v22_decision_text(jsonb,integer), public.v22_decision_basis(uuid,uuid,uuid,uuid,boolean),
  public.v22_normalize_decision_request(jsonb,jsonb), public.get_v22_review_decision(uuid,uuid,uuid,uuid,uuid),
  public.save_v22_review_decision(uuid,uuid,uuid,uuid,text), public.list_v22_review_decisions(uuid,uuid,uuid,uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.get_v22_review_decision(uuid,uuid,uuid,uuid,uuid),
  public.save_v22_review_decision(uuid,uuid,uuid,uuid,text), public.list_v22_review_decisions(uuid,uuid,uuid,uuid,integer) to service_role;

commit;
