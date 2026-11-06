-- P1-HOTFIX-REFUND: scheme A, deadline settlement before analysis is bound.
begin;

create function public.expire_v22_prospect_discovery_charges(p_limit integer default 100)
returns table(workflow_id uuid)
language plpgsql security definer set search_path=public as $$
declare candidate record; c public.workflow_charges; balance integer;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'PROSPECT_DISCOVERY_EXPIRY_INVALID';
  end if;
  -- Prospect discovery lives here, not in capability_first_service_discoveries.
  -- Each SQL-registered discovery gets 20 minutes. A later discovery under the
  -- same charge must also expire; never refund an active follow-up discovery.
  for candidate in
    select w.id,w.case_id from public.workflow_charges w
    join public.prospect_discovery_tasks t on t.workflow_charge_id=w.id
    where w.workflow_kind='prospect' and w.state='reserved' and w.analysis_job_id is null
    group by w.id,w.case_id
    having max(t.created_at)+interval '20 minutes' <= now()
    order by max(t.created_at),w.id limit p_limit
  loop
    -- Same Case -> charge order as intake. Binding and discovery registration
    -- also lock the charge, so recheck everything after taking that lock.
    perform 1 from public.client_cases where id=candidate.case_id for no key update skip locked;
    if not found then continue; end if;
    select * into c from public.workflow_charges where id=candidate.id for update;
    if c.state<>'reserved' or c.analysis_job_id is not null
      or c.final_report_id is not null or c.final_capability_report_id is not null
      or not exists(select 1 from public.prospect_discovery_tasks t where t.workflow_charge_id=c.id)
      or exists(select 1 from public.prospect_discovery_tasks t where t.workflow_charge_id=c.id
        and t.created_at+interval '20 minutes'>now())
      or exists(select 1 from public.credit_ledger l where l.workflow_charge_id=c.id
        and l.kind='technical_failure_credit')
      -- Defensive guard for an inconsistent/missing binding: never refund a
      -- charge if this Case has started an analysis since that charge began.
      or exists(select 1 from public.analysis_jobs j where j.case_id=c.case_id and j.created_at>=c.created_at)
    then continue; end if;

    update public.workflow_charges set state='compensated',settled_at=now() where id=c.id;
    update public.users set credit_balance=credit_balance+1,updated_at=now()
      where id=c.user_id returning credit_balance into balance;
    insert into public.credit_ledger(user_id,case_id,workflow_charge_id,kind,delta,balance_after,idempotency_key)
      values(c.user_id,c.case_id,c.id,'technical_failure_credit',1,balance,
        'workflow:'||c.id::text||':technical-failure');
    -- No ON CONFLICT swallowing: a conflicting ledger write rolls back the
    -- entire transaction, including the balance and charge state changes.
    return query select c.id;
  end loop;
end;
$$;
revoke all on function public.expire_v22_prospect_discovery_charges(integer) from public,anon,authenticated;
grant execute on function public.expire_v22_prospect_discovery_charges(integer) to service_role;

-- Existing once-per-minute capability orphan reconciler calls this RPC.
-- Keep its return shape (analysis job IDs only) and all previous behavior.
do $$
declare definition text; target text := '  for job in select j.* from public.analysis_jobs j';
begin
  select pg_get_functiondef('public.expire_v22_prepared_capability_jobs(integer)'::regprocedure) into definition;
  if position(target in definition)=0 then raise exception 'PROSPECT_EXPIRY_PATCH_TARGET_MISSING'; end if;
  execute replace(definition,target,
    E'  perform public.expire_v22_prospect_discovery_charges(p_limit);\n'||target);
end;
$$;

commit;
