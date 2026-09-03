begin;

alter table public.orders
  add column case_id uuid references public.client_cases(id) on delete cascade,
  add column purchase_kind text not null default 'legacy_credit',
  add column checkout_session_id varchar(255) unique,
  add column checkout_url text;

alter table public.orders
  drop constraint if exists orders_credits_purchased_check,
  drop constraint if exists orders_payment_reference_check,
  add constraint orders_credits_purchased_check check (credits_purchased >= 0),
  add constraint orders_purchase_kind_check check (
    purchase_kind in ('legacy_credit', 'case_prospect_report')
  ),
  add constraint orders_checkout_url_check check (
    checkout_url is null or checkout_url ~ '^https://[^[:space:]]+$'
  ),
  add constraint orders_purchase_shape_check check (
    (purchase_kind = 'legacy_credit' and case_id is null and credits_purchased > 0) or
    (purchase_kind = 'case_prospect_report' and case_id is not null and credits_purchased = 0)
  ),
  add constraint orders_payment_reference_check check (
    payment_id is not null or
    order_id is not null or
    checkout_session_id is not null or
    (purchase_kind = 'case_prospect_report' and status in ('pending', 'failed'))
  );

create index idx_orders_case_id on public.orders (case_id)
  where case_id is not null;
create unique index uq_orders_active_case_prospect_checkout
  on public.orders (case_id)
  where purchase_kind = 'case_prospect_report' and status in ('pending', 'paid');

create table public.case_report_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  report_type text not null default 'prospect' check (report_type = 'prospect'),
  status text not null default 'available'
    check (status in ('available', 'reserved', 'consumed', 'payment_refunded')),
  reserved_job_id uuid references public.analysis_jobs(id) on delete set null,
  consumed_report_id uuid references public.reports(id) on delete set null,
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_report_entitlements_case_report_unique unique (case_id, report_type),
  constraint case_report_entitlements_state_check check (
    (status = 'available' and reserved_job_id is null and consumed_report_id is null and reserved_at is null and consumed_at is null) or
    (status = 'reserved' and reserved_job_id is not null and consumed_report_id is null and reserved_at is not null and consumed_at is null) or
    (status = 'consumed' and reserved_job_id is not null and consumed_report_id is not null and reserved_at is not null and consumed_at is not null) or
    (status = 'payment_refunded')
  )
);

create index idx_case_report_entitlements_user on public.case_report_entitlements (user_id);
create index idx_case_report_entitlements_case on public.case_report_entitlements (case_id);
create unique index uq_case_report_entitlements_reserved_job
  on public.case_report_entitlements (reserved_job_id)
  where reserved_job_id is not null;

create trigger set_case_report_entitlements_updated_at
before update on public.case_report_entitlements
for each row execute function public.set_v22_updated_at();

alter table public.case_report_entitlements enable row level security;
grant select, insert, update, delete on table public.case_report_entitlements to service_role;
revoke all on table public.case_report_entitlements from anon, authenticated;

create or replace function public.fulfill_v22_case_payment(
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_case_id uuid,
  p_amount integer,
  p_currency text
)
returns table (
  fulfilled boolean,
  idempotent boolean,
  entitlement_status text
)
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid;
  payment_order public.orders%rowtype;
  existing_entitlement public.case_report_entitlements%rowtype;
  was_paid boolean := false;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount < 0 or btrim(coalesce(p_currency, '')) = '' then
    raise exception 'invalid case payment';
  end if;

  select id into owner_id
  from public.users
  where clerk_user_id = p_clerk_user_id;
  if owner_id is null then
    raise exception 'case payment user not found';
  end if;

  if not exists (
    select 1 from public.client_cases
    where id = p_case_id and user_id = owner_id
  ) then
    raise exception 'case payment case does not belong to user';
  end if;

  select * into payment_order
  from public.orders
  where id = p_local_order_id
    and user_id = owner_id
    and case_id = p_case_id
    and purchase_kind = 'case_prospect_report'
  for update;
  if payment_order.id is null then
    raise exception 'case payment order does not match';
  end if;
  if payment_order.status = 'refunded' then
    raise exception 'case payment was refunded';
  end if;
  if payment_order.payment_id is not null and payment_order.payment_id <> p_payment_id then
    raise exception 'case payment reference does not match';
  end if;

  was_paid := payment_order.status = 'paid';
  update public.orders
  set payment_id = p_payment_id,
      amount = p_amount,
      currency = upper(p_currency),
      status = 'paid',
      paid_at = coalesce(paid_at, now())
  where id = payment_order.id;

  select * into existing_entitlement
  from public.case_report_entitlements
  where case_id = p_case_id and report_type = 'prospect'
  for update;
  if existing_entitlement.id is not null and existing_entitlement.order_id <> payment_order.id then
    raise exception 'case prospect report is already unlocked';
  end if;
  if existing_entitlement.id is null then
    insert into public.case_report_entitlements (user_id, case_id, order_id)
    values (owner_id, p_case_id, payment_order.id);
  end if;

  return query select true, was_paid, coalesce(existing_entitlement.status, 'available');
end;
$$;

