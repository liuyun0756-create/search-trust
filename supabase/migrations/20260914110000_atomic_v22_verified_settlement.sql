begin;

-- A Verified report is the durable success boundary. Linking it to its paid job
-- must settle both the task state and its one-credit charge in this transaction,
-- before an HTTP acknowledgement can be lost or the Worker can exit.
create function public.settle_v22_verified_job_on_report_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_report public.reports;
  charge public.analysis_attempt_charges;
begin
  if new.job_type <> 'verified_report' or new.report_id is null then
    return new;
  end if;
  if new.report_id is distinct from new.id then
    raise exception 'V22_VERIFIED_REPORT_LINK_INVALID';
  end if;

  select * into linked_report
  from public.reports r
  where r.id = new.report_id
  for share;
  if linked_report.id is null
    or linked_report.case_id is distinct from new.case_id
    or linked_report.report_type <> 'verified_execution'
    or linked_report.schema_version <> '2.2.0'
    or linked_report.report_v2_2 #>> '{report_version,report_id}' is distinct from new.id::text
    or linked_report.report_v2_2 #>> '{identity,case_id}' is distinct from new.case_id::text then
    raise exception 'V22_VERIFIED_REPORT_LINK_INVALID';
  end if;

  select * into charge
  from public.analysis_attempt_charges c
  where c.job_id = new.id
  for update;
  if charge.id is null or charge.case_id is distinct from new.case_id
    or charge.source <> 'account_credit' or charge.state = 'compensated' then
    raise exception 'V22_VERIFIED_CHARGE_SETTLEMENT_INVALID';
  end if;
  if charge.state = 'reserved' then
    update public.analysis_attempt_charges c
    set state = 'consumed', settled_at = now()
    where c.id = charge.id and c.state = 'reserved';
  end if;

  new.status := 'succeeded';
  new.current_stage := 'completed';
  new.progress := 100;
  new.error_code := null;
  new.user_message := 'Analysis complete.';
  new.completed_at := coalesce(
    linked_report.completed_at,
    linked_report.generated_at::timestamptz,
    now()
  );
  new.state_revision := greatest(new.state_revision, old.state_revision + 1);
  new.terminal_effects_revision := new.state_revision;
  return new;
end;
$$;

create trigger settle_v22_verified_job_on_report_link
before update of report_id on public.analysis_jobs
for each row
when (new.job_type = 'verified_report' and new.report_id is not null)
execute function public.settle_v22_verified_job_on_report_link();

-- Defense in depth for all present and future settlement callers: a durable
-- report and a refunded credit may never coexist. If a stale failure callback
-- races report persistence, PostgreSQL row locks select one complete outcome.
create function public.prevent_v22_report_backed_compensation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.state = 'compensated' and exists (
    select 1
    from public.analysis_jobs j
    where j.id = new.job_id and j.report_id is not null
  ) then
    raise exception 'V22_REPORT_BACKED_JOB_CANNOT_BE_COMPENSATED';
  end if;
  return new;
end;
$$;

create trigger prevent_v22_report_backed_compensation
before update of state on public.analysis_attempt_charges
for each row
when (new.state = 'compensated' and old.state is distinct from new.state)
execute function public.prevent_v22_report_backed_compensation();

-- Repair a transaction committed by a briefly mixed-version deployment. The
-- trigger is idempotent and rejects any already-refunded split-brain row rather
-- than silently preserving both a report and a restored credit.
update public.analysis_jobs j
set report_id = j.report_id
where j.job_type = 'verified_report' and j.report_id is not null
  and (
    j.status <> 'succeeded'
    or exists (
      select 1 from public.analysis_attempt_charges c
      where c.job_id = j.id and c.state <> 'consumed'
    )
  );

revoke all on function public.settle_v22_verified_job_on_report_link() from public, anon, authenticated;
revoke all on function public.prevent_v22_report_backed_compensation() from public, anon, authenticated;

comment on function public.settle_v22_verified_job_on_report_link() is
  'Atomically succeeds and consumes the paid Verified attempt when its immutable report is linked.';
comment on function public.prevent_v22_report_backed_compensation() is
  'Prevents any settlement path from refunding a job that already owns a durable report.';

commit;
