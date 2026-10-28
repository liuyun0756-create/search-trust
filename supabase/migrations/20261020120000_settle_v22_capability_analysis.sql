-- Additive completion boundary. Does not enable intake or replace the legacy worker.
begin;

alter table public.analysis_jobs
  add column capability_report_id uuid unique references public.capability_report_versions(id) deferrable initially deferred,
  add constraint analysis_job_report_variant check (num_nonnulls(report_id,capability_report_id)<=1);
alter table public.workflow_charges
  add column final_capability_report_id uuid unique references public.capability_report_versions(id) on delete restrict,
  drop constraint workflow_charges_settlement_check,
  add constraint workflow_charges_settlement_check check (
    (state='reserved' and settled_at is null and num_nonnulls(final_report_id,final_capability_report_id)=0) or
    (state='consumed' and settled_at is not null and num_nonnulls(final_report_id,final_capability_report_id)=1) or
    (state='compensated' and settled_at is not null and num_nonnulls(final_report_id,final_capability_report_id)=0)
  );

-- A candidate is not an entitlement. All new delivery callers must use this gate.
create function public.get_v22_completed_capability_report(p_user_id uuid,p_case_id uuid,p_report_id uuid)
returns setof public.capability_report_versions
language sql stable security definer set search_path=public as $$
  select r.* from public.capability_report_versions r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  join public.analysis_jobs j on j.id=r.id and j.case_id=r.case_id
  join public.workflow_charges c on c.analysis_job_id=j.id and c.case_id=r.case_id and c.user_id=r.user_id
  where r.id=p_report_id and r.user_id=p_user_id and r.case_id=p_case_id
    and j.status='succeeded' and j.capability_report_id=r.id and j.report_id is null
    and c.state='consumed' and c.final_capability_report_id=r.id and c.final_report_id is null
    and c.workflow_kind=case when r.payload->>'report_type'='prospect' then 'prospect' else 'verified' end
    and exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.user_id=r.user_id
      and l.case_id=r.case_id and l.kind=c.workflow_kind||'_debit' and l.delta=-1)
    and not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.kind='technical_failure_credit');
$$;

create function public.guard_v22_capability_job_completion() returns trigger
language plpgsql set search_path=public as $$
declare r public.capability_report_versions; c public.workflow_charges;
begin
  if old.capability_report_id is not null then
    if new.capability_report_id is distinct from old.capability_report_id or new.report_id is not null
      or new.status<>'succeeded' or new.run_generation is distinct from old.run_generation
      or new.case_id is distinct from old.case_id or new.id is distinct from old.id
      or new.job_type is distinct from old.job_type or new.current_stage<>'completed'
      or new.progress<>100 or new.error_code is not null or new.completed_at is null then
      raise exception 'CAPABILITY_COMPLETION_IMMUTABLE';
    end if;
    return new;
  end if;
  if new.capability_report_id is null then
    if new.status='succeeded' and exists (select 1 from public.analysis_input_manifests where job_id=new.id) then
      raise exception 'CAPABILITY_COMPLETION_REQUIRED';
    end if;
    return new;
  end if;
  if old.status not in ('queued','running') or new.status<>'succeeded' or new.report_id is not null
    or new.capability_report_id is distinct from new.id or new.run_generation is distinct from old.run_generation
    or new.case_id is distinct from old.case_id or new.id is distinct from old.id or new.job_type is distinct from old.job_type
    or new.current_stage<>'completed' or new.progress<>100 or new.error_code is not null or new.completed_at is null then
    raise exception 'CAPABILITY_COMPLETION_INVALID';
  end if;
  select * into r from public.capability_report_versions where id=new.id and case_id=new.case_id;
  select * into c from public.workflow_charges where analysis_job_id=new.id for update;
  if r.id is null or c.id is null or c.user_id is distinct from r.user_id or c.case_id is distinct from r.case_id
    or c.state<>'reserved' or c.workflow_kind is distinct from (case when r.payload->>'report_type'='prospect' then 'prospect' else 'verified' end)
    or new.job_type is distinct from (case when c.workflow_kind='prospect' then 'prospect_report' else 'verified_report' end)
    or not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id
      and l.user_id=c.user_id and l.case_id=c.case_id and l.delta=-1 and l.kind=c.workflow_kind||'_debit')
    or exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.kind='technical_failure_credit') then
    raise exception 'CAPABILITY_CHARGE_INVALID';
  end if;
  return new;
end;
$$;
create trigger guard_v22_capability_job_completion before update on public.analysis_jobs
for each row execute function public.guard_v22_capability_job_completion();

create function public.guard_v22_capability_charge_settlement() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.final_capability_report_id is not null and (
    new.state is distinct from old.state or new.final_capability_report_id is distinct from old.final_capability_report_id
    or new.final_report_id is not null or new.analysis_job_id is distinct from old.analysis_job_id
    or new.case_id is distinct from old.case_id or new.user_id is distinct from old.user_id
    or new.workflow_kind is distinct from old.workflow_kind or new.settled_at is distinct from old.settled_at) then
    raise exception 'CAPABILITY_SETTLEMENT_IMMUTABLE';
  end if;
  if new.state='compensated' and exists (select 1 from public.analysis_jobs where id=new.analysis_job_id and capability_report_id is not null) then
    raise exception 'CAPABILITY_COMPLETED_JOB_CANNOT_BE_COMPENSATED';
  end if;
  if new.final_capability_report_id is not null and not exists (
    select 1 from public.analysis_jobs j join public.capability_report_versions r on r.id=j.capability_report_id
    where j.id=new.analysis_job_id and j.status='succeeded' and j.report_id is null
      and r.id=new.final_capability_report_id and r.case_id=new.case_id and r.user_id=new.user_id
      and new.state='consumed' and new.final_report_id is null) then
    raise exception 'CAPABILITY_CHARGE_REPORT_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger guard_v22_capability_charge_settlement before update on public.workflow_charges
