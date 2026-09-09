-- V22-080: immutable attempt charging, failure compensation and generation fencing.

begin;

alter table public.analysis_jobs
  add column run_generation integer not null default 1 check (run_generation >= 1),
  add column deadline_at timestamptz not null default (now() + interval '20 minutes'),
  add column previous_job_id uuid references public.analysis_jobs(id) on delete set null;

alter table public.analysis_jobs
  add constraint analysis_jobs_deadline_check check (deadline_at > created_at),
  add constraint analysis_jobs_previous_check check (previous_job_id is null or previous_job_id <> id);

drop index if exists public.uq_case_report_entitlements_reserved_job;
alter table public.case_report_entitlements
  drop constraint case_report_entitlements_status_check,
  drop constraint case_report_entitlements_state_check;
alter table public.case_report_entitlements
  add constraint case_report_entitlements_status_check check (
    status in ('available', 'reserved', 'consumed', 'compensated', 'payment_refunded')
  ),
  add constraint case_report_entitlements_state_check check (
    (status = 'available' and reserved_job_id is null and consumed_report_id is null and reserved_at is null and consumed_at is null) or
    (status = 'reserved' and reserved_job_id is not null and consumed_report_id is null and reserved_at is not null and consumed_at is null) or
    (status = 'consumed' and reserved_job_id is not null and consumed_report_id is not null and reserved_at is not null and consumed_at is not null) or
    (status = 'compensated' and reserved_job_id is not null and consumed_report_id is null and reserved_at is not null and consumed_at is null) or
    (status = 'payment_refunded')
  );
create unique index uq_case_report_entitlements_reserved_job
  on public.case_report_entitlements (reserved_job_id)
  where reserved_job_id is not null;

create table public.analysis_attempt_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  job_id uuid not null unique references public.analysis_jobs(id) on delete cascade,
  source text not null check (source in ('case_purchase', 'account_credit')),
  state text not null default 'reserved' check (state in ('reserved', 'consumed', 'compensated')),
  amount integer not null default 1 check (amount = 1),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint analysis_attempt_charges_settlement_check check (
    (state = 'reserved' and settled_at is null) or
    (state in ('consumed', 'compensated') and settled_at is not null)
  )
);

create index idx_analysis_attempt_charges_user_created
  on public.analysis_attempt_charges (user_id, created_at desc);
create index idx_analysis_attempt_charges_case_created
  on public.analysis_attempt_charges (case_id, created_at desc);

create table public.audit_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete set null,
  job_id uuid references public.analysis_jobs(id) on delete set null,
  kind text not null check (kind in ('attempt_debit', 'technical_failure_credit')),
  delta integer not null check (
    (kind = 'attempt_debit' and delta = -1) or
    (kind = 'technical_failure_credit' and delta = 1)
  ),
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  constraint audit_credit_ledger_job_kind_unique unique (job_id, kind)
);

create index idx_audit_credit_ledger_user_created
  on public.audit_credit_ledger (user_id, created_at desc);

alter table public.analysis_attempt_charges enable row level security;
alter table public.audit_credit_ledger enable row level security;
grant select, insert, update, delete on table public.analysis_attempt_charges to service_role;
grant select, insert, update, delete on table public.audit_credit_ledger to service_role;
revoke all on table public.analysis_attempt_charges from anon, authenticated;
revoke all on table public.audit_credit_ledger from anon, authenticated;

drop function public.start_v22_prospect_analysis(uuid, uuid, uuid, text);

create function public.start_v22_prospect_analysis(
  p_user_id uuid,
  p_case_id uuid,
  p_job_id uuid,
  p_idempotency_key text,
  p_previous_job_id uuid default null
)
returns table (
  job_id uuid,
  created boolean,
  idempotent boolean
)
language plpgsql
set search_path = public
as $$
declare
  existing_job public.analysis_jobs%rowtype;
  entitlement public.case_report_entitlements%rowtype;
  selected_source text;
  resulting_balance integer;
