-- V22-095 phase 2: bind a pre-discovery Prospect charge to its report job and settle it once.

begin;

create table public.prospect_discovery_tasks (
  discovery_job_id uuid primary key,
  workflow_charge_id uuid not null references public.workflow_charges(id) on delete cascade,
  idempotency_key text not null check (
    btrim(idempotency_key) <> '' and length(idempotency_key) <= 200
  ),
  created_at timestamptz not null default now(),
  constraint prospect_discovery_tasks_workflow_idempotency_unique
    unique (workflow_charge_id, idempotency_key)
);

create index idx_prospect_discovery_tasks_workflow
  on public.prospect_discovery_tasks (workflow_charge_id, created_at desc);

alter table public.prospect_discovery_tasks enable row level security;
grant select, insert, update, delete on table public.prospect_discovery_tasks to service_role;
revoke all on table public.prospect_discovery_tasks from public, anon, authenticated;

create function public.start_v22_prospect_discovery(
  p_user_id uuid,
  p_case_id uuid,
  p_workflow_id uuid,
  p_discovery_job_id uuid,
  p_workflow_idempotency_key text,
  p_task_idempotency_key text
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
  charge public.workflow_charges%rowtype;
  reservation record;
  task_inserted integer;
  resulting_balance integer;
begin
  if p_discovery_job_id is null or btrim(coalesce(p_task_idempotency_key, '')) = ''
     or length(p_task_idempotency_key) > 200 then
    raise exception 'INVALID_PROSPECT_DISCOVERY_TASK';
  end if;

  select * into charge
  from public.workflow_charges c
  where c.id = p_workflow_id
     or (c.user_id = p_user_id and c.idempotency_key = p_workflow_idempotency_key)
  order by case when c.id = p_workflow_id then 0 else 1 end
  limit 1
  for update;

  if charge.id is null then
    select * into reservation
    from public.reserve_v22_prospect_workflow(
      p_user_id, p_case_id, p_workflow_id, p_discovery_job_id,
      p_workflow_idempotency_key
    );
    select * into charge from public.workflow_charges where id = p_workflow_id;
  elsif charge.id is distinct from p_workflow_id
     or charge.user_id is distinct from p_user_id
     or charge.case_id is distinct from p_case_id
     or charge.workflow_kind is distinct from 'prospect'
     or charge.idempotency_key is distinct from p_workflow_idempotency_key then
    raise exception 'PROSPECT_WORKFLOW_IDENTITY_CONFLICT';
  end if;

  if charge.state <> 'reserved' then
    raise exception 'PROSPECT_WORKFLOW_NOT_RESERVED';
  end if;

  insert into public.prospect_discovery_tasks (
    discovery_job_id, workflow_charge_id, idempotency_key
  ) values (
    p_discovery_job_id, p_workflow_id, p_task_idempotency_key
  ) on conflict on constraint prospect_discovery_tasks_pkey do nothing;
  get diagnostics task_inserted = row_count;

  if task_inserted = 0 and not exists (
    select 1 from public.prospect_discovery_tasks t
    where t.discovery_job_id = p_discovery_job_id
      and t.workflow_charge_id = p_workflow_id
      and t.idempotency_key = p_task_idempotency_key
  ) then
    raise exception 'PROSPECT_DISCOVERY_IDENTITY_CONFLICT';
  end if;

  select u.credit_balance into resulting_balance
  from public.users u where u.id = p_user_id;
  return query select p_workflow_id, p_discovery_job_id, charge.state,
    task_inserted = 1,
    task_inserted = 0,
    resulting_balance;
end;
$$;

create function public.bind_v22_prospect_analysis(
  p_user_id uuid,
  p_case_id uuid,
  p_workflow_id uuid,
  p_job_id uuid,
  p_idempotency_key text,
  p_previous_job_id uuid default null
)
returns table (
  job_id uuid,
  workflow_id uuid,
  created boolean,
  idempotent boolean,
  credit_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  charge public.workflow_charges%rowtype;
  existing_job public.analysis_jobs%rowtype;
  resulting_balance integer;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = ''
     or length(p_idempotency_key) > 200 then
    raise exception 'INVALID_PROSPECT_ANALYSIS';
  end if;

  select * into charge
  from public.workflow_charges c
  where c.id = p_workflow_id
  for update;
  if charge.id is null or charge.user_id is distinct from p_user_id
     or charge.case_id is distinct from p_case_id
     or charge.workflow_kind is distinct from 'prospect' then
    raise exception 'PROSPECT_WORKFLOW_NOT_FOUND';
  end if;
  if charge.state <> 'reserved' then
    raise exception 'PROSPECT_WORKFLOW_NOT_RESERVED';
  end if;

  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs j
    where j.id = p_previous_job_id and j.case_id = p_case_id
      and j.job_type = 'prospect_report' and j.status = 'failed'
  ) then
    raise exception 'PREVIOUS_PROSPECT_ANALYSIS_INVALID';
  end if;

  select * into existing_job
  from public.analysis_jobs j
  where j.id = p_job_id
     or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by case when j.id = p_job_id then 0 else 1 end
  limit 1
  for update;

  if existing_job.id is not null then
    if existing_job.id is distinct from p_job_id
       or existing_job.case_id is distinct from p_case_id
       or existing_job.job_type is distinct from 'prospect_report'
       or existing_job.idempotency_key is distinct from p_idempotency_key
       or charge.analysis_job_id is distinct from p_job_id then
      raise exception 'PROSPECT_ANALYSIS_IDENTITY_CONFLICT';
    end if;
    select u.credit_balance into resulting_balance
    from public.users u where u.id = p_user_id;
    return query select p_job_id, p_workflow_id, false, true, resulting_balance;
    return;
  end if;

  if charge.analysis_job_id is not null then
    raise exception 'PROSPECT_WORKFLOW_ALREADY_BOUND';
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

  update public.workflow_charges
  set analysis_job_id = p_job_id
  where id = p_workflow_id and analysis_job_id is null;

  select u.credit_balance into resulting_balance
  from public.users u where u.id = p_user_id;
  return query select p_job_id, p_workflow_id, true, false, resulting_balance;
end;
$$;

create function public.settle_v22_workflow_charge_on_job_terminal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  charge public.workflow_charges%rowtype;
  resulting_balance integer;
begin
  if new.status not in ('succeeded', 'failed')
     or old.status in ('succeeded', 'failed') then
    return new;
  end if;

  select * into charge
  from public.workflow_charges c
  where c.analysis_job_id = new.id
  for update;
  if charge.id is null or charge.state <> 'reserved' then
    return new;
  end if;

  if new.status = 'succeeded' then
    if new.report_id is null then
      raise exception 'WORKFLOW_COMPLETED_WITHOUT_REPORT';
    end if;
    update public.workflow_charges
    set state = 'consumed', final_report_id = new.report_id, settled_at = now()
    where id = charge.id and state = 'reserved';
    return new;
  end if;

  update public.workflow_charges
  set state = 'compensated', settled_at = now()
  where id = charge.id and state = 'reserved';
  if not found then return new; end if;

  update public.users u
  set credit_balance = u.credit_balance + 1,
      updated_at = now()
  where u.id = charge.user_id
  returning u.credit_balance into resulting_balance;

  insert into public.credit_ledger (
    user_id, case_id, workflow_charge_id, analysis_job_id,
    kind, delta, balance_after, idempotency_key
  ) values (
    charge.user_id, charge.case_id, charge.id, new.id,
    'technical_failure_credit', 1, resulting_balance,
    'workflow:' || charge.id::text || ':technical-failure'
  ) on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

create trigger settle_v22_workflow_charge_on_job_terminal
after update of status on public.analysis_jobs
for each row execute function public.settle_v22_workflow_charge_on_job_terminal();

revoke all on function public.bind_v22_prospect_analysis(uuid,uuid,uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.bind_v22_prospect_analysis(uuid,uuid,uuid,uuid,text,uuid)
  to service_role;
revoke all on function public.start_v22_prospect_discovery(uuid,uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.start_v22_prospect_discovery(uuid,uuid,uuid,uuid,text,text)
  to service_role;
revoke all on function public.settle_v22_workflow_charge_on_job_terminal()
  from public, anon, authenticated;

comment on function public.bind_v22_prospect_analysis(uuid,uuid,uuid,uuid,text,uuid) is
  'Binds a charged Prospect workflow to report generation without spending another credit.';
comment on function public.start_v22_prospect_discovery(uuid,uuid,uuid,uuid,text,text) is
  'Creates the first or a follow-up discovery task under one already charged Prospect workflow.';
comment on function public.settle_v22_workflow_charge_on_job_terminal() is
  'Consumes or compensates a unified workflow charge exactly once when its bound job becomes terminal.';

commit;
