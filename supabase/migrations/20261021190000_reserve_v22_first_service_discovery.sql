-- Internal only: reserve the service credit before discovery, bind it after confirmation.
begin;
create table public.capability_first_service_discoveries (
  workflow_id uuid primary key references public.workflow_charges(id),
  discovery_job_id uuid not null unique,
  request jsonb not null check(jsonb_typeof(request)='object' and octet_length(request::text)<=150000),
  gsc_snapshot_id uuid not null references public.data_snapshots(id),
  ga4_snapshot_id uuid not null references public.data_snapshots(id),
  source_refs jsonb not null check(jsonb_typeof(source_refs)='array' and jsonb_array_length(source_refs)=2),
  created_at timestamptz not null default now(),
  deadline_at timestamptz not null default now()+interval '20 minutes',
  result jsonb check(result is null or octet_length(result::text)<=150000),
  completed_at timestamptz,
  failure_reason text check(failure_reason in ('DISCOVERY_FAILED','DISCOVERY_DEADLINE_EXCEEDED')),
  check(deadline_at>created_at),
  check((result is null and completed_at is null) or
    (jsonb_typeof(result)='object' and completed_at is not null and completed_at>=created_at))
);
alter table public.capability_first_service_discoveries enable row level security;
revoke all on public.capability_first_service_discoveries from public,anon,authenticated,service_role;
grant select on public.capability_first_service_discoveries to service_role;

