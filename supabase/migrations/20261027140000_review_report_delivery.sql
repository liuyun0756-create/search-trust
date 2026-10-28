begin;
create table public.capability_review_delivery_requests (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  revision_id uuid not null unique references public.report_content_revisions(id),
  request jsonb not null check(octet_length(request::text)<=100000)
);
alter table public.capability_review_delivery_requests enable row level security;
revoke all on public.capability_review_delivery_requests from public,anon,authenticated,service_role;
create trigger immutable_review_delivery_request before update or delete on public.capability_review_delivery_requests
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_check_review_delivery(p_content jsonb,p_report public.capability_report_versions) returns void
language plpgsql immutable set search_path=public as $$
declare a jsonb; original jsonb; x jsonb; k text; i integer=0;
begin
  if public.v22_page_keys(p_content,array['schema_version','report_id','user_id','case_id','expected_revision','source_checksum','status','title','summary','client_note','actions']) is not true
    or p_content->>'schema_version' is distinct from 'v22_review_delivery_revision_v1'
    or p_content->>'report_id' is distinct from p_report.id::text or p_content->>'user_id' is distinct from p_report.user_id::text
    or p_content->>'case_id' is distinct from p_report.case_id::text or p_content->>'source_checksum' is distinct from p_report.payload_checksum
    or p_content->>'status' not in ('draft','approved') or jsonb_typeof(p_content->'status') is distinct from 'string'
    or jsonb_typeof(p_content->'expected_revision') is distinct from 'number' or p_content->>'expected_revision' !~ '^(0|[1-9][0-9]{0,9})$'
    or (p_content->>'expected_revision')::bigint>=2147483646
    or not public.v22_decision_text(p_content->'title',200) or not public.v22_decision_text(p_content->'summary',2000)
    or (p_content->'client_note'<>'null'::jsonb and not public.v22_decision_text(p_content->'client_note',2000))
    or jsonb_typeof(p_content->'actions') is distinct from 'array' then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  if jsonb_array_length(p_content->'actions')<>jsonb_array_length(p_report.payload->'actions') then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  for a in select value from jsonb_array_elements(p_content->'actions') loop
    original=p_report.payload#>array['actions',i::text];
    if public.v22_page_keys(a,array['id','title','target','steps','completion','review','materials']) is not true
      or a->'id' is distinct from original->'id' or a->'materials' is distinct from original->'materials'
      or not public.v22_decision_text(a->'title',200) or not public.v22_decision_text(a->'target',2000)
      or not public.v22_decision_text(a->'review',2000) then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
    foreach k in array array['steps','completion'] loop
      if jsonb_typeof(a->k) is distinct from 'array' or jsonb_array_length(a->k) not between 1 and 12 then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
      for x in select value from jsonb_array_elements(a->k) loop
        if not public.v22_decision_text(x,case when k='steps' then 4000 else 2000 end) then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
      end loop;
    end loop;
    i=i+1;
  end loop;
end; $$;

create or replace function public.guard_v22_review_delivery_version() returns trigger
language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions;
begin
  select * into r from public.capability_report_versions where id=new.report_id and schema_version='2.2.3';
  if r.id is not null then
    if new.content->>'schema_version' is distinct from 'v22_review_delivery_revision_v1' then raise exception 'REVIEW_DELIVERY_NOT_READY'; end if;
    perform public.v22_check_review_delivery(new.content,r);
    if (new.user_id,new.case_id) is distinct from (r.user_id,r.case_id) or new.status is distinct from new.content->>'status'
      or new.revision is distinct from (new.content->>'expected_revision')::integer+1 then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  end if;
  return new;
end; $$;

