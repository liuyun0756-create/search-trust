-- V22-095 phase 1: unified permanent account credits and pre-discovery Prospect reservation.

begin;

alter table public.users
  add column credit_balance integer not null default 0 check (credit_balance >= 0);

create table public.workflow_charges (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  workflow_kind text not null check (workflow_kind in ('prospect', 'verified')),
  state text not null default 'reserved' check (state in ('reserved', 'consumed', 'compensated')),
  amount integer not null default 1 check (amount = 1),
  idempotency_key text not null check (
    btrim(idempotency_key) <> '' and length(idempotency_key) <= 200
  ),
  discovery_job_id uuid,
  analysis_job_id uuid unique references public.analysis_jobs(id) on delete restrict,
  final_report_id uuid unique references public.reports(id) on delete restrict,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workflow_charges_user_idempotency_unique unique (user_id, idempotency_key),
  constraint workflow_charges_settlement_check check (
    (state = 'reserved' and settled_at is null and final_report_id is null) or
    (state = 'consumed' and settled_at is not null and final_report_id is not null) or
    (state = 'compensated' and settled_at is not null and final_report_id is null)
  ),
  constraint workflow_charges_prospect_discovery_check check (
    workflow_kind <> 'prospect' or discovery_job_id is not null
  )
);

create unique index uq_workflow_charges_discovery_job
  on public.workflow_charges (discovery_job_id)
  where discovery_job_id is not null;
create index idx_workflow_charges_case_created
  on public.workflow_charges (case_id, created_at desc);
create index idx_workflow_charges_user_created
  on public.workflow_charges (user_id, created_at desc);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete set null,
  workflow_charge_id uuid references public.workflow_charges(id) on delete restrict,
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict,
  kind text not null check (kind in (
    'welcome_grant', 'credit_purchase', 'prospect_debit', 'verified_debit',
    'technical_failure_credit', 'purchase_refund_debit'
  )),
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  idempotency_key text not null unique check (
    btrim(idempotency_key) <> '' and length(idempotency_key) <= 240
  ),
  created_at timestamptz not null default now(),
  constraint credit_ledger_delta_check check (
    (kind = 'welcome_grant' and delta = 5) or
    (kind in ('credit_purchase', 'technical_failure_credit') and delta = 1) or
    (kind in ('prospect_debit', 'verified_debit', 'purchase_refund_debit') and delta = -1)
  ),
  constraint credit_ledger_reference_check check (
    (kind = 'welcome_grant' and case_id is null and workflow_charge_id is null
      and analysis_job_id is null and order_id is null) or
    (kind in ('prospect_debit', 'verified_debit', 'technical_failure_credit')
      and case_id is not null and workflow_charge_id is not null and order_id is null) or
    (kind in ('credit_purchase', 'purchase_refund_debit')
      and workflow_charge_id is null and analysis_job_id is null and order_id is not null)
  )
);

create unique index uq_credit_ledger_welcome_grant
  on public.credit_ledger (user_id)
  where kind = 'welcome_grant';
create unique index uq_credit_ledger_workflow_kind
  on public.credit_ledger (workflow_charge_id, kind)
  where workflow_charge_id is not null;
create unique index uq_credit_ledger_order_kind
  on public.credit_ledger (order_id, kind)
  where order_id is not null;
create index idx_credit_ledger_user_created
  on public.credit_ledger (user_id, created_at desc);

create function public.prevent_v22_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'credit ledger is immutable';
end;
$$;

create trigger prevent_v22_credit_ledger_mutation
before update or delete on public.credit_ledger
for each row execute function public.prevent_v22_credit_ledger_mutation();

alter table public.workflow_charges enable row level security;
alter table public.credit_ledger enable row level security;
grant select, insert, update, delete on table public.workflow_charges to service_role;
grant select, insert on table public.credit_ledger to service_role;
revoke all on table public.workflow_charges from public, anon, authenticated;
revoke all on table public.credit_ledger from public, anon, authenticated;