begin
  if btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200 then
    raise exception 'invalid prospect analysis idempotency key';
  end if;
  if not exists (
    select 1 from public.client_cases
    where id = p_case_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'prospect analysis case does not belong to user';
  end if;
  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs
    where id = p_previous_job_id and case_id = p_case_id and status = 'failed'
  ) then
    raise exception 'previous prospect analysis is not a failed Case task';
  end if;

  select * into existing_job
  from public.analysis_jobs
  where id = p_job_id
     or (case_id = p_case_id and idempotency_key = p_idempotency_key)
  order by case when id = p_job_id then 0 else 1 end
  limit 1
  for update;

  if existing_job.id is not null then
    if existing_job.id <> p_job_id
       or existing_job.case_id <> p_case_id
       or existing_job.job_type <> 'prospect_report'
       or existing_job.idempotency_key <> p_idempotency_key then
      raise exception 'prospect analysis identity conflicts with an existing job';
    end if;
    select c.source, u.audit_credits into selected_source, resulting_balance
    from public.analysis_attempt_charges c
    join public.users u on u.id = c.user_id
    where c.job_id = p_job_id;
    return query select p_job_id, false, true;
    return;
  end if;

  select * into entitlement
  from public.case_report_entitlements
  where user_id = p_user_id and case_id = p_case_id and report_type = 'prospect'
  for update;

  if entitlement.id is not null and entitlement.status = 'available' then
    selected_source := 'case_purchase';
  else
    update public.users
    set audit_credits = audit_credits - 1
    where id = p_user_id and audit_credits >= 1
    returning audit_credits into resulting_balance;
    if resulting_balance is null then
      raise exception 'prospect report credit is not available';
    end if;
    selected_source := 'account_credit';
  end if;

  insert into public.analysis_jobs (
    id, case_id, job_type, status, current_stage, progress,
    attempt_count, idempotency_key, cost_counters, run_generation,
    deadline_at, previous_job_id
  ) values (
    p_job_id, p_case_id, 'prospect_report', 'queued', 'queued', 0,
    0, p_idempotency_key, '{}'::jsonb, 1,
    now() + interval '20 minutes', p_previous_job_id
  );

  insert into public.analysis_attempt_charges (user_id, case_id, job_id, source)
  values (p_user_id, p_case_id, p_job_id, selected_source);

  if selected_source = 'case_purchase' then
    update public.case_report_entitlements
    set status = 'reserved', reserved_job_id = p_job_id, reserved_at = now()
    where id = entitlement.id and status = 'available';
    select audit_credits into resulting_balance from public.users where id = p_user_id;
  else
    insert into public.audit_credit_ledger (
      user_id, case_id, job_id, kind, delta, balance_after
    ) values (
      p_user_id, p_case_id, p_job_id, 'attempt_debit', -1, resulting_balance
    );
  end if;

  return query select p_job_id, true, false;
end;
$$;

drop function public.apply_analysis_job_event(
  uuid, uuid, bigint, text, text, smallint, integer, text, text, jsonb, timestamptz, timestamptz
);

create function public.apply_analysis_job_event(
  p_job_id uuid,
  p_case_id uuid,
  p_revision bigint,
  p_status text,
  p_current_stage text,
  p_progress smallint,
  p_attempt_count integer,
  p_error_code text,
  p_user_message text,
  p_cost_counters jsonb,
  p_heartbeat_at timestamptz,
  p_completed_at timestamptz,
  p_run_generation integer default 1,
  p_deadline_at timestamptz default null
)
returns table (
  found boolean,
  applied boolean,
  terminal_effects_applied boolean,
  state_revision bigint
)
language plpgsql
set search_path = public
as $$
declare
  changed_rows integer := 0;
  current_revision bigint := 0;
  is_terminal boolean := p_status in ('succeeded', 'failed');
  completed_report_id uuid;
  charge public.analysis_attempt_charges%rowtype;
  new_balance integer;
