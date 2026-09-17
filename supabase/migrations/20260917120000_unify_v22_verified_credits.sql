-- V22-095 phase 4: move Verified generation onto the unified permanent balance.
-- The legacy implementation is retained only as an internal validation bridge;
-- its temporary legacy financial rows are removed in the same transaction.

begin;

-- Case erasure removes its workflow accounting as one referential cascade.
-- Direct ledger mutation remains forbidden; nested FK cascades are the only
-- exception to the immutable-ledger trigger.
alter table public.credit_ledger
  drop constraint credit_ledger_case_id_fkey,
  add constraint credit_ledger_case_id_fkey
    foreign key (case_id) references public.client_cases(id) on delete cascade,
  drop constraint credit_ledger_workflow_charge_id_fkey,
  add constraint credit_ledger_workflow_charge_id_fkey
    foreign key (workflow_charge_id) references public.workflow_charges(id) on delete cascade;

create or replace function public.prevent_v22_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'credit ledger is immutable';
end;
$$;

alter function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)
  rename to start_v22_verified_analysis_legacy_financial_bridge;

create function public.start_v22_verified_analysis(
  p_user_id uuid,
  p_case_id uuid,
  p_job_id uuid,
  p_idempotency_key text,
  p_parent_payload_checksum text,
  p_expected_parent_report_id uuid,
  p_previous_job_id uuid default null
)
returns table (
  job_id uuid,
  created boolean,
  idempotent boolean,
  parent_report_id uuid,
  gsc_snapshot_id uuid,
  ga4_snapshot_id uuid,
  public_gbp_snapshot_id uuid,
  credit_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  existing_job public.analysis_jobs%rowtype;
  bound public.verified_analysis_inputs%rowtype;
  charge public.workflow_charges%rowtype;
  legacy_result record;
  resulting_balance integer;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = ''
    or length(p_idempotency_key) > 200 then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;

  select * into existing_job
  from public.analysis_jobs j
  where j.id = p_job_id
     or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by case when j.id = p_job_id then 0 else 1 end
  limit 1
  for update;

  if existing_job.id is not null then
    select * into bound from public.verified_analysis_inputs i
      where i.job_id = existing_job.id;
    select * into charge from public.workflow_charges c
      where c.analysis_job_id = existing_job.id for update;
    if existing_job.id is distinct from p_job_id
      or existing_job.case_id is distinct from p_case_id
      or existing_job.job_type is distinct from 'verified_report'
      or existing_job.idempotency_key is distinct from p_idempotency_key
      or existing_job.previous_job_id is distinct from p_previous_job_id
      or bound.job_id is null or bound.case_id is distinct from p_case_id
      or bound.parent_report_id is distinct from p_expected_parent_report_id
      or bound.parent_payload_checksum is distinct from p_parent_payload_checksum
      or charge.id is null or charge.user_id is distinct from p_user_id
      or charge.case_id is distinct from p_case_id
      or charge.workflow_kind is distinct from 'verified'
      or charge.idempotency_key is distinct from p_idempotency_key then
      raise exception 'V22_VERIFIED_IDENTITY_CONFLICT';
    end if;
    select u.credit_balance into resulting_balance from public.users u where u.id = p_user_id;
    return query select p_job_id, false, true, bound.parent_report_id,
      bound.gsc_snapshot_id, bound.ga4_snapshot_id, bound.public_gbp_snapshot_id,
      resulting_balance;
    return;
  end if;

  -- Reserve the unified credit first. Any later eligibility failure rolls this
  -- mutation back together with every temporary legacy bridge write.
  update public.users u
  set credit_balance = u.credit_balance - 1,
      audit_credits = u.audit_credits + 1,
      updated_at = now()
  where u.id = p_user_id and u.credit_balance >= 1
  returning u.credit_balance into resulting_balance;
  if resulting_balance is null then raise exception 'INSUFFICIENT_CREDITS'; end if;

  select * into legacy_result
  from public.start_v22_verified_analysis_legacy_financial_bridge(
    p_user_id,
    p_case_id,
    p_job_id,
    p_idempotency_key,
    p_parent_payload_checksum,
    p_expected_parent_report_id,
    p_previous_job_id
  );
  if legacy_result.job_id is distinct from p_job_id
    or legacy_result.created is distinct from true
    or legacy_result.idempotent is distinct from false then
    raise exception 'V22_VERIFIED_BRIDGE_INVALID';
  end if;

  delete from public.audit_credit_ledger l
    where l.job_id = p_job_id and l.kind = 'attempt_debit';
  if not found then raise exception 'V22_VERIFIED_BRIDGE_LEDGER_INVALID'; end if;
  delete from public.analysis_attempt_charges c where c.job_id = p_job_id;
  if not found then raise exception 'V22_VERIFIED_BRIDGE_CHARGE_INVALID'; end if;

  insert into public.workflow_charges (
    id, user_id, case_id, workflow_kind, idempotency_key, analysis_job_id
  ) values (
    p_job_id, p_user_id, p_case_id, 'verified', p_idempotency_key, p_job_id
  );
  insert into public.credit_ledger (
    user_id, case_id, workflow_charge_id, analysis_job_id,
    kind, delta, balance_after, idempotency_key
  ) values (
    p_user_id, p_case_id, p_job_id, p_job_id,
    'verified_debit', -1, resulting_balance,
    'workflow:' || p_job_id::text || ':debit'
  );

  return query select p_job_id, true, false,
    legacy_result.parent_report_id,
    legacy_result.gsc_snapshot_id,
    legacy_result.ga4_snapshot_id,
    legacy_result.public_gbp_snapshot_id,
    resulting_balance;
end;
$$;

create or replace function public.settle_v22_verified_job_on_report_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_report public.reports%rowtype;
  charge public.workflow_charges%rowtype;
begin
  if new.job_type <> 'verified_report' or new.report_id is null then return new; end if;
  if new.report_id is distinct from new.id then raise exception 'V22_VERIFIED_REPORT_LINK_INVALID'; end if;
  select * into linked_report from public.reports r where r.id = new.report_id for share;
  if linked_report.id is null
    or linked_report.case_id is distinct from new.case_id
    or linked_report.report_type <> 'verified_execution'
    or linked_report.schema_version <> '2.2.0'
    or linked_report.report_v2_2 #>> '{report_version,report_id}' is distinct from new.id::text
    or linked_report.report_v2_2 #>> '{identity,case_id}' is distinct from new.case_id::text then
    raise exception 'V22_VERIFIED_REPORT_LINK_INVALID';
  end if;
  select * into charge from public.workflow_charges c
    where c.analysis_job_id = new.id for update;
  if charge.id is null or charge.case_id is distinct from new.case_id
    or charge.workflow_kind <> 'verified' or charge.state = 'compensated' then
    raise exception 'V22_VERIFIED_CHARGE_SETTLEMENT_INVALID';
  end if;
  if charge.state = 'reserved' then
    update public.workflow_charges c
    set state = 'consumed', final_report_id = new.report_id,
        settled_at = now()
    where c.id = charge.id and c.state = 'reserved';
  elsif charge.state = 'consumed'
    and charge.final_report_id is distinct from new.report_id then
    raise exception 'V22_VERIFIED_CHARGE_SETTLEMENT_INVALID';
  end if;
  new.status := 'succeeded';
  new.current_stage := 'completed';
  new.progress := 100;
  new.error_code := null;
  new.user_message := 'Analysis complete.';
  new.completed_at := coalesce(linked_report.completed_at, linked_report.generated_at::timestamptz, now());
  new.state_revision := greatest(new.state_revision, old.state_revision + 1);
  new.terminal_effects_revision := new.state_revision;
  return new;
end;
$$;

create or replace function public.resolve_v22_verified_analysis_input_strict_generation_v2(
  p_job_id uuid,
  p_case_id uuid,
  p_run_generation integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  charge public.workflow_charges;
  succeeded_report public.reports;
  source_snapshots jsonb;
  first_party jsonb;
  public_gbp jsonb;
begin
  select * into job
  from public.analysis_jobs j
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.job_type = 'verified_report'
    and j.run_generation = p_run_generation
  for share;
  if not found then raise exception 'V22_VERIFIED_JOB_INVALID'; end if;

  select * into bound
  from public.verified_analysis_inputs i
  where i.job_id = p_job_id and i.case_id = p_case_id
  for share;
  if not found then raise exception 'V22_VERIFIED_INPUT_INVALID'; end if;

  if job.status not in ('queued', 'running') then
    if job.status <> 'succeeded'
      or job.report_id is distinct from p_job_id
      or job.current_stage <> 'completed'
      or job.progress <> 100
      or job.error_code is not null
      or job.completed_at is null then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;
    select * into charge from public.workflow_charges c
      where c.analysis_job_id = p_job_id for share;
    select * into succeeded_report from public.reports r
      where r.id = p_job_id for share;
    if charge.id is null
      or charge.case_id is distinct from p_case_id
      or charge.workflow_kind <> 'verified'
      or charge.state <> 'consumed'
      or charge.settled_at is null
      or charge.final_report_id is distinct from p_job_id
      or succeeded_report.id is null
      or succeeded_report.case_id is distinct from p_case_id
      or succeeded_report.user_id is distinct from charge.user_id
      or succeeded_report.report_type <> 'verified_execution'
      or succeeded_report.schema_version <> '2.2.0'
      or succeeded_report.parent_report_id is distinct from bound.parent_report_id
      or succeeded_report.report_v2_2 #>> '{report_version,report_id}' is distinct from p_job_id::text
      or succeeded_report.report_v2_2 #>> '{report_version,report_type}' is distinct from 'verified_execution'
      or succeeded_report.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;
  end if;

  select jsonb_object_agg(d.source_type, jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at
  )) into source_snapshots
  from public.data_snapshots d
  where d.id = any(bound.parent_snapshot_ids);

  select jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'reference',d.provider_request_context->'customer_public_gbp_reference'
  ) into public_gbp
  from public.data_snapshots d
  where d.id = bound.public_gbp_snapshot_id
    and d.case_id = p_case_id
    and d.source_type = 'gbp';
  if public_gbp is null then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  select jsonb_agg(jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'binding_id',d.binding_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'identity_match_status','matched','health_status',d.health_status,'health_reasons',d.health_reasons,
    'normalized_payload',d.normalized_payload,'raw_payload',null,'payload_checksum',d.payload_checksum,
    'external_resource_id',d.provider_request_context->>'external_resource_id',
    'coverage_start',d.coverage_start,'coverage_end',d.coverage_end
  ) order by case d.id when bound.gsc_snapshot_id then 1 else 2 end) into first_party
  from public.data_snapshots d
  where d.id in (bound.gsc_snapshot_id, bound.ga4_snapshot_id);

  return jsonb_build_object(
    'schema_version','v22_verified_resolved_input_v1','job_id',p_job_id,
    'case_id',p_case_id,'parent_report',bound.parent_payload,
    'parent_payload_checksum',bound.parent_payload_checksum,
    'site_snapshot',source_snapshots->'site','serp_snapshot',source_snapshots->'serp',
    'competitor_snapshot',source_snapshots->'competitor','public_gbp_snapshot',public_gbp,
    'first_party_snapshots',first_party
  );