create function public.reserve_v22_first_service_discovery(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_discovery_job_id uuid,p_idempotency_key text,p_request jsonb,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; charge public.workflow_charges; d public.capability_first_service_discoveries;
  discovered uuid[]; locked uuid[]; current_connections uuid[]; refs jsonb='[]'; source text; selected uuid;
  balance integer; replay boolean=false;
begin
  if p_workflow_id is null or p_discovery_job_id is null or p_workflow_id=p_discovery_job_id
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$'
    or p_gsc_snapshot_id is null or p_ga4_snapshot_id is null or p_gsc_snapshot_id=p_ga4_snapshot_id
    or jsonb_typeof(p_request) is distinct from 'object'
    or p_request->>'case_id' is distinct from p_case_id::text
    or jsonb_typeof(p_request->'queries') is distinct from 'array' then
    raise exception 'FIRST_SERVICE_DISCOVERY_INVALID'; end if;
  if jsonb_array_length(p_request->'queries') not between 3 and 5
    or exists(select 1 from jsonb_array_elements(p_request->'queries') q
      where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
    or (select count(distinct lower(btrim(q))) from jsonb_array_elements_text(p_request->'queries') q)
      <>jsonb_array_length(p_request->'queries')
    or exists(select 1 from jsonb_object_keys(p_request) k where k not in
      ('case_id','business_identity','primary_service','target_market','queries','search_language','search_device','supplemental_website_urls'))
    -- The current first-service collector uses these fixed market defaults.
    or coalesce(p_request->>'search_device','mobile')<>'mobile'
    or coalesce(p_request->>'search_language','en')<>'en'
    or (p_request ? 'supplemental_website_urls' and p_request->'supplemental_website_urls'<>'[]'::jsonb) then
    raise exception 'FIRST_SERVICE_DISCOVERY_INVALID'; end if;
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}')
    into discovered from public.case_source_bindings b join public.client_cases c on c.id=b.case_id
    where c.id=p_case_id and c.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(discovered) and user_id=p_user_id order by id for share;
  select coalesce(array_agg(id order by id),'{}') into locked from public.google_connections where id=any(discovered) and user_id=p_user_id;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where id=p_workflow_id
    or (user_id=p_user_id and idempotency_key=p_idempotency_key) order by id limit 1 for update;
  if charge.id is not null then
    select * into d from public.capability_first_service_discoveries where workflow_id=p_workflow_id;
    if charge.id is distinct from p_workflow_id or charge.user_id<>p_user_id or charge.case_id<>p_case_id
      or charge.workflow_kind<>'verified' or charge.idempotency_key<>p_idempotency_key
      or charge.discovery_job_id is distinct from p_discovery_job_id or d.workflow_id is null
      or d.discovery_job_id<>p_discovery_job_id or d.request is distinct from p_request
      or d.gsc_snapshot_id<>p_gsc_snapshot_id or d.ga4_snapshot_id<>p_ga4_snapshot_id then
      raise exception 'FIRST_SERVICE_DISCOVERY_CONFLICT' using errcode='40001'; end if;
    replay=true;
  else
    select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}')
      into current_connections from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
    if current_connections is distinct from discovered or current_connections is distinct from locked then
      raise exception 'FIRST_SERVICE_BINDING_CHANGED' using errcode='40001'; end if;
    if cc.latest_report_id is not null or exists(select 1 from public.reports where case_id=p_case_id and status='paid_full')
      or exists(select 1 from public.analysis_jobs where case_id=p_case_id and (status in ('queued','running') or capability_report_id is not null))
      or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then
      raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    if p_request->'business_identity' is distinct from cc.business_identity
      or cc.business_identity->>'site_url' is distinct from cc.site_url
      or coalesce(btrim(cc.site_url),'')=''
      or coalesce(btrim(cc.primary_service),'')=''
      or coalesce(btrim(cc.target_market->>'display_name'),'')=''
      or coalesce(btrim(cc.business_identity->>'public_gbp_url'),'')=''
      or p_request->>'primary_service' is distinct from cc.primary_service
      or p_request->'target_market' is distinct from cc.target_market then
      raise exception 'FIRST_SERVICE_BUSINESS_NOT_READY'; end if;
    foreach source in array array['gsc','ga4'] loop
      selected=case when source='gsc' then p_gsc_snapshot_id else p_ga4_snapshot_id end;
      refs=refs||jsonb_build_array(public.check_v22_first_service_source(p_user_id,p_case_id,selected,source));
      if selected is distinct from (select s.id from public.data_snapshots s join public.case_source_bindings b on b.id=s.binding_id
        where b.case_id=p_case_id and b.is_active and b.source_type=source and s.source_type=source
        order by s.fetched_at desc,s.id desc limit 1) then raise exception 'FIRST_SERVICE_SNAPSHOT_NOT_CURRENT'; end if;
    end loop;
    update public.users set credit_balance=credit_balance-1,updated_at=now() where id=p_user_id and credit_balance>=1
      returning credit_balance into balance;
    if balance is null then raise exception 'INSUFFICIENT_CREDITS'; end if;
    if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then
      raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,discovery_job_id)
      values(p_workflow_id,p_user_id,p_case_id,'verified',p_idempotency_key,p_discovery_job_id) returning * into charge;
    insert into public.credit_ledger(user_id,case_id,workflow_charge_id,kind,delta,balance_after,idempotency_key)
      values(p_user_id,p_case_id,p_workflow_id,'verified_debit',-1,balance,'workflow:'||p_workflow_id::text||':debit');
    insert into public.capability_first_service_discoveries(workflow_id,discovery_job_id,request,gsc_snapshot_id,ga4_snapshot_id,source_refs)
      values(p_workflow_id,p_discovery_job_id,p_request,p_gsc_snapshot_id,p_ga4_snapshot_id,refs) returning * into d;
  end if;
  select credit_balance into balance from public.users where id=p_user_id;
  return jsonb_build_object('schema_version','v22_first_service_discovery_v1','user_id',p_user_id,'case_id',p_case_id,
    'workflow_id',p_workflow_id,'discovery_job_id',p_discovery_job_id,'idempotency_key',p_idempotency_key,
    'charge_state',charge.state,'analysis_job_id',charge.analysis_job_id,'idempotent',replay,'credit_balance',balance,
    'phase',case when charge.state='compensated' then 'failed' when charge.state='consumed' then 'completed'
      when charge.analysis_job_id is not null then 'analyzing' when d.result is null then 'discovering'
      when d.result->>'ready_for_confirmation'='true' then 'awaiting_confirmation' else 'needs_competitors' end,
    'awaiting_confirmation',coalesce(d.result->>'ready_for_confirmation'='true',false) and charge.state='reserved' and charge.analysis_job_id is null,
    'created_at',d.created_at,'deadline_at',d.deadline_at);
end;
$$;
revoke all on function public.reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) to service_role;

