begin;

-- Additive exact-observation v2 support. Never rewrite existing observations.
create or replace function public.finish_v22_ga4_collection(p_id uuid,p_lease_id uuid,p_payload jsonb,p_canonical_payload text,p_canonical_snapshot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.capability_ga4_collection_jobs; existing jsonb;
  started timestamptz; observed_before timestamptz; observed_after timestamptz; completed timestamptz;
begin
  j=public.v22_ga4_lock_collection(p_id);
  if j.id is null or p_lease_id is null or j.lease_id is distinct from p_lease_id then raise exception 'COLLECTION_LEASE_LOST'; end if;
  if j.status='succeeded' then
    select payload into existing from public.capability_ga4_collections where id=j.id;
    if existing is distinct from p_payload then raise exception 'COLLECTION_CONFLICT'; end if;
    return public.v22_ga4_collection_json(j);
  end if;
  if j.status<>'running' or j.lease_expires_at<=clock_timestamp() then raise exception 'COLLECTION_LEASE_LOST'; end if;
  if not public.v22_ga4_collection_valid(j) then
    update public.capability_ga4_collection_jobs set status='failed',error_code='SYNC_BINDING_CHANGED',completed_at=clock_timestamp() where id=j.id returning * into j;
    return public.v22_ga4_collection_json(j);
  end if;
  if p_canonical_payload is null or octet_length(p_canonical_payload)>2000000
    or p_canonical_snapshot is null or octet_length(p_canonical_snapshot)>2000000
    or p_payload->'snapshot' is distinct from p_canonical_snapshot::jsonb
    or p_payload#>>'{qualification,observation_checksum}' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_snapshot,'UTF8')),'hex')
    or p_payload-array['schema_version','plan','state','snapshot','qualification','checksum']<>'{}'::jsonb
    or p_payload-'checksum' is distinct from p_canonical_payload::jsonb
    or p_payload->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_payload,'UTF8')),'hex')
    or p_payload->>'schema_version' is distinct from 'v22_ga4_comparison_collection_v1'
    or p_payload->'plan' is distinct from j.plan or p_payload->>'state' is distinct from 'collected'
    or coalesce(p_payload#>>'{snapshot,schema_version}','') not in ('ga4_comparison_observation_v1','ga4_comparison_observation_v2')
    or p_payload#>'{snapshot,scope}' is distinct from j.plan->'scope'
    or p_payload#>'{snapshot,windows}' is distinct from j.plan->'windows'
    or p_payload#>'{snapshot,previous,start_date}' is distinct from j.plan#>'{windows,before,start}'
    or p_payload#>'{snapshot,previous,end_date}' is distinct from j.plan#>'{windows,before,end}'
    or p_payload#>'{snapshot,current,start_date}' is distinct from j.plan#>'{windows,after,start}'
    or p_payload#>'{snapshot,current,end_date}' is distinct from j.plan#>'{windows,after,end}'
    or p_payload#>>'{qualification,ruleset_version}' is distinct from (case p_payload#>>'{snapshot,schema_version}'
      when 'ga4_comparison_observation_v2' then 'v22_ga4_qualification_truncation_v2' else 'v22_ga4_qualification_foundation_v1' end)
    or p_payload#>'{qualification,effect_conclusion}' is distinct from 'null'::jsonb
    or p_payload#>'{qualification,causal_attribution}' is distinct from 'false'::jsonb
    or p_payload#>>'{qualification,processing_completeness}' is distinct from 'not_attested'
    or p_payload#>>'{qualification,event_history}' is distinct from 'unverified'
    or jsonb_typeof(p_payload#>'{qualification,metrics}') is distinct from 'array'
    then raise exception 'COLLECTION_INVALID'; end if;
  if jsonb_array_length(p_payload#>'{qualification,metrics}')<>5 or exists(
    select 1 from jsonb_array_elements(p_payload#>'{qualification,metrics}') m
    where m->>'state' is distinct from 'not_comparable'
      or jsonb_typeof(m->'reasons') is distinct from 'array'
      or not(coalesce(m->'reasons' ? 'GA4_COMPLETENESS_NOT_ATTESTED',false))
      or (m->>'metric' in ('key_events','session_key_event_rate')
        and not(coalesce(m->'reasons' ? 'GA4_EVENT_HISTORY_NOT_VERIFIED',false))))
    or (select array_agg(m->>'metric' order by m->>'metric') from jsonb_array_elements(p_payload#>'{qualification,metrics}') m)
      is distinct from array['engaged_sessions','engagement_rate','key_events','session_key_event_rate','sessions']
    then raise exception 'COLLECTION_INVALID'; end if;
  if p_payload#>>'{snapshot,schema_version}'='ga4_comparison_observation_v2' then
    if jsonb_typeof(p_payload#>'{snapshot,truncation_checks}') is distinct from 'array'
      then raise exception 'COLLECTION_INVALID'; end if;
    if jsonb_array_length(p_payload#>'{snapshot,truncation_checks}')<>6
      or (select array_agg(c->>'period'||':'||(c->>'view') order by n) from jsonb_array_elements(p_payload#>'{snapshot,truncation_checks}') with ordinality t(c,n))
        is distinct from array['previous:totals','previous:dates','previous:key_events','current:totals','current:dates','current:key_events']
      then raise exception 'COLLECTION_INVALID'; end if;
    -- Full shapes/dates are revalidated by the strict Python consumer; SQL also guards the eligibility invariant.
    if exists(select 1 from jsonb_array_elements(p_payload#>'{snapshot,truncation_checks}') c
      where jsonb_typeof(c->'reasons') is distinct from 'array' or c-array['period','view','reasons']<>'{}'::jsonb)
      then raise exception 'COLLECTION_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload#>'{snapshot,truncation_checks}') c
      where jsonb_array_length(c->'reasons')>20) then raise exception 'COLLECTION_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload#>'{qualification,metrics}') m
      where exists(select 1 from jsonb_array_elements(p_payload#>'{snapshot,truncation_checks}') c
        where jsonb_array_length(c->'reasons')>0 and (c->>'view'<>'key_events' or m->>'metric' in ('key_events','session_key_event_rate')))
      and not(coalesce(m->'reasons' ? 'GA4_DATA_TRUNCATION_REPORTED',false)))
      then raise exception 'COLLECTION_INVALID'; end if;
  end if;
  started=(p_payload#>>'{snapshot,started_at}')::timestamptz;
  observed_before=(p_payload#>>'{snapshot,configuration_before,observed_at}')::timestamptz;
  observed_after=(p_payload#>>'{snapshot,configuration_after,observed_at}')::timestamptz;
  completed=(p_payload#>>'{snapshot,completed_at}')::timestamptz;
  if started is null or observed_before is null or observed_after is null or completed is null
    or not isfinite(started) or not isfinite(observed_before) or not isfinite(observed_after) or not isfinite(completed)
    or started<(j.plan->>'prepared_at')::timestamptz or observed_before<started or observed_after<observed_before
    or completed<observed_after or completed>clock_timestamp() then raise exception 'COLLECTION_INVALID'; end if;
  insert into public.capability_ga4_collections(id,payload,checksum) values(j.id,p_payload,p_payload->>'checksum');
  update public.capability_ga4_collection_jobs set status='succeeded',completed_at=clock_timestamp(),error_code=null where id=j.id returning * into j;
  return public.v22_ga4_collection_json(j);
end; $$;


create table public.capability_ga4_evidence_reviews (
  collection_id uuid not null references public.capability_ga4_collections(id),
  revision integer not null check(revision>0),
  request_id uuid not null unique,
  payload jsonb not null,
  recorded_at timestamptz not null,
  primary key(collection_id,revision)
);
alter table public.capability_ga4_evidence_reviews enable row level security;
revoke all on public.capability_ga4_evidence_reviews from public,anon,authenticated,service_role;
grant select on public.capability_ga4_evidence_reviews to service_role;
create trigger immutable_ga4_evidence_review before update or delete on public.capability_ga4_evidence_reviews
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_ga4_review_source(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid,p_collection_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j jsonb;
begin
  j=public.get_v22_ga4_collection(p_user_id,p_case_id,p_collection_id);
  if j is null or j->>'status' is distinct from 'succeeded'
    or j#>>'{record,report_id}' is distinct from p_report_id::text
    or j#>>'{record,delivery_revision_id}' is distinct from p_delivery_revision_id::text
    then raise exception 'GA4_REVIEW_SOURCE_NOT_FOUND'; end if;
  return j->'collection';
end; $$;

create function public.get_v22_ga4_evidence_reviews(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid,p_collection_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform public.v22_ga4_review_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id,p_collection_id);
  return (select coalesce(jsonb_agg(payload order by revision desc),'[]'::jsonb) from
    (select payload,revision from public.capability_ga4_evidence_reviews where collection_id=p_collection_id order by revision desc limit 20) history);
end; $$;

create function public.save_v22_ga4_evidence_review(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid,p_collection_id uuid,
  p_expected_revision integer,p_payload jsonb,p_canonical_content text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source jsonb; prior public.capability_ga4_evidence_reviews; latest public.capability_ga4_evidence_reviews;
  recording_time timestamptz; item jsonb;
begin
  -- Consistent case -> collection lock; owner deletion/transfer cannot race authorization.
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  source=public.v22_ga4_review_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id,p_collection_id);
  perform 1 from public.capability_ga4_collections where id=p_collection_id for update;
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>2147483645
    or p_canonical_content is null or octet_length(p_canonical_content)>20000
    or jsonb_typeof(p_payload) is distinct from 'object'
    or not(p_payload ?& array['schema_version','source','user_id','case_id','report_id','delivery_revision_id','collection_id','request_id','observation_checksum','revision','recorded_at','checks','checksum'])
    or p_payload-array['schema_version','source','user_id','case_id','report_id','delivery_revision_id','collection_id','request_id','observation_checksum','revision','recorded_at','checks','checksum']<>'{}'::jsonb
    or p_payload->>'schema_version' is distinct from 'v22_ga4_seo_review_v1'
    or p_payload->>'source' is distinct from 'seo_recorded'
    or p_payload->>'user_id' is distinct from p_user_id::text
    or p_payload->>'case_id' is distinct from p_case_id::text
    or p_payload->>'report_id' is distinct from p_report_id::text
    or p_payload->>'delivery_revision_id' is distinct from p_delivery_revision_id::text
    or p_payload->>'collection_id' is distinct from p_collection_id::text
    or p_payload->>'observation_checksum' is distinct from source#>>'{qualification,observation_checksum}'
    or jsonb_typeof(p_payload->'request_id') is distinct from 'string'
    or p_payload->>'request_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_payload->'revision' is distinct from to_jsonb(p_expected_revision+1)
    or p_payload-'checksum' is distinct from p_canonical_content::jsonb
    or p_payload->>'checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex')
    or jsonb_typeof(p_payload->'recorded_at') is distinct from 'string'
    or p_payload->>'recorded_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    or jsonb_typeof(p_payload->'checks') is distinct from 'object'
    or not(p_payload->'checks' ?& array['date_coverage','event_history','measurement_setup'])
    or (p_payload->'checks')-array['date_coverage','event_history','measurement_setup']<>'{}'::jsonb
    then raise exception 'GA4_REVIEW_INVALID'; end if;
  for item in select value from jsonb_each(p_payload->'checks') loop
    if jsonb_typeof(item) is distinct from 'object' or not(item ?& array['status','note'])
      or item-array['status','note']<>'{}'::jsonb
      or coalesce(item->>'status','') not in ('not_checked','no_issue_found','issue_found','uncertain')
      or jsonb_typeof(item->'note') is distinct from 'string' or length(item->>'note')>1200
      or translate(item->>'note',chr(9)||chr(10),'') ~ '[[:cntrl:]]'
      or (item->>'status'<>'not_checked' and item->>'note' !~ '\S')
      then raise exception 'GA4_REVIEW_INVALID'; end if;
  end loop;
  recording_time=(p_payload->>'recorded_at')::timestamptz;
  if recording_time>clock_timestamp()+interval '1 minute' or recording_time<clock_timestamp()-interval '5 minutes'
    or recording_time<(source#>>'{snapshot,completed_at}')::timestamptz then raise exception 'GA4_REVIEW_INVALID'; end if;
  select * into prior from public.capability_ga4_evidence_reviews where request_id=(p_payload->>'request_id')::uuid;
  if prior.request_id is not null then
    if prior.collection_id is distinct from p_collection_id or prior.revision<>p_expected_revision+1
      or prior.payload->'checks' is distinct from p_payload->'checks'
      or prior.payload->'observation_checksum' is distinct from p_payload->'observation_checksum'
      then raise exception 'GA4_REVIEW_CONFLICT' using errcode='40001'; end if;
    return prior.payload;
  end if;
  select * into latest from public.capability_ga4_evidence_reviews where collection_id=p_collection_id order by revision desc limit 1;
  if coalesce(latest.revision,0)<>p_expected_revision then raise exception 'GA4_REVIEW_CONFLICT' using errcode='40001'; end if;
  if latest.recorded_at>recording_time then raise exception 'GA4_REVIEW_INVALID'; end if;
  insert into public.capability_ga4_evidence_reviews(collection_id,revision,request_id,payload,recorded_at)
    values(p_collection_id,p_expected_revision+1,(p_payload->>'request_id')::uuid,p_payload,recording_time);
  return p_payload;
end; $$;

revoke all on function public.v22_ga4_review_source(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_v22_ga4_evidence_reviews(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_v22_ga4_evidence_review(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_v22_ga4_evidence_reviews(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.save_v22_ga4_evidence_review(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text) to service_role;
commit;

