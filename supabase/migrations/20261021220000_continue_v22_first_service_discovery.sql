begin;

-- Current discovery is a projection. Each explicit continuation preserves the
-- prior request/result and its exact intent; the charge's original ID never moves.
create table public.capability_first_service_discovery_continuations (
  workflow_id uuid not null references public.capability_first_service_discoveries(workflow_id),
  previous_discovery_job_id uuid not null unique,
  discovery_job_id uuid primary key,
  idempotency_key text not null,
  mode text not null check(mode in ('supplement','refresh')),
  supplemental_website_urls jsonb not null,
  gsc_snapshot_id uuid not null references public.data_snapshots(id),
  ga4_snapshot_id uuid not null references public.data_snapshots(id),
  previous_snapshot jsonb not null,
  registered_at timestamptz not null default now(),
  unique(workflow_id,idempotency_key),
  check(previous_discovery_job_id<>discovery_job_id)
);
alter table public.capability_first_service_discovery_continuations enable row level security;
revoke all on public.capability_first_service_discovery_continuations from public,anon,authenticated,service_role;
grant select on public.capability_first_service_discovery_continuations to service_role;
create function public.guard_v22_first_service_discovery_history() returns trigger
language plpgsql set search_path=public as $$ begin raise exception 'FIRST_SERVICE_DISCOVERY_HISTORY_IMMUTABLE'; end; $$;
revoke all on function public.guard_v22_first_service_discovery_history() from public,anon,authenticated,service_role;
create trigger guard_first_service_discovery_history before update or delete on public.capability_first_service_discovery_continuations
for each row execute function public.guard_v22_first_service_discovery_history();

-- NULL means the new current discovery has not yet been dispatched. Attempts
-- remain cumulative across all rounds; releasing a prior token cannot affect it.
alter table public.capability_first_service_discovery_runs alter column dispatch_token drop not null;

