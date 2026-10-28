begin;
create table public.capability_first_service_discovery_runs (
  workflow_id uuid primary key references public.capability_first_service_discoveries(workflow_id),
  dispatch_token uuid not null unique,
  checked_at timestamptz not null default now(),
  attempts integer not null default 0 check(attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  check((lease_token is null)=(lease_until is null))
);
alter table public.capability_first_service_discovery_runs enable row level security;
revoke all on public.capability_first_service_discovery_runs from public,anon,authenticated,service_role;
grant select on public.capability_first_service_discovery_runs to service_role;

create function public.list_v22_first_service_discovery_work(p_limit integer default 25)
returns table(workflow_id uuid) language plpgsql security definer set search_path=public as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'FIRST_SERVICE_DISCOVERY_LIMIT_INVALID'; end if;
  return query select d.workflow_id from public.capability_first_service_discoveries d
    join public.workflow_charges c on c.id=d.workflow_id
    join public.client_cases cc on cc.id=c.case_id and cc.user_id=c.user_id and cc.status='active'
    left join public.capability_first_service_discovery_runs r on r.workflow_id=d.workflow_id
    where c.state='reserved' and c.analysis_job_id is null and d.result is null and d.deadline_at>now()
    order by coalesce(r.checked_at,d.created_at),d.workflow_id limit p_limit;
end;
$$;

-- Claiming dispatch is deliberately one-shot. If registration outcome becomes
-- unknowable, do not recreate Redis state or its provider cost ledger.
create function public.claim_v22_first_service_discovery_dispatch(p_workflow_id uuid,p_dispatch_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries;
  r public.capability_first_service_discovery_runs; fresh boolean=false;
begin
  if p_dispatch_token is null then raise exception 'FIRST_SERVICE_DISCOVERY_DISPATCH_INVALID'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id;
  perform 1 from public.client_cases where id=c.case_id and user_id=c.user_id and status='active' for no key update;
  if not found then return jsonb_build_object('outcome','closed'); end if;
  select * into c from public.workflow_charges where id=p_workflow_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  if d.workflow_id is null or c.workflow_kind<>'verified' or c.state<>'reserved'
    or c.analysis_job_id is not null or d.result is not null or d.deadline_at<=now() then
    return jsonb_build_object('outcome','closed'); end if;
  insert into public.capability_first_service_discovery_runs(workflow_id,dispatch_token) values(c.id,p_dispatch_token)
    on conflict(workflow_id) do nothing;
  fresh=found;
  update public.capability_first_service_discovery_runs set checked_at=now() where workflow_id=c.id returning * into r;
  return jsonb_build_object('outcome',case when fresh then 'dispatch' else 'observe' end,
    'workflow_id',c.id,'user_id',c.user_id,'case_id',c.case_id,'discovery_job_id',d.discovery_job_id,
    'request',d.request,'deadline_at',d.deadline_at,'attempts',r.attempts,
    'lease_until',r.lease_until,'dispatch_token',r.dispatch_token);
end;
$$;

create function public.claim_v22_first_service_discovery_run(p_workflow_id uuid,p_discovery_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.workflow_charges; d public.capability_first_service_discoveries; r public.capability_first_service_discovery_runs;
  ids uuid[]; locked uuid[]; current_ids uuid[]; ref jsonb; cc public.client_cases;
begin
  if p_lease_token is null then raise exception 'FIRST_SERVICE_DISCOVERY_LEASE_INVALID'; end if;
  select * into c from public.workflow_charges where id=p_workflow_id;
  -- Match the connection -> Case lock order of preparation and resource changes.
  select coalesce(array_agg(distinct connection_id order by connection_id),'{}') into ids
    from public.case_source_bindings where case_id=c.case_id and is_active and source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(ids) and user_id=c.user_id order by id for share;
  select coalesce(array_agg(id order by id),'{}') into locked from public.google_connections where id=any(ids) and user_id=c.user_id;
  select * into cc from public.client_cases where id=c.case_id and user_id=c.user_id and status='active' for no key update;
  if cc.id is null then return jsonb_build_object('outcome','closed'); end if;
  select * into c from public.workflow_charges where id=p_workflow_id for update;
  select * into d from public.capability_first_service_discoveries where workflow_id=c.id;
  select * into r from public.capability_first_service_discovery_runs where workflow_id=c.id for update;
  if d.workflow_id is null or r.workflow_id is null or d.discovery_job_id is distinct from p_discovery_job_id
    or c.workflow_kind<>'verified' or c.state<>'reserved' or c.analysis_job_id is not null
    or d.result is not null or d.deadline_at<=now() then return jsonb_build_object('outcome','closed'); end if;
  if r.lease_until>now() then return jsonb_build_object('outcome','busy'); end if;
  if r.attempts>=3 then return jsonb_build_object('outcome','exhausted'); end if;
  select coalesce(array_agg(distinct connection_id order by connection_id),'{}') into current_ids
    from public.case_source_bindings where case_id=c.case_id and is_active and source_type in ('gsc','ga4');
  if ids is distinct from locked or ids is distinct from current_ids
    or cc.business_identity is distinct from d.request->'business_identity'
    or cc.primary_service is distinct from d.request->>'primary_service'
    or cc.target_market is distinct from d.request->'target_market' then
    raise exception 'FIRST_SERVICE_DISCOVERY_CONTEXT_CHANGED'; end if;
  for ref in select value from jsonb_array_elements(d.source_refs) loop
    if public.check_v22_first_service_source(c.user_id,c.case_id,(ref->>'snapshot_id')::uuid,ref->>'source_kind') is distinct from ref then
      raise exception 'FIRST_SERVICE_DISCOVERY_CONTEXT_CHANGED'; end if;
  end loop;
  update public.capability_first_service_discovery_runs set attempts=attempts+1,
    lease_token=p_lease_token,lease_until=least(now()+interval '90 seconds',d.deadline_at)
    where workflow_id=c.id returning * into r;
  return jsonb_build_object('outcome','claimed','workflow_id',c.id,'user_id',c.user_id,'case_id',c.case_id,
    'discovery_job_id',d.discovery_job_id,'request',d.request,'deadline_at',d.deadline_at,'attempts',r.attempts,
    'lease_until',r.lease_until,'dispatch_token',r.dispatch_token);
end;
$$;

create function public.heartbeat_v22_first_service_discovery(p_workflow_id uuid,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.capability_first_service_discovery_runs r set lease_until=least(now()+interval '90 seconds',d.deadline_at)
    from public.capability_first_service_discoveries d,public.workflow_charges c
    where r.workflow_id=p_workflow_id and d.workflow_id=r.workflow_id and c.id=d.workflow_id
      and r.lease_token=p_lease_token and r.lease_until>now() and d.deadline_at>now()
      and d.result is null and c.state='reserved' and c.analysis_job_id is null
      and exists(select 1 from public.client_cases cc where cc.id=c.case_id and cc.status='active');
  return found;
end;
$$;
create function public.release_v22_first_service_discovery(p_workflow_id uuid,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.capability_first_service_discovery_runs set lease_token=null,lease_until=null
    where workflow_id=p_workflow_id and lease_token=p_lease_token;
  return found;
end;
$$;

revoke all on function public.list_v22_first_service_discovery_work(integer) from public,anon,authenticated;
revoke all on function public.claim_v22_first_service_discovery_dispatch(uuid,uuid) from public,anon,authenticated;
revoke all on function public.claim_v22_first_service_discovery_run(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.heartbeat_v22_first_service_discovery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_v22_first_service_discovery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_v22_first_service_discovery_work(integer) to service_role;
grant execute on function public.claim_v22_first_service_discovery_dispatch(uuid,uuid) to service_role;
grant execute on function public.claim_v22_first_service_discovery_run(uuid,uuid,uuid) to service_role;
grant execute on function public.heartbeat_v22_first_service_discovery(uuid,uuid) to service_role;
grant execute on function public.release_v22_first_service_discovery(uuid,uuid) to service_role;
commit;