for each row execute function public.guard_v22_capability_charge_settlement();

-- Keep the old terminal behavior; only extend the durable report variant.
create or replace function public.settle_v22_workflow_charge_on_job_terminal() returns trigger
language plpgsql set search_path=public as $$
declare charge public.workflow_charges; resulting_balance integer;
begin
  if new.status not in ('succeeded','failed') or old.status in ('succeeded','failed') then return new; end if;
  select * into charge from public.workflow_charges where analysis_job_id=new.id for update;
  if charge.id is null or charge.state<>'reserved' then return new; end if;
  if new.status='succeeded' then
    if num_nonnulls(new.report_id,new.capability_report_id)<>1 then raise exception 'WORKFLOW_COMPLETED_WITHOUT_REPORT'; end if;
    update public.workflow_charges set state='consumed',final_report_id=new.report_id,
      final_capability_report_id=new.capability_report_id,settled_at=now() where id=charge.id and state='reserved';
    return new;
  end if;
  update public.workflow_charges set state='compensated',settled_at=now() where id=charge.id and state='reserved';
  if not found then return new; end if;
  update public.users set credit_balance=credit_balance+1,updated_at=now() where id=charge.user_id returning credit_balance into resulting_balance;
  insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
    values(charge.user_id,charge.case_id,charge.id,new.id,'technical_failure_credit',1,resulting_balance,
      'workflow:'||charge.id::text||':technical-failure') on conflict(idempotency_key) do nothing;
  return new;
end;
$$;

create function public.complete_v22_capability_analysis(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_payload jsonb,p_canonical_content text,p_run_generation integer)
returns table(report_id uuid,idempotent boolean,payload_checksum text)
language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; charge public.workflow_charges; saved public.capability_report_versions;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_JOB_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id and case_id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CHARGE_NOT_FOUND'; end if;
  if p_run_generation is null or p_run_generation<1 or job.run_generation is distinct from p_run_generation then
    raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE';
  end if;
  if job.report_id is not null or exists(select 1 from public.reports where id=p_job_id)
    or exists(select 1 from public.analysis_attempt_charges where job_id=p_job_id) then
    raise exception 'CAPABILITY_LEGACY_WORKFLOW_CONFLICT';
  end if;
  if job.status='succeeded' then
    select * into saved from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_job_id);
    if saved.id is null or job.capability_report_id is distinct from p_job_id then raise exception 'CAPABILITY_SETTLEMENT_INVALID'; end if;
    if saved.payload is distinct from p_payload or p_payload is distinct from p_canonical_content::jsonb
      or saved.payload_checksum is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
      raise exception 'CAPABILITY_REPORT_CONFLICT' using errcode='40001';
    end if;
    return query select saved.id,true,saved.payload_checksum;
    return;
  end if;
  if job.status not in ('queued','running') or charge.state<>'reserved' then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id and l.case_id=p_case_id
    and l.delta=-1 and l.kind=charge.workflow_kind||'_debit')
    or exists(select 1 from public.credit_ledger where workflow_charge_id=charge.id and kind='technical_failure_credit') then
    raise exception 'CAPABILITY_CHARGE_INVALID';
  end if;
  select * into saved from public.store_v22_capability_report(p_user_id,p_case_id,p_job_id,p_payload,p_canonical_content,p_run_generation);
  update public.analysis_jobs set capability_report_id=saved.id,status='succeeded',current_stage='completed',progress=100,
    completed_at=now(),error_code=null,user_message='Analysis complete.',state_revision=state_revision+1,
    terminal_effects_revision=state_revision+1 where id=p_job_id;
  if not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_job_id)) then
    raise exception 'CAPABILITY_SETTLEMENT_INVALID';
  end if;
  return query select saved.id,false,saved.payload_checksum;
end;
$$;

create function public.require_completed_v22_capability_history() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.previous_capability_report_id is not null and not exists (
    select 1 from public.get_v22_completed_capability_report(new.user_id,new.case_id,new.previous_capability_report_id)) then
    raise exception 'CAPABILITY_HISTORY_NOT_COMPLETED';
  end if;
  return new;
end;
$$;
create trigger require_completed_v22_capability_history before insert on public.analysis_input_manifests
for each row execute function public.require_completed_v22_capability_history();

revoke all on function public.get_v22_completed_capability_report(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_completed_capability_report(uuid,uuid,uuid) to service_role;
revoke all on function public.complete_v22_capability_analysis(uuid,uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.complete_v22_capability_analysis(uuid,uuid,uuid,jsonb,text,integer) to service_role;
revoke all on function public.guard_v22_capability_job_completion() from public,anon,authenticated;
revoke all on function public.guard_v22_capability_charge_settlement() from public,anon,authenticated;
revoke all on function public.require_completed_v22_capability_history() from public,anon,authenticated;
comment on function public.complete_v22_capability_analysis(uuid,uuid,uuid,jsonb,text,integer) is
  'Atomically delivers a 2.2.2 diagnosis and consumes the existing one-credit workflow; zero actions is not a refund.';
commit;