-- Only a trusted service, after validating the backend result, may persist this receipt.
-- A transport error is not proof of failure. No browser-facing completion endpoint.
create function public.record_v22_first_service_discovery(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,p_result jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for no key update;
  if not found then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null then raise exception 'FIRST_SERVICE_DISCOVERY_UNAVAILABLE'; end if;
  if d.result is not null then
    if d.result is distinct from p_result then raise exception 'FIRST_SERVICE_DISCOVERY_CONFLICT' using errcode='40001'; end if;
    return;
  end if;
  if c.state<>'reserved' or c.analysis_job_id is not null or d.deadline_at<=now() then
    raise exception 'FIRST_SERVICE_DISCOVERY_CLOSED'; end if;
  if jsonb_typeof(p_result) is distinct from 'object'
    or p_result->>'discovery_id' is distinct from d.discovery_job_id::text
    or p_result->>'case_id' is distinct from p_case_id::text
    or coalesce(p_result->>'input_digest','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_result->>'candidate_digest','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_result->>'market_snapshot_checksum','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_result->>'market_snapshot_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(p_result->'candidates') is distinct from 'array'
    or jsonb_typeof(p_result->'ready_for_confirmation') is distinct from 'boolean'
    or p_result->>'created_at' is null or p_result->>'expires_at' is null then
    raise exception 'FIRST_SERVICE_DISCOVERY_RESULT_INVALID'; end if;
  if (p_result->>'expires_at')::timestamptz<=now() or (p_result->>'created_at')::timestamptz>now()
    or (p_result->>'expires_at')::timestamptz<=(p_result->>'created_at')::timestamptz
    or jsonb_array_length(p_result->'candidates')>6
    or ((p_result->>'ready_for_confirmation')::boolean and jsonb_array_length(p_result->'candidates')=0)
    or exists(select 1 from jsonb_array_elements(p_result->'candidates') v
      where jsonb_typeof(v)<>'object' or coalesce(v->>'website_url','') !~ '^https?://[^[:space:]]+$')
    or (select count(distinct v->>'website_url') from jsonb_array_elements(p_result->'candidates') v)
      <>jsonb_array_length(p_result->'candidates') then raise exception 'FIRST_SERVICE_DISCOVERY_RESULT_INVALID'; end if;
  update public.capability_first_service_discoveries set result=p_result,completed_at=now() where workflow_id=c.id;
end;
$$;
revoke all on function public.record_v22_first_service_discovery(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_v22_first_service_discovery(uuid,uuid,uuid,jsonb) to service_role;

-- Reason must be established by the trusted caller, not supplied by a browser.
create function public.fail_v22_first_service_discovery(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,p_discovery_job_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries; balance integer;
begin
  if p_reason is null or p_reason not in ('DISCOVERY_FAILED','DISCOVERY_DEADLINE_EXCEEDED') then
    raise exception 'FIRST_SERVICE_DISCOVERY_FAILURE_INVALID'; end if;
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for no key update;
  if not found then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null or d.discovery_job_id is distinct from p_discovery_job_id then
    raise exception 'FIRST_SERVICE_DISCOVERY_UNAVAILABLE'; end if;
  if c.state='compensated' then return false; end if;
  if c.state<>'reserved' or c.analysis_job_id is not null or d.result is not null then
    raise exception 'FIRST_SERVICE_DISCOVERY_NOT_REFUNDABLE'; end if;
  if p_reason='DISCOVERY_DEADLINE_EXCEEDED' and d.deadline_at>now() then
    raise exception 'FIRST_SERVICE_DISCOVERY_NOT_EXPIRED'; end if;
  update public.workflow_charges set state='compensated',settled_at=now() where id=c.id;
  update public.capability_first_service_discoveries set failure_reason=p_reason where workflow_id=c.id;
  update public.users set credit_balance=credit_balance+1,updated_at=now() where id=p_user_id returning credit_balance into balance;
  insert into public.credit_ledger(user_id,case_id,workflow_charge_id,kind,delta,balance_after,idempotency_key)
    values(p_user_id,p_case_id,c.id,'technical_failure_credit',1,balance,'workflow:'||c.id::text||':technical-failure');
  return true;
end;
$$;
revoke all on function public.fail_v22_first_service_discovery(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_v22_first_service_discovery(uuid,uuid,uuid,uuid,text) to service_role;

create function public.expire_v22_first_service_discoveries(p_limit integer default 100)
returns table(workflow_id uuid) language plpgsql security definer set search_path=public as $$
declare candidate record; c public.workflow_charges; d public.capability_first_service_discoveries;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'FIRST_SERVICE_DISCOVERY_EXPIRY_INVALID'; end if;
  for candidate in select w.id,w.user_id,w.case_id from public.workflow_charges w
    join public.capability_first_service_discoveries s on s.workflow_id=w.id
    where w.state='reserved' and w.analysis_job_id is null and s.result is null and s.deadline_at<=now()
    order by s.deadline_at,w.id limit p_limit
  loop
    -- Same Case -> charge order as recording/binding; recheck after obtaining locks.
    perform 1 from public.client_cases where id=candidate.case_id for no key update skip locked;
    if not found then continue; end if;
    select * into c from public.workflow_charges where id=candidate.id for update;
    select * into d from public.capability_first_service_discoveries s where s.workflow_id=c.id;
    if c.state='reserved' and c.analysis_job_id is null and d.result is null and d.deadline_at<=now() then
      if public.fail_v22_first_service_discovery(c.user_id,c.case_id,c.id,d.discovery_job_id,'DISCOVERY_DEADLINE_EXCEEDED') then
        return query select c.id;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.expire_v22_first_service_discoveries(integer) from public,anon,authenticated;
grant execute on function public.expire_v22_first_service_discoveries(integer) to service_role;

create or replace function public.guard_v22_first_service_parallel_charge() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.workflow_charges c where c.case_id=new.case_id and c.state='reserved'
    and (exists(select 1 from public.capability_first_service_preparations p where p.job_id=c.analysis_job_id)
      or exists(select 1 from public.capability_first_service_discoveries d where d.workflow_id=c.id))) then
    raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
  return new;
end;
$$;

-- Called under the Case lock by enrollment. No discovery means the existing internal
-- prepared-input path is retained. A reserved discovery can never be silently bypassed.
create function public.check_v22_first_service_discovery_binding(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_idempotency_key text,p_business_version_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries; b public.case_business_scope_versions; cc public.client_cases;
begin
  select * into d from public.capability_first_service_discoveries where workflow_id=p_job_id;
  if d.workflow_id is null then return false; end if;
  select * into c from public.workflow_charges where id=p_job_id for update;
  select * into b from public.case_business_scope_versions where id=p_business_version_id and user_id=p_user_id and case_id=p_case_id;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id;
  if c.user_id is distinct from p_user_id or c.case_id is distinct from p_case_id or c.workflow_kind<>'verified'
    or c.idempotency_key is distinct from p_idempotency_key or c.analysis_job_id is not null or c.state<>'reserved'
    or d.result is null or d.result->>'ready_for_confirmation' is distinct from 'true'
    or (d.result->>'expires_at')::timestamptz<=now() or b.id is null
    or cc.business_identity is distinct from d.request->'business_identity'
    or cc.primary_service is distinct from d.request->>'primary_service'
    or cc.target_market is distinct from d.request->'target_market'
    or jsonb_typeof(b.scope->'competitor_sites') is distinct from 'array'
    or not exists(select 1 from public.credit_ledger where workflow_charge_id=c.id and user_id=p_user_id and case_id=p_case_id and kind='verified_debit' and delta=-1)
    or exists(select 1 from public.credit_ledger where workflow_charge_id=c.id and kind='technical_failure_credit') then
    raise exception 'FIRST_SERVICE_DISCOVERY_NOT_READY'; end if;
  if jsonb_array_length(b.scope->'competitor_sites') not between 1 and 3
    or exists(select 1 from jsonb_array_elements_text(b.scope->'competitor_sites') s where not exists(
      select 1 from jsonb_array_elements(d.result->'candidates') v where v->>'website_url'=s)) then
    raise exception 'FIRST_SERVICE_DISCOVERY_SELECTION_INVALID'; end if;
  return true;
end;
$$;
revoke all on function public.check_v22_first_service_discovery_binding(uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;

create function public.guard_v22_first_service_collection_discovery() returns trigger
language plpgsql set search_path=public as $$
declare d public.capability_first_service_discoveries; r jsonb; link jsonb;
begin
  select * into d from public.capability_first_service_discoveries where workflow_id=new.job_id;
  if d.workflow_id is null then return new; end if;
  r=new.request->'collection_request'; link=new.request->'competitor_discovery';
  if d.result is null or r->'business_identity' is distinct from d.request->'business_identity'
    or r->'target_market' is distinct from d.request->'target_market'
    or r->'queries' is distinct from d.request->'queries'
    or r->>'primary_service' is distinct from d.request->>'primary_service'
    or coalesce(r->>'search_device','mobile') is distinct from coalesce(d.request->>'search_device','mobile')
    or coalesce(r->>'search_language','en') is distinct from coalesce(d.request->>'search_language','en')
    or link is distinct from jsonb_build_object('discovery_id',d.result->'discovery_id','candidate_digest',d.result->'candidate_digest',
      'market_snapshot_id',d.result->'market_snapshot_id','market_snapshot_checksum',d.result->'market_snapshot_checksum') then
    raise exception 'FIRST_SERVICE_COLLECTION_DISCOVERY_CONFLICT'; end if;
  return new;
end;
$$;
revoke all on function public.guard_v22_first_service_collection_discovery() from public,anon,authenticated;
create trigger guard_first_service_collection_discovery before insert on public.capability_first_service_collections
for each row execute function public.guard_v22_first_service_collection_discovery();
commit;