end;
$$;

create or replace function public.is_v22_verified_success_replay(
  p_job_id uuid,
  p_case_id uuid,
  p_run_generation integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.analysis_jobs j
    join public.verified_analysis_inputs i
      on i.job_id = j.id and i.case_id = j.case_id
    join public.workflow_charges c
      on c.analysis_job_id = j.id and c.case_id = j.case_id
    join public.reports r
      on r.id = j.report_id and r.case_id = j.case_id
    where j.id = p_job_id
      and j.case_id = p_case_id
      and j.job_type = 'verified_report'
      and j.status = 'succeeded'
      and j.current_stage = 'completed'
      and j.progress = 100
      and j.error_code is null
      and j.completed_at is not null
      and j.report_id = j.id
      and p_run_generation >= j.run_generation
      and c.workflow_kind = 'verified'
      and c.state = 'consumed'
      and c.settled_at is not null
      and c.final_report_id = r.id
      and c.user_id = r.user_id
      and r.report_type = 'verified_execution'
      and r.schema_version = '2.2.0'
      and r.parent_report_id = i.parent_report_id
      and r.version_number = (i.parent_payload #>> '{report_version,version_number}')::integer + 1
      and r.snapshot_ids = i.parent_snapshot_ids || array[i.gsc_snapshot_id, i.ga4_snapshot_id]
      and r.report_v2_2 #>> '{report_version,report_id}' = j.id::text
      and r.report_v2_2 #>> '{report_version,report_type}' = 'verified_execution'
      and r.report_v2_2 #>> '{report_version,schema_version}' = '2.2.0'
      and r.report_v2_2 #>> '{report_version,parent_report_id}' = i.parent_report_id::text
      and r.report_v2_2 #>> '{identity,case_id}' = j.case_id::text
      and r.report_v2_2 #>> '{first_party_performance,gsc,snapshot_id}' = i.gsc_snapshot_id::text
      and r.report_v2_2 #>> '{first_party_performance,ga4,snapshot_id}' = i.ga4_snapshot_id::text
  );
$$;

create function public.prevent_v22_report_backed_workflow_compensation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.state = 'compensated' and new.analysis_job_id is not null and exists (
    select 1
    from public.analysis_jobs j
    where j.id = new.analysis_job_id and j.report_id is not null
  ) then
    raise exception 'V22_REPORT_BACKED_JOB_CANNOT_BE_COMPENSATED';
  end if;
  return new;
end;
$$;

create trigger prevent_v22_report_backed_workflow_compensation
before update of state on public.workflow_charges
for each row
when (new.state = 'compensated' and old.state is distinct from new.state)
execute function public.prevent_v22_report_backed_workflow_compensation();

revoke all on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)
  to service_role;
revoke all on function public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.prevent_v22_report_backed_workflow_compensation()
  from public, anon, authenticated;

comment on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid) is
  'Freezes eligible Verified inputs and reserves one unified permanent credit exactly once.';
comment on function public.prevent_v22_report_backed_workflow_compensation() is
  'Prevents a unified credit refund after a durable report has been linked.';

commit;