create function public.save_v22_review_delivery(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_request_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; req jsonb; body jsonb; identifier uuid; known public.capability_review_delivery_requests;
  saved public.report_content_revisions; latest integer;
begin
  if p_request_text is null then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  if octet_length(p_request_text)>100000 then raise exception 'REVIEW_DELIVERY_TOO_LARGE'; end if;
  if not public.v22_review_unique_json(p_request_text::json) then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  req=p_request_text::jsonb;
  if public.v22_page_keys(req,array['id','review_confirmed','content']) is not true then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  identifier=(req->>'id')::uuid;
  if identifier is null or req->>'id' is distinct from identifier::text or jsonb_typeof(req->'review_confirmed') is distinct from 'boolean'
    then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('v22-review-delivery:'||identifier::text,0));
  perform public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  body=req->'content';perform public.v22_check_review_delivery(body,r);
  if body->>'status'='approved' and req->'review_confirmed'<>'true'::jsonb then raise exception 'REVIEW_DELIVERY_INVALID'; end if;
  select * into known from public.capability_review_delivery_requests where id=identifier;
  if known.id is not null then
    if (known.user_id,known.case_id,known.report_id) is distinct from (p_user_id,p_case_id,p_report_id)
      then raise exception 'REVIEW_DELIVERY_UNAVAILABLE'; end if;
    if known.request is distinct from req then raise exception 'REVIEW_DELIVERY_CONFLICT' using errcode='40001'; end if;
    select * into saved from public.report_content_revisions where id=known.revision_id;
  else
    select coalesce(max(revision),0) into latest from public.report_content_revisions where report_id=p_report_id;
    if latest<>(body->>'expected_revision')::integer then raise exception 'REVIEW_DELIVERY_CONFLICT' using errcode='40001'; end if;
    insert into public.report_content_revisions(report_id,user_id,case_id,revision,status,content,approved_at)
      values(p_report_id,p_user_id,p_case_id,latest+1,body->>'status',body,case when body->>'status'='approved' then clock_timestamp() else null end)
      returning * into saved;
    insert into public.capability_review_delivery_requests(id,user_id,case_id,report_id,revision_id,request)
      values(identifier,p_user_id,p_case_id,p_report_id,saved.id,req);
  end if;
  return jsonb_build_object('id',saved.id,'report_id',saved.report_id,'user_id',saved.user_id,'case_id',saved.case_id,
    'revision',saved.revision,'status',saved.status,'approved_at',saved.approved_at,'content',saved.content);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'REVIEW_DELIVERY_INVALID';
end; $$;

create function public.get_v22_review_delivery(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_revision_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.report_content_revisions;
begin
  perform public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
  select * into s from public.report_content_revisions where report_id=p_report_id and user_id=p_user_id and case_id=p_case_id
    and (p_revision_id is null or id=p_revision_id) order by revision desc limit 1;
  if s.id is null then return null; end if;
  return jsonb_build_object('id',s.id,'report_id',s.report_id,'user_id',s.user_id,'case_id',s.case_id,
    'revision',s.revision,'status',s.status,'approved_at',s.approved_at,'content',s.content);
end; $$;

create function public.list_v22_review_delivery_history(p_user_id uuid,p_case_id uuid,p_report_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'status',status,'created_at',created_at) order by revision desc),'[]'::jsonb)
    from (select * from public.report_content_revisions where report_id=p_report_id and user_id=p_user_id and case_id=p_case_id order by revision desc limit 20) t);
end; $$;

create function public.list_v22_completed_review_reports(p_user_id uuid)
returns table(id uuid,user_id uuid,case_id uuid,business_name text,site_url text,market text,service text,
  report_type text,version integer,generated_at timestamptz,delivery_revision integer,delivery_status text)
language sql stable security definer set search_path=public as $$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(c.business_name),''),c.normalized_domain),
    r.payload#>>'{business,site_url}',r.payload#>>'{business,target_market}',r.payload#>>'{business,primary_service}',
    r.payload->>'report_type',(r.payload->>'version')::integer,(r.payload->>'generated_at')::timestamptz,
    coalesce(d.revision,0),coalesce(d.status,'original')
  from public.capability_report_versions x cross join lateral public.get_v22_completed_capability_report(p_user_id,x.case_id,x.id) r
  join public.client_cases c on c.id=r.case_id and c.user_id=r.user_id and c.status='active'
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id order by revision desc limit 1) d on true
  where x.user_id=p_user_id and x.schema_version='2.2.3' order by r.created_at desc,r.id;
$$;

revoke all on function public.v22_check_review_delivery(jsonb,public.capability_report_versions),
  public.save_v22_review_delivery(uuid,uuid,uuid,text),public.get_v22_review_delivery(uuid,uuid,uuid,uuid),
  public.list_v22_review_delivery_history(uuid,uuid,uuid),public.list_v22_completed_review_reports(uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_v22_review_delivery(uuid,uuid,uuid,text),public.get_v22_review_delivery(uuid,uuid,uuid,uuid),
  public.list_v22_review_delivery_history(uuid,uuid,uuid),public.list_v22_completed_review_reports(uuid) to service_role;
commit;