create function public.continue_v22_first_service_discovery(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_previous_discovery_job_id uuid,p_discovery_job_id uuid,p_idempotency_key text,p_mode text,
  p_supplemental_website_urls jsonb,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; c public.workflow_charges; d public.capability_first_service_discoveries;
  h public.capability_first_service_discovery_continuations; r public.capability_first_service_discovery_runs;
  ids uuid[]; locked uuid[]; current_ids uuid[]; refs jsonb='[]'; source text; selected uuid; replay boolean=false;
begin
  if p_workflow_id is null or p_previous_discovery_job_id is null or p_discovery_job_id is null
    or p_previous_discovery_job_id=p_discovery_job_id or p_discovery_job_id=p_workflow_id
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$'
    or p_mode is null or p_mode not in ('supplement','refresh')
    or p_gsc_snapshot_id is null or p_ga4_snapshot_id is null or p_gsc_snapshot_id=p_ga4_snapshot_id
    or jsonb_typeof(p_supplemental_website_urls) is distinct from 'array' then
    raise exception 'FIRST_SERVICE_CONTINUATION_INVALID'; end if;
  if jsonb_array_length(p_supplemental_website_urls)>3
    or (p_mode='supplement' and jsonb_array_length(p_supplemental_website_urls)=0)
    or exists(select 1 from jsonb_array_elements(p_supplemental_website_urls) u where jsonb_typeof(u)<>'string'
      or length(u#>>'{}')>2048 or (u#>>'{}') !~ '^https?://[^[:space:]@]+$')
    or (select count(distinct lower(u)) from jsonb_array_elements_text(p_supplemental_website_urls) u)
      <>jsonb_array_length(p_supplemental_website_urls) then raise exception 'FIRST_SERVICE_CONTINUATION_INVALID'; end if;
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}')
    into ids from public.case_source_bindings b join public.client_cases owned_case on owned_case.id=b.case_id
    where owned_case.id=p_case_id and owned_case.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=p_user_id order by id for share;
  select coalesce(array_agg(id order by id),'{}') into locked from public.google_connections where id=any(ids) and user_id=p_user_id;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null or c.workflow_kind<>'verified' then raise exception 'FIRST_SERVICE_DISCOVERY_UNAVAILABLE'; end if;
  select * into h from public.capability_first_service_discovery_continuations where workflow_id=c.id and idempotency_key=p_idempotency_key;
  if h.discovery_job_id is not null then
    if h.previous_discovery_job_id<>p_previous_discovery_job_id or h.discovery_job_id<>p_discovery_job_id
      or h.mode<>p_mode or h.supplemental_website_urls is distinct from p_supplemental_website_urls
      or h.gsc_snapshot_id<>p_gsc_snapshot_id or h.ga4_snapshot_id<>p_ga4_snapshot_id then
      raise exception 'FIRST_SERVICE_CONTINUATION_CONFLICT' using errcode='40001'; end if;
    replay=true;
  else
    if c.state<>'reserved' or c.analysis_job_id is not null then raise exception 'FIRST_SERVICE_DISCOVERY_CLOSED'; end if;
    if d.discovery_job_id<>p_previous_discovery_job_id then raise exception 'FIRST_SERVICE_CONTINUATION_CONFLICT' using errcode='40001'; end if;
    if d.result is null then raise exception 'FIRST_SERVICE_DISCOVERY_IN_PROGRESS'; end if;
    if exists(select 1 from public.capability_first_service_discoveries where discovery_job_id=p_discovery_job_id)
      or exists(select 1 from public.capability_first_service_discovery_continuations where discovery_job_id=p_discovery_job_id or previous_discovery_job_id=p_discovery_job_id)
      or exists(select 1 from public.workflow_charges where discovery_job_id=p_discovery_job_id or id=p_discovery_job_id)
      or exists(select 1 from public.analysis_jobs where id=p_discovery_job_id) then
      raise exception 'FIRST_SERVICE_CONTINUATION_CONFLICT' using errcode='40001'; end if;
    if p_mode='refresh' and ((d.result->>'expires_at')::timestamptz>now()
      or p_supplemental_website_urls is distinct from coalesce(d.request->'supplemental_website_urls','[]')) then
      raise exception 'FIRST_SERVICE_REFRESH_NOT_REQUIRED'; end if;
    if p_mode='supplement' and p_supplemental_website_urls=coalesce(d.request->'supplemental_website_urls','[]') then
      raise exception 'FIRST_SERVICE_SUPPLEMENTS_UNCHANGED'; end if;
    select * into r from public.capability_first_service_discovery_runs where workflow_id=c.id for update;
    if r.workflow_id is null or r.attempts=0 then raise exception 'FIRST_SERVICE_DISCOVERY_NOT_EXECUTED'; end if;
    if r.attempts>=3 then raise exception 'FIRST_SERVICE_DISCOVERY_BUDGET_EXHAUSTED'; end if;
    select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}') into current_ids
      from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
    if ids is distinct from locked or ids is distinct from current_ids
      or cc.business_identity is distinct from d.request->'business_identity'
      or cc.primary_service is distinct from d.request->>'primary_service'
      or cc.target_market is distinct from d.request->'target_market' then raise exception 'FIRST_SERVICE_DISCOVERY_CONTEXT_CHANGED'; end if;
    foreach source in array array['gsc','ga4'] loop
      selected=case when source='gsc' then p_gsc_snapshot_id else p_ga4_snapshot_id end;
      refs=refs||jsonb_build_array(public.check_v22_first_service_source(p_user_id,p_case_id,selected,source));
      if selected is distinct from (select s.id from public.data_snapshots s join public.case_source_bindings b on b.id=s.binding_id
        where b.case_id=p_case_id and b.is_active and b.source_type=source and s.source_type=source
        order by s.fetched_at desc,s.id desc limit 1) then raise exception 'FIRST_SERVICE_SNAPSHOT_NOT_CURRENT'; end if;
    end loop;
    insert into public.capability_first_service_discovery_continuations values(c.id,d.discovery_job_id,p_discovery_job_id,
      p_idempotency_key,p_mode,p_supplemental_website_urls,p_gsc_snapshot_id,p_ga4_snapshot_id,to_jsonb(d),now());
    update public.capability_first_service_discoveries set discovery_job_id=p_discovery_job_id,
      request=jsonb_set(d.request,'{supplemental_website_urls}',p_supplemental_website_urls),
      gsc_snapshot_id=p_gsc_snapshot_id,ga4_snapshot_id=p_ga4_snapshot_id,source_refs=refs,
      created_at=now(),deadline_at=now()+interval '20 minutes',result=null,completed_at=null,failure_reason=null where workflow_id=c.id;
    update public.capability_first_service_discovery_runs set dispatch_token=null,lease_token=null,lease_until=null,checked_at=now() where workflow_id=c.id;
    select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  end if;
  return jsonb_build_object('schema_version','v22_first_service_continuation_v1','user_id',p_user_id,'case_id',p_case_id,
    'workflow_id',c.id,'previous_discovery_job_id',p_previous_discovery_job_id,'discovery_job_id',p_discovery_job_id,
    'current_discovery_job_id',d.discovery_job_id,'idempotency_key',p_idempotency_key,'mode',p_mode,'idempotent',replay);
end; $$;
revoke all on function public.continue_v22_first_service_discovery(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.continue_v22_first_service_discovery(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,uuid,uuid) to service_role;

create function public.get_v22_first_service_discovery_state(p_user_id uuid,p_case_id uuid,p_workflow_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries; attempts integer;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for share;
  if not found then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for share;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null then raise exception 'FIRST_SERVICE_DISCOVERY_UNAVAILABLE'; end if;
  select r.attempts into attempts from public.capability_first_service_discovery_runs r where r.workflow_id=c.id;
  return jsonb_build_object('schema_version','v22_first_service_discovery_state_v1','user_id',p_user_id,'case_id',p_case_id,
    'workflow_id',c.id,'initial_discovery_job_id',c.discovery_job_id,'current_discovery_job_id',d.discovery_job_id,
    'charge_state',c.state,'analysis_job_id',c.analysis_job_id,'remaining_attempts',3-coalesce(attempts,0),
    'phase',case when c.state='compensated' then 'failed' when c.state='consumed' then 'completed'
      when c.analysis_job_id is not null then 'analyzing' when d.result is null then 'discovering'
      when (d.result->>'expires_at')::timestamptz<=now() then 'refresh_required'
      when d.result->>'ready_for_confirmation'='true' then 'awaiting_confirmation' else 'needs_competitors' end);
end; $$;
revoke all on function public.get_v22_first_service_discovery_state(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_first_service_discovery_state(uuid,uuid,uuid) to service_role;

-- Append budget identity to trusted worker receipts. It remains the original
-- discovery even when the current request/result has a new discovery ID.
create function public.v22_first_service_discovery_budget(p_workflow_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('cost_ledger_job_id',c.discovery_job_id,
    'cost_ledger_created_at',coalesce((h.previous_snapshot->>'created_at')::timestamptz,d.created_at))
  from public.workflow_charges c join public.capability_first_service_discoveries d on d.workflow_id=c.id
  left join public.capability_first_service_discovery_continuations h on h.workflow_id=c.id and h.previous_discovery_job_id=c.discovery_job_id
  where c.id=p_workflow_id;
$$;
revoke all on function public.v22_first_service_discovery_budget(uuid) from public,anon,authenticated,service_role;

alter function public.claim_v22_first_service_discovery_dispatch(uuid,uuid) rename to claim_v22_first_service_discovery_dispatch_base;
revoke all on function public.claim_v22_first_service_discovery_dispatch_base(uuid,uuid) from public,anon,authenticated,service_role;
create function public.claim_v22_first_service_discovery_dispatch(p_workflow_id uuid,p_dispatch_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$ declare receipt jsonb; begin
  receipt=public.claim_v22_first_service_discovery_dispatch_base(p_workflow_id,p_dispatch_token);
  if receipt->>'outcome'='closed' then return receipt; end if;
  if receipt->>'dispatch_token' is null then
    update public.capability_first_service_discovery_runs set dispatch_token=p_dispatch_token where workflow_id=p_workflow_id and dispatch_token is null;
    receipt=receipt||jsonb_build_object('outcome','dispatch','dispatch_token',p_dispatch_token);
  end if;
  return receipt||public.v22_first_service_discovery_budget(p_workflow_id);
end; $$;
revoke all on function public.claim_v22_first_service_discovery_dispatch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_v22_first_service_discovery_dispatch(uuid,uuid) to service_role;

alter function public.claim_v22_first_service_discovery_run(uuid,uuid,uuid) rename to claim_v22_first_service_discovery_run_base;
revoke all on function public.claim_v22_first_service_discovery_run_base(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.claim_v22_first_service_discovery_run(p_workflow_id uuid,p_discovery_job_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$ declare receipt jsonb; begin
  -- Do not run a new round before its one-shot dispatch marker has been written.
  if not exists(select 1 from public.capability_first_service_discovery_runs where workflow_id=p_workflow_id and dispatch_token is not null) then
    return jsonb_build_object('outcome','closed'); end if;
  receipt=public.claim_v22_first_service_discovery_run_base(p_workflow_id,p_discovery_job_id,p_lease_token);
  if receipt->>'outcome'<>'claimed' then return receipt; end if;
  if receipt->>'dispatch_token' is null then raise exception 'FIRST_SERVICE_DISCOVERY_NOT_DISPATCHED'; end if;
  return receipt||public.v22_first_service_discovery_budget(p_workflow_id);
end; $$;
revoke all on function public.claim_v22_first_service_discovery_run(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_v22_first_service_discovery_run(uuid,uuid,uuid) to service_role;

-- Exact replay of the original paid intent survives a continuation. Return an
-- explicit current pointer; never charge again or rewrite the original identity.
alter function public.reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) rename to reserve_v22_first_service_discovery_base;
revoke all on function public.reserve_v22_first_service_discovery_base(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
create function public.reserve_v22_first_service_discovery(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_discovery_job_id uuid,p_idempotency_key text,p_request jsonb,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries; original jsonb; receipt jsonb; balance integer; ids uuid[]; current_ids uuid[];
begin
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}') into ids
    from public.case_source_bindings b join public.client_cases cc on cc.id=b.case_id
    where cc.id=p_case_id and cc.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=p_user_id order by id for share;
  -- A fast-path first observation is insufficient: acquire the same Case lock
  -- before deciding whether the original row has already moved to history.
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id and user_id=p_user_id and case_id=p_case_id for update;
  select h.previous_snapshot into original from public.capability_first_service_discovery_continuations h
    where h.workflow_id=c.id and h.previous_discovery_job_id=c.discovery_job_id;
  if original is null then
    select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}') into current_ids
      from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
    if current_ids is distinct from ids then raise exception 'FIRST_SERVICE_BINDING_CHANGED' using errcode='40001'; end if;
    receipt=public.reserve_v22_first_service_discovery_base(p_user_id,p_case_id,p_workflow_id,p_discovery_job_id,p_idempotency_key,p_request,p_gsc_snapshot_id,p_ga4_snapshot_id);
    return receipt||jsonb_build_object('current_discovery_job_id',p_discovery_job_id);
  end if;
  if c.idempotency_key is distinct from p_idempotency_key or c.discovery_job_id is distinct from p_discovery_job_id
    or original->'request' is distinct from p_request or original->>'gsc_snapshot_id' is distinct from p_gsc_snapshot_id::text
    or original->>'ga4_snapshot_id' is distinct from p_ga4_snapshot_id::text then
    raise exception 'FIRST_SERVICE_DISCOVERY_CONFLICT' using errcode='40001'; end if;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  select credit_balance into balance from public.users where id=p_user_id;
  return jsonb_build_object('schema_version','v22_first_service_discovery_v1','user_id',p_user_id,'case_id',p_case_id,
    'workflow_id',c.id,'discovery_job_id',c.discovery_job_id,'current_discovery_job_id',d.discovery_job_id,
    'idempotency_key',p_idempotency_key,'idempotent',true,'credit_balance',balance,'charge_state',c.state,'analysis_job_id',c.analysis_job_id,
    'phase',case when c.state='compensated' then 'failed' when c.state='consumed' then 'completed'
      when c.analysis_job_id is not null then 'analyzing' when d.result is null then 'discovering'
      when d.result->>'ready_for_confirmation'='true' then 'awaiting_confirmation' else 'needs_competitors' end,
    'awaiting_confirmation',coalesce(d.result->>'ready_for_confirmation'='true',false) and c.state='reserved' and c.analysis_job_id is null,
    'created_at',d.created_at,'deadline_at',d.deadline_at);
end; $$;
revoke all on function public.reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid) to service_role;
commit;
