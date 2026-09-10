-- V22-082: service-only provider cost summaries and Google sync cost snapshots.
begin;

create or replace function public.is_v22_cost_counters(value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(value) = 'object'
    and coalesce((select count(*) <= 100 from jsonb_each(value)), false)
    and coalesce((
      select bool_and(
        key ~ '^[a-z][a-z0-9_]{0,79}$'
        and jsonb_typeof(entry) = 'number'
        and (entry #>> '{}')::numeric between 0 and 1000000000000000
        and (entry #>> '{}')::numeric = trunc((entry #>> '{}')::numeric)
      )
      from jsonb_each(value) as counters(key, entry)
    ), true);
$$;

alter table public.google_sync_jobs
  add column cost_counters jsonb not null default '{}'::jsonb,
  add constraint google_sync_jobs_cost_counters_check
    check (public.is_v22_cost_counters(cost_counters));

create table public.job_cost_summaries (
  job_id uuid primary key,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  job_kind text not null check (
    job_kind in (
      'competitor_discovery',
      'prospect_report',
      'verified_report',
      'gsc_sync',
      'ga4_sync',
      'gbp_sync'
    )
  ),
  status text not null check (status in ('succeeded', 'failed')),
  attempt_count integer not null check (attempt_count between 0 and 100),
  ledger_revision bigint not null check (ledger_revision >= 1),
  cost_counters jsonb not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_cost_summaries_time_check check (completed_at >= started_at),
  constraint job_cost_summaries_counter_shape_check check (
    public.is_v22_cost_counters(cost_counters)
    and cost_counters <> '{}'::jsonb
    and cost_counters->>'cost_schema_version' = '1'
    and (cost_counters->>'cost_ledger_revision')::bigint = ledger_revision
  )
);

create index idx_job_cost_summaries_case_completed
  on public.job_cost_summaries (case_id, completed_at desc);
create index idx_job_cost_summaries_kind_completed
  on public.job_cost_summaries (job_kind, completed_at desc);

create trigger set_job_cost_summaries_updated_at
before update on public.job_cost_summaries
for each row execute function public.set_v22_updated_at();

alter table public.job_cost_summaries enable row level security;
revoke all on table public.job_cost_summaries from public, anon, authenticated;
grant select, insert, update, delete on table public.job_cost_summaries to service_role;

create or replace function public.upsert_v22_job_cost_summary(
  p_job_id uuid,
  p_case_id uuid,
  p_job_kind text,
  p_status text,
  p_attempt_count integer,
  p_ledger_revision bigint,
  p_cost_counters jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns public.job_cost_summaries
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.job_cost_summaries%rowtype;
  result public.job_cost_summaries%rowtype;
begin
  if p_job_id is null or p_case_id is null
     or p_job_kind not in (
       'competitor_discovery', 'prospect_report', 'verified_report',
       'gsc_sync', 'ga4_sync', 'gbp_sync'
     )
     or p_status not in ('succeeded', 'failed')
     or p_attempt_count not between 0 and 100
     or p_ledger_revision < 1
     or p_started_at is null or p_completed_at is null
     or p_completed_at < p_started_at
     or not public.is_v22_cost_counters(p_cost_counters)
     or p_cost_counters = '{}'::jsonb
     or p_cost_counters->>'cost_schema_version' is distinct from '1'
     or (p_cost_counters->>'cost_ledger_revision')::bigint is distinct from p_ledger_revision then
    raise exception 'INVALID_COST_SUMMARY' using errcode = '22023';
  end if;
  perform 1 from public.client_cases where id = p_case_id;
  if not found then
    raise exception 'COST_SUMMARY_CASE_NOT_FOUND' using errcode = '23503';
  end if;

  select * into existing
  from public.job_cost_summaries
  where job_id = p_job_id
  for update;

  if found and (
    existing.case_id is distinct from p_case_id
    or existing.job_kind is distinct from p_job_kind
    or existing.status is distinct from p_status
    or existing.started_at is distinct from p_started_at
  ) then
    raise exception 'COST_SUMMARY_IDENTITY_CONFLICT' using errcode = '40001';
  end if;

  if existing.job_id is not null and existing.ledger_revision >= p_ledger_revision then
    return existing;
  end if;

  insert into public.job_cost_summaries (
    job_id, case_id, job_kind, status, attempt_count, ledger_revision,
    cost_counters, started_at, completed_at
  ) values (
    p_job_id, p_case_id, p_job_kind, p_status, p_attempt_count,
    p_ledger_revision, p_cost_counters, p_started_at, p_completed_at
  )
  on conflict (job_id) do update
  set attempt_count = excluded.attempt_count,
      ledger_revision = excluded.ledger_revision,
      cost_counters = excluded.cost_counters,
      completed_at = excluded.completed_at
  where public.job_cost_summaries.ledger_revision < excluded.ledger_revision
  returning * into result;

  if result.job_id is null then
    select * into result from public.job_cost_summaries where job_id = p_job_id;
  end if;
  return result;
end;
$$;

create function public.persist_v22_google_sync_cost(
  p_job_id uuid,
  p_job_kind text,
  p_cost_counters jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.google_sync_jobs%rowtype;
  expected_source text;
  ledger_revision bigint;
begin
  expected_source := case p_job_kind
    when 'gsc_sync' then 'gsc'
    when 'ga4_sync' then 'ga4'
    when 'gbp_sync' then 'gbp'
    else null
  end;
  if expected_source is null
     or not public.is_v22_cost_counters(p_cost_counters)
     or p_cost_counters = '{}'::jsonb
     or p_cost_counters->>'cost_schema_version' is distinct from '1'
     or p_cost_counters->>'cost_ledger_revision' is null then
    raise exception 'INVALID_SYNC_COST' using errcode = '22023';
  end if;
  ledger_revision := (p_cost_counters->>'cost_ledger_revision')::bigint;
  select * into j from public.google_sync_jobs where id = p_job_id for update;
  if not found or j.source_type is distinct from expected_source then
    raise exception 'SYNC_COST_IDENTITY_CONFLICT' using errcode = '40001';
  end if;
  if j.cost_counters <> '{}'::jsonb
     and (j.cost_counters->>'cost_ledger_revision')::bigint > ledger_revision then
    return;
  end if;
  update public.google_sync_jobs
  set cost_counters = p_cost_counters
  where id = j.id;
  if j.status in ('succeeded', 'failed') and j.completed_at is not null then
    perform public.upsert_v22_job_cost_summary(
      j.id,
      j.case_id,
      p_job_kind,
      j.status,
      j.attempt_count,
      ledger_revision,
      p_cost_counters,
      j.created_at,
      j.completed_at
    );
  end if;
end;
$$;

create function public.finish_v22_gsc_sync(
  p_job_id uuid,p_lease_id uuid,p_payload jsonb,p_checksum text,p_health text,
  p_reasons jsonb,p_cost_counters jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  result := public.finish_v22_gsc_sync(
    p_job_id,p_lease_id,p_payload,p_checksum,p_health,p_reasons
  );
  perform public.persist_v22_google_sync_cost(p_job_id,'gsc_sync',p_cost_counters);
  return result;
end; $$;

create function public.fail_v22_gsc_sync(
  p_job_id uuid,p_lease_id uuid,p_code text,p_retryable boolean,p_cost_counters jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.fail_v22_gsc_sync(p_job_id,p_lease_id,p_code,p_retryable);
  perform public.persist_v22_google_sync_cost(p_job_id,'gsc_sync',p_cost_counters);
end; $$;

create function public.finish_v22_ga4_sync(
  p_job_id uuid,p_lease_id uuid,p_payload jsonb,p_checksum text,p_health text,
  p_reasons jsonb,p_cost_counters jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  result := public.finish_v22_ga4_sync(
    p_job_id,p_lease_id,p_payload,p_checksum,p_health,p_reasons
  );
  perform public.persist_v22_google_sync_cost(p_job_id,'ga4_sync',p_cost_counters);
  return result;
end; $$;

create function public.fail_v22_ga4_sync(
  p_job_id uuid,p_lease_id uuid,p_code text,p_retryable boolean,p_cost_counters jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.fail_v22_ga4_sync(p_job_id,p_lease_id,p_code,p_retryable);
  perform public.persist_v22_google_sync_cost(p_job_id,'ga4_sync',p_cost_counters);
end; $$;

create function public.finish_v22_gbp_sync(
  p_job_id uuid,p_lease_id uuid,p_manifest jsonb,p_raw_payload jsonb,p_checksum text,
  p_health text,p_reasons jsonb,p_cost_counters jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  result := public.finish_v22_gbp_sync(
    p_job_id,p_lease_id,p_manifest,p_raw_payload,p_checksum,p_health,p_reasons
  );
  perform public.persist_v22_google_sync_cost(p_job_id,'gbp_sync',p_cost_counters);
  return result;
end; $$;

create function public.fail_v22_gbp_sync(
  p_job_id uuid,p_lease_id uuid,p_code text,p_retryable boolean,p_cost_counters jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.fail_v22_gbp_sync(p_job_id,p_lease_id,p_code,p_retryable);
  perform public.persist_v22_google_sync_cost(p_job_id,'gbp_sync',p_cost_counters);
end; $$;

revoke all on function public.is_v22_cost_counters(jsonb)
  from public, anon, authenticated;
grant execute on function public.is_v22_cost_counters(jsonb) to service_role;
revoke all on function public.upsert_v22_job_cost_summary(
  uuid, uuid, text, text, integer, bigint, jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.upsert_v22_job_cost_summary(
  uuid, uuid, text, text, integer, bigint, jsonb, timestamptz, timestamptz
) to service_role;
revoke all on function public.persist_v22_google_sync_cost(uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_v22_gsc_sync(uuid,uuid,jsonb,text,text,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_v22_gsc_sync(uuid,uuid,text,boolean,jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_v22_ga4_sync(uuid,uuid,jsonb,text,text,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_v22_ga4_sync(uuid,uuid,text,boolean,jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_v22_gbp_sync(uuid,uuid,jsonb,jsonb,text,text,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_v22_gbp_sync(uuid,uuid,text,boolean,jsonb)
  from public, anon, authenticated;
grant execute on function public.finish_v22_gsc_sync(uuid,uuid,jsonb,text,text,jsonb,jsonb)
  to service_role;
grant execute on function public.fail_v22_gsc_sync(uuid,uuid,text,boolean,jsonb)
  to service_role;
grant execute on function public.finish_v22_ga4_sync(uuid,uuid,jsonb,text,text,jsonb,jsonb)
  to service_role;
grant execute on function public.fail_v22_ga4_sync(uuid,uuid,text,boolean,jsonb)
  to service_role;
grant execute on function public.finish_v22_gbp_sync(uuid,uuid,jsonb,jsonb,text,text,jsonb,jsonb)
  to service_role;
grant execute on function public.fail_v22_gbp_sync(uuid,uuid,text,boolean,jsonb)
  to service_role;

commit;

-- Rollback: disable V22 provider cost recording and stop its summary reconciler.
-- Keep the additive summaries and Google sync counters for audit history.
