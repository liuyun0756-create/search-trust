begin;

-- The immutable report transaction ends before the worker's final cost snapshot.
-- Only future service-only summary writes synchronize that snapshot; no backfill.
create function public.sync_v22_capability_terminal_costs()
returns trigger language plpgsql security definer set search_path = public as $$
declare j public.analysis_jobs;
begin
  select * into j from public.analysis_jobs where id = new.job_id for update;
  if not found or not exists (
    select 1 from public.analysis_input_manifests where job_id = new.job_id
  ) then return new; end if;

  if j.case_id is distinct from new.case_id
    or j.job_type is distinct from new.job_kind
    or j.status not in ('succeeded','failed')
    or j.status is distinct from new.status
    or j.created_at is distinct from new.started_at then
    raise exception 'COST_SUMMARY_TASK_CONFLICT' using errcode = '40001';
  end if;

  -- Do not reapply completion, bump its revision or touch its report/charge.
  update public.analysis_jobs set cost_counters = new.cost_counters
    where id = j.id and coalesce((cost_counters->>'cost_ledger_revision')::bigint,0) < new.ledger_revision;
  return new;
end; $$;

revoke all on function public.sync_v22_capability_terminal_costs()
  from public, anon, authenticated, service_role;
create trigger sync_v22_capability_terminal_costs
  after insert or update on public.job_cost_summaries
  for each row execute function public.sync_v22_capability_terminal_costs();

commit;