create or replace function public.register_v22_clerk_user(
  p_clerk_user_id text,
  p_subject_digest bytea,
  p_email text,
  p_name text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  local_user_id uuid;
  registration_outcome text;
  resulting_balance integer;
  inserted_rows integer;
begin
  if p_clerk_user_id is null or btrim(p_clerk_user_id) = '' or octet_length(p_clerk_user_id) > 255 or
     octet_length(p_subject_digest) <> 32 or
     p_email is null or btrim(p_email) = '' or octet_length(p_email) > 255 or
     (p_name is not null and octet_length(p_name) > 255) then
    raise exception using errcode = '22023', message = 'INVALID_IDENTITY_PROFILE';
  end if;

  lock table public.identity_deletion_receipts in share row exclusive mode;
  if exists (
    select 1 from public.identity_deletion_receipts
    where subject_digest = p_subject_digest
      and completed_at >= now() - interval '90 days'
  ) then
    return 'blocked_deleted_identity';
  end if;

  select id into local_user_id
  from public.users
  where clerk_user_id = p_clerk_user_id
  for update;

  if local_user_id is null then
    insert into public.users (clerk_user_id, email, name, audit_credits, credit_balance)
    values (p_clerk_user_id, p_email, p_name, 0, 0)
    returning id into local_user_id;
    registration_outcome := 'created';
  else
    update public.users
    set email = p_email, name = p_name, updated_at = now()
    where id = local_user_id;
    registration_outcome := 'existing';
  end if;

  insert into public.credit_ledger (
    user_id, kind, delta, balance_after, idempotency_key
  ) values (
    local_user_id, 'welcome_grant', 5, 5, 'welcome:' || local_user_id::text
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 1 then
    update public.users
    set credit_balance = credit_balance + 5,
        updated_at = now()
    where id = local_user_id
    returning credit_balance into resulting_balance;
    if resulting_balance <> 5 then
      raise exception 'WELCOME_GRANT_BALANCE_INVALID';
    end if;
  end if;

  return registration_outcome;
end;
$$;

create function public.reserve_v22_prospect_workflow(
  p_user_id uuid,
  p_case_id uuid,
  p_workflow_id uuid,
  p_discovery_job_id uuid,
  p_idempotency_key text
)
returns table (
  workflow_id uuid,
  discovery_job_id uuid,
  charge_state text,
  created boolean,
  idempotent boolean,
  credit_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  existing_charge public.workflow_charges%rowtype;
  resulting_balance integer;
begin
  if p_workflow_id is null or p_discovery_job_id is null or
     btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200 then
    raise exception 'INVALID_PROSPECT_WORKFLOW';
  end if;

  if not exists (
    select 1 from public.client_cases c
    where c.id = p_case_id and c.user_id = p_user_id and c.status = 'active'
    for no key update
  ) then
    raise exception 'PROSPECT_WORKFLOW_CASE_INVALID';
  end if;

  select * into existing_charge
  from public.workflow_charges c
  where c.id = p_workflow_id
     or (c.user_id = p_user_id and c.idempotency_key = p_idempotency_key)
  order by case when c.id = p_workflow_id then 0 else 1 end
  limit 1
  for update;

  if existing_charge.id is not null then
    if existing_charge.id is distinct from p_workflow_id
       or existing_charge.user_id is distinct from p_user_id
       or existing_charge.case_id is distinct from p_case_id
       or existing_charge.workflow_kind is distinct from 'prospect'
       or existing_charge.discovery_job_id is distinct from p_discovery_job_id
       or existing_charge.idempotency_key is distinct from p_idempotency_key then
      raise exception 'PROSPECT_WORKFLOW_IDENTITY_CONFLICT';
    end if;
    select u.credit_balance into resulting_balance
    from public.users u where u.id = p_user_id;
    return query select existing_charge.id, existing_charge.discovery_job_id,
      existing_charge.state, false, true, resulting_balance;
    return;
  end if;

  update public.users u
  set credit_balance = u.credit_balance - 1,
      updated_at = now()
  where u.id = p_user_id and u.credit_balance >= 1
  returning u.credit_balance into resulting_balance;
  if resulting_balance is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.workflow_charges (
    id, user_id, case_id, workflow_kind, idempotency_key, discovery_job_id
  ) values (
    p_workflow_id, p_user_id, p_case_id, 'prospect', p_idempotency_key, p_discovery_job_id
  );

  insert into public.credit_ledger (
    user_id, case_id, workflow_charge_id, kind, delta, balance_after, idempotency_key
  ) values (
    p_user_id, p_case_id, p_workflow_id, 'prospect_debit', -1, resulting_balance,
    'workflow:' || p_workflow_id::text || ':debit'
  );

  return query select p_workflow_id, p_discovery_job_id, 'reserved'::text,
    true, false, resulting_balance;
end;
$$;

revoke all on function public.prevent_v22_credit_ledger_mutation()
  from public, anon, authenticated;
revoke all on function public.reserve_v22_prospect_workflow(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.reserve_v22_prospect_workflow(uuid,uuid,uuid,uuid,text)
  to service_role;

comment on column public.users.credit_balance is
  'Current permanent V2.2 analysis credit balance; every change requires unified ledger evidence.';
comment on table public.workflow_charges is
  'One exactly-once credit charge for a Prospect or Verified workflow.';
comment on table public.credit_ledger is
  'Immutable unified credit transaction evidence with resulting account balance.';
comment on function public.reserve_v22_prospect_workflow(uuid,uuid,uuid,uuid,text) is
  'Atomically reserves one permanent credit before any provider-backed Prospect discovery begins.';

commit;