create or replace function public.reserve_v22_case_report_entitlement(
  p_user_id uuid,
  p_case_id uuid,
  p_job_id uuid
)
returns table (reserved boolean, idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  entitlement public.case_report_entitlements%rowtype;
begin
  if not exists (
    select 1 from public.analysis_jobs
    where id = p_job_id and case_id = p_case_id and job_type = 'prospect_report'
  ) then
    raise exception 'prospect report job does not match case';
  end if;

  select * into entitlement
  from public.case_report_entitlements
  where user_id = p_user_id and case_id = p_case_id and report_type = 'prospect'
  for update;
  if entitlement.id is null then
    return query select false, false;
    return;
  end if;
  if entitlement.status = 'reserved' and entitlement.reserved_job_id = p_job_id then
    return query select true, true;
    return;
  end if;
  if entitlement.status <> 'available' then
    return query select false, false;
    return;
  end if;

  update public.case_report_entitlements
  set status = 'reserved', reserved_job_id = p_job_id, reserved_at = now()
  where id = entitlement.id;
  return query select true, false;
end;
$$;

create or replace function public.refund_v22_case_payment(
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_case_id uuid
)
returns table (refunded boolean, idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid;
  payment_order public.orders%rowtype;
begin
  select id into owner_id from public.users where clerk_user_id = p_clerk_user_id;
  if owner_id is null then raise exception 'case payment user not found'; end if;

  select * into payment_order
  from public.orders
  where id = p_local_order_id
    and user_id = owner_id
    and case_id = p_case_id
    and purchase_kind = 'case_prospect_report'
    and payment_id = p_payment_id
  for update;
  if payment_order.id is null then raise exception 'case payment order does not match'; end if;
  if payment_order.status = 'refunded' then
    return query select true, true;
    return;
  end if;

  update public.orders set status = 'refunded' where id = payment_order.id;
  update public.case_report_entitlements
  set status = 'payment_refunded'
  where order_id = payment_order.id and status <> 'payment_refunded';
  return query select true, false;
end;
$$;

create or replace function public.apply_analysis_job_event(
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
  p_completed_at timestamptz
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
begin
  if p_revision < 1 or p_status not in ('queued', 'running', 'succeeded', 'failed') then
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
  ) then
    raise exception 'invalid succeeded analysis job event';
  end if;
  if p_status = 'failed' and (
    p_current_stage <> 'failed' or p_completed_at is null or btrim(coalesce(p_error_code, '')) = ''
  ) then
    raise exception 'invalid failed analysis job event';
  end if;
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
      error_code = p_error_code,
      user_message = p_user_message,
      cost_counters = coalesce(p_cost_counters, '{}'::jsonb),
      started_at = case
        when p_status = 'running' then coalesce(j.started_at, p_heartbeat_at, now())
        else j.started_at
      end,
      heartbeat_at = p_heartbeat_at,
      completed_at = p_completed_at,
      state_revision = p_revision,
      terminal_effects_revision = case when is_terminal then p_revision else j.terminal_effects_revision end
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.state_revision < p_revision
    and j.status not in ('succeeded', 'failed');

  get diagnostics changed_rows = row_count;

  if changed_rows = 1 and p_status = 'failed' then
    update public.case_report_entitlements
    set status = 'available', reserved_job_id = null, reserved_at = null
    where reserved_job_id = p_job_id and status = 'reserved';
  elsif changed_rows = 1 and p_status = 'succeeded' then
    select report_id into completed_report_id
    from public.analysis_jobs where id = p_job_id;
    if exists (
      select 1 from public.case_report_entitlements
      where reserved_job_id = p_job_id and status = 'reserved'
    ) and completed_report_id is null then
      raise exception 'paid prospect job completed without a report';
    end if;
    update public.case_report_entitlements
    set status = 'consumed', consumed_report_id = completed_report_id, consumed_at = now()
    where reserved_job_id = p_job_id and status = 'reserved';
  end if;

  select j.state_revision into current_revision
  from public.analysis_jobs j
  where j.id = p_job_id and j.case_id = p_case_id;

  return query select
    true,
    changed_rows = 1,
    changed_rows = 1 and is_terminal,
    current_revision;
end;
$$;

revoke all on function public.fulfill_v22_case_payment(uuid, text, text, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.fulfill_v22_case_payment(uuid, text, text, uuid, integer, text)
  to service_role;
revoke all on function public.reserve_v22_case_report_entitlement(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_v22_case_report_entitlement(uuid, uuid, uuid)
  to service_role;
revoke all on function public.refund_v22_case_payment(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.refund_v22_case_payment(uuid, text, text, uuid)
  to service_role;

comment on table public.case_report_entitlements is
  'Case-scoped, single-use report generation rights created by paid v2.2 orders.';
comment on function public.fulfill_v22_case_payment is
  'Idempotently converts one verified Dodo payment into one Case-scoped prospect report entitlement.';
comment on function public.reserve_v22_case_report_entitlement is
  'Atomically reserves a paid prospect report entitlement for one durable analysis job.';
comment on function public.apply_analysis_job_event is
  'Atomically applies job state and returns or consumes a reserved Case report entitlement at terminal state.';

commit;