begin
  if p_revision < 1 or p_run_generation < 1
     or p_status not in ('queued', 'running', 'succeeded', 'failed') then
    raise exception 'invalid analysis job event';
  end if;
  if btrim(coalesce(p_current_stage, '')) = '' or p_progress not between 0 and 100 or p_attempt_count < 0 then
    raise exception 'invalid analysis job event fields';
  end if;
  if jsonb_typeof(coalesce(p_cost_counters, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid analysis job cost counters';
  end if;
  if p_status = 'succeeded' and (
    p_progress <> 100 or p_current_stage <> 'completed' or p_completed_at is null or p_error_code is not null
  ) then raise exception 'invalid succeeded analysis job event'; end if;
  if p_status = 'failed' and (
    p_current_stage <> 'failed' or p_completed_at is null or btrim(coalesce(p_error_code, '')) = ''
  ) then raise exception 'invalid failed analysis job event'; end if;
  if p_status in ('queued', 'running') and (p_completed_at is not null or p_error_code is not null) then
    raise exception 'invalid non-terminal analysis job event';
  end if;

  if not exists (
    select 1 from public.analysis_jobs j where j.id = p_job_id and j.case_id = p_case_id
  ) then
    return query select false, false, false, 0::bigint;
    return;
  end if;

  update public.analysis_jobs as j
  set status = p_status,
      current_stage = p_current_stage,
      progress = p_progress,
      attempt_count = p_attempt_count,
      run_generation = p_run_generation,
      deadline_at = coalesce(p_deadline_at, j.deadline_at),
      error_code = p_error_code,
      user_message = p_user_message,
      cost_counters = coalesce(p_cost_counters, '{}'::jsonb),
      started_at = case when p_status = 'running' then coalesce(j.started_at, p_heartbeat_at, now()) else j.started_at end,
      heartbeat_at = p_heartbeat_at,
      completed_at = p_completed_at,
      state_revision = p_revision,
      terminal_effects_revision = case when is_terminal then p_revision else j.terminal_effects_revision end
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.state_revision < p_revision
    and j.run_generation <= p_run_generation
    and j.status not in ('succeeded', 'failed');

  get diagnostics changed_rows = row_count;

  if changed_rows = 1 and is_terminal then
    select * into charge
    from public.analysis_attempt_charges
    where job_id = p_job_id
    for update;
    if charge.id is not null and p_status = 'failed' and charge.state = 'reserved' then
      update public.analysis_attempt_charges
      set state = 'compensated', settled_at = now()
      where id = charge.id;
      update public.users
      set audit_credits = audit_credits + 1
      where id = charge.user_id
      returning audit_credits into new_balance;
      insert into public.audit_credit_ledger (
        user_id, case_id, job_id, kind, delta, balance_after
      ) values (
        charge.user_id, charge.case_id, charge.job_id,
        'technical_failure_credit', 1, new_balance
      ) on conflict (job_id, kind) do nothing;
      if charge.source = 'case_purchase' then
        update public.case_report_entitlements
        set status = 'compensated'
        where reserved_job_id = p_job_id and status = 'reserved';
      end if;
    elsif charge.id is not null and p_status = 'succeeded' and charge.state = 'reserved' then
      select report_id into completed_report_id
      from public.analysis_jobs where id = p_job_id;
      if completed_report_id is null then
        raise exception 'paid prospect job completed without a report';
      end if;
      update public.analysis_attempt_charges
      set state = 'consumed', settled_at = now()
      where id = charge.id;
      if charge.source = 'case_purchase' then
        update public.case_report_entitlements
        set status = 'consumed', consumed_report_id = completed_report_id, consumed_at = now()
        where reserved_job_id = p_job_id and status = 'reserved';
      end if;
    end if;
  end if;

  select j.state_revision into current_revision
  from public.analysis_jobs j
  where j.id = p_job_id and j.case_id = p_case_id;

  return query select true, changed_rows = 1, changed_rows = 1 and is_terminal, current_revision;
end;
$$;

revoke all on function public.start_v22_prospect_analysis(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.start_v22_prospect_analysis(uuid, uuid, uuid, text, uuid)
  to service_role;
revoke all on function public.apply_analysis_job_event(
  uuid, uuid, bigint, text, text, smallint, integer, text, text, jsonb,
  timestamptz, timestamptz, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_analysis_job_event(
  uuid, uuid, bigint, text, text, smallint, integer, text, text, jsonb,
  timestamptz, timestamptz, integer, timestamptz
) to service_role;

comment on table public.analysis_attempt_charges is
  'Exactly one immutable one-credit-equivalent charge for each v2.2 logical report attempt.';
comment on table public.audit_credit_ledger is
  'Immutable account-credit debits and technical-failure compensation provenance.';
comment on function public.start_v22_prospect_analysis(uuid, uuid, uuid, text, uuid) is
  'Atomically creates a new logical attempt and charges the Case purchase or one account credit.';
comment on function public.apply_analysis_job_event is
  'Applies generation-fenced task state and settles its charge exactly once at terminal state.';

create function public.persist_v22_prospect_result(
  p_job_id uuid,
  p_case_id uuid,
  p_site_snapshot_id uuid,
  p_site_payload jsonb,
  p_site_checksum text,
  p_serp_snapshot_id uuid,
  p_serp_payload jsonb,
  p_serp_checksum text,
  p_serp_expires_at timestamptz,
  p_competitor_snapshot_id uuid,
  p_competitor_payload jsonb,
  p_competitor_checksum text,
  p_report_payload jsonb,
  p_run_generation integer
)
returns table (report_id uuid, idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  current_generation integer;
begin
  select run_generation into current_generation
  from public.analysis_jobs
  where id = p_job_id and case_id = p_case_id
  for update;
  if current_generation is null or current_generation <> p_run_generation then
    raise exception 'prospect analysis generation is no longer active';
  end if;
  return query
  select * from public.persist_v22_prospect_result(
    p_job_id, p_case_id,
    p_site_snapshot_id, p_site_payload, p_site_checksum,
    p_serp_snapshot_id, p_serp_payload, p_serp_checksum, p_serp_expires_at,
    p_competitor_snapshot_id, p_competitor_payload, p_competitor_checksum,
    p_report_payload
  );
end;
$$;

revoke all on function public.persist_v22_prospect_result(
  uuid, uuid, uuid, jsonb, text, uuid, jsonb, text, timestamptz,
  uuid, jsonb, text, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.persist_v22_prospect_result(
  uuid, uuid, uuid, jsonb, text, uuid, jsonb, text, timestamptz,
  uuid, jsonb, text, jsonb, integer
) to service_role;

commit;
