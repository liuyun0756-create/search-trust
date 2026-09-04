-- Atomically starts paid prospect jobs and persists their immutable source graph.

begin;

create or replace function public.start_v22_prospect_analysis(
  p_user_id uuid,
  p_case_id uuid,
  p_job_id uuid,
  p_idempotency_key text
)
returns table (job_id uuid, created boolean, idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  existing_job public.analysis_jobs%rowtype;
  reservation record;
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
    if existing_job.status = 'succeeded' and existing_job.report_id is not null then
      return query select p_job_id, false, true;
      return;
    end if;
    select * into reservation
    from public.reserve_v22_case_report_entitlement(p_user_id, p_case_id, p_job_id);
    if not coalesce(reservation.reserved, false) then
      raise exception 'prospect report entitlement is not available';
    end if;
    return query select p_job_id, false, true;
    return;
  end if;

  insert into public.analysis_jobs (
    id, case_id, job_type, status, current_stage, progress,
    attempt_count, idempotency_key, cost_counters
  ) values (
    p_job_id, p_case_id, 'prospect_report', 'queued', 'queued', 0,
    0, p_idempotency_key, '{}'::jsonb
  );

  select * into reservation
  from public.reserve_v22_case_report_entitlement(p_user_id, p_case_id, p_job_id);
  if not coalesce(reservation.reserved, false) then
    raise exception 'prospect report entitlement is not available';
  end if;
  return query select p_job_id, true, false;
end;
$$;

create or replace function public.persist_v22_prospect_result(
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
  p_report_payload jsonb
)
returns table (report_id uuid, idempotent boolean)
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid;
  existing_report public.reports%rowtype;
  report_generated_at timestamptz;
  candidate_snapshot_ids uuid[] := array[
    p_site_snapshot_id, p_serp_snapshot_id, p_competitor_snapshot_id
  ];
  inserted_count integer := 0;
begin
  if jsonb_typeof(p_site_payload) <> 'object'
     or jsonb_typeof(p_serp_payload) <> 'object'
     or jsonb_typeof(p_competitor_payload) <> 'object'
     or jsonb_typeof(p_report_payload) <> 'object' then
    raise exception 'v2.2 result payloads must be objects';
  end if;
  if p_site_checksum !~ '^sha256:[0-9a-f]{64}$'
     or p_serp_checksum !~ '^sha256:[0-9a-f]{64}$'
     or p_competitor_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'invalid v2.2 result checksum';
  end if;
  if cardinality(candidate_snapshot_ids) <> (
    select count(distinct value)::integer from unnest(candidate_snapshot_ids) values_table(value)
  ) then
    raise exception 'v2.2 result snapshot identities must be unique';
  end if;

  select c.user_id into owner_id
  from public.client_cases c
  join public.analysis_jobs j on j.case_id = c.id
  where c.id = p_case_id
    and j.id = p_job_id
    and j.job_type = 'prospect_report'
    and j.status in ('queued', 'running')
  for update of j;
  if owner_id is null then
    raise exception 'prospect analysis job is not persistable';
  end if;

  if p_site_payload->>'schema_version' <> 'site_inventory_snapshot_v1'
     or p_serp_payload->>'schema_version' <> 'serp_market_snapshot_v1'
     or p_competitor_payload->>'schema_version' <> 'competitor_collection_snapshot_v1' then
    raise exception 'v2.2 source snapshot schema mismatch';
  end if;
  if (p_competitor_payload->>'job_id')::uuid <> p_job_id
     or (p_competitor_payload->>'market_snapshot_id')::uuid <> p_serp_snapshot_id
     or p_competitor_payload->>'market_snapshot_checksum' <> p_serp_checksum then
    raise exception 'v2.2 source snapshot lineage mismatch';
  end if;
  if (p_report_payload->'identity'->>'case_id')::uuid <> p_case_id
     or (p_report_payload->'report_version'->>'report_id')::uuid <> p_job_id
     or p_report_payload->'report_version'->>'report_type' <> 'prospect'
     or p_report_payload->'report_version'->>'schema_version' <> '2.2.0'
     or (p_report_payload->'report_version'->>'version_number')::integer <> 1
     or p_report_payload->'report_version'->'parent_report_id' <> 'null'::jsonb then
    raise exception 'v2.2 prospect report identity mismatch';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_report_payload->'evidence_index') evidence
    where not ((evidence->>'snapshot_id')::uuid = any(candidate_snapshot_ids))
  ) then
    raise exception 'v2.2 report references an unknown snapshot';
  end if;

  insert into public.data_snapshots (
    id, case_id, source_type, schema_version, fetched_at, expires_at,
    sync_trigger, health_status, health_reasons, normalized_payload,
    payload_checksum, provider_request_context
  ) values
    (
      p_site_snapshot_id, p_case_id, 'site', p_site_payload->>'schema_version',
      (p_site_payload->>'completed_at')::timestamptz, null,
      'report_generation', 'healthy', coalesce(p_site_payload->'limitations', '[]'::jsonb),
      p_site_payload, p_site_checksum, jsonb_build_object('job_id', p_job_id)
    ),
    (
      p_serp_snapshot_id, p_case_id, 'serp', p_serp_payload->>'schema_version',
      (p_serp_payload->>'completed_at')::timestamptz, p_serp_expires_at,
      'report_generation', 'healthy', coalesce(p_serp_payload->'limitations', '[]'::jsonb),
      p_serp_payload, p_serp_checksum, jsonb_build_object('job_id', p_job_id)
    ),
    (
      p_competitor_snapshot_id, p_case_id, 'competitor', p_competitor_payload->>'schema_version',
      (p_competitor_payload->>'completed_at')::timestamptz, null,
      'report_generation', 'healthy', coalesce(p_competitor_payload->'limitations', '[]'::jsonb),
      p_competitor_payload, p_competitor_checksum, jsonb_build_object('job_id', p_job_id)
    )
  on conflict (id) do nothing;
  get diagnostics inserted_count = row_count;

  if exists (
    select 1
    from (values
      (p_site_snapshot_id, 'site', p_site_checksum, p_site_payload),
      (p_serp_snapshot_id, 'serp', p_serp_checksum, p_serp_payload),
      (p_competitor_snapshot_id, 'competitor', p_competitor_checksum, p_competitor_payload)
    ) expected(id, source_type, checksum, payload)
    left join public.data_snapshots snapshot on snapshot.id = expected.id
    where snapshot.id is null
       or snapshot.case_id <> p_case_id
       or snapshot.source_type <> expected.source_type
       or snapshot.payload_checksum <> expected.checksum
       or snapshot.normalized_payload <> expected.payload
  ) then
    raise exception 'immutable v2.2 source snapshot conflict';
  end if;

  report_generated_at := (p_report_payload->'report_version'->>'generated_at')::timestamptz;
  insert into public.reports (
    id, report_id, user_id, page_url, gbp_url, task_id, status, access_type,
    completed_at, generated_at, case_id, report_type, schema_version,
    version_number, parent_report_id, report_v2_2, snapshot_ids,
    coverage_state, version_diff, generation_config, ruleset_version, copy_model_version
  ) values (
    p_job_id, p_job_id::text, owner_id,
    p_report_payload->'identity'->'business'->>'site_url',
    coalesce(p_report_payload->'identity'->'business'->>'public_gbp_url', ''),
    p_job_id::text, 'paid_full', 'unlocked', report_generated_at, report_generated_at,
    p_case_id, 'prospect', '2.2.0', 1, null, p_report_payload, candidate_snapshot_ids,
    p_report_payload->'data_coverage', p_report_payload->'version_diff',
    jsonb_build_object(
      'pipeline', 'public_prospect_v1',
      'evidence_policy', 'traceable_snapshots_only'
    ),
    p_report_payload->'report_version'->>'ruleset_version',
    p_report_payload->'report_version'->>'copy_model_version'
  ) on conflict (id) do nothing;

  select * into existing_report from public.reports where id = p_job_id;
  if existing_report.id is null
     or existing_report.user_id <> owner_id
     or existing_report.case_id <> p_case_id
     or existing_report.report_v2_2 <> p_report_payload
     or existing_report.snapshot_ids <> candidate_snapshot_ids then
    raise exception 'immutable v2.2 report conflict';
  end if;

  update public.analysis_jobs as job
  set report_id = p_job_id
  where job.id = p_job_id and job.case_id = p_case_id and job.report_id is null;
  if not exists (
    select 1 from public.analysis_jobs as job
    where job.id = p_job_id and job.case_id = p_case_id and job.report_id = p_job_id
  ) then
    raise exception 'v2.2 report could not be linked to its job';
  end if;

  update public.client_cases
  set latest_report_id = p_job_id
  where id = p_case_id and user_id = owner_id;

  return query select p_job_id, inserted_count = 0;
end;
$$;

revoke all on function public.start_v22_prospect_analysis(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.start_v22_prospect_analysis(uuid, uuid, uuid, text)
  to service_role;
revoke all on function public.persist_v22_prospect_result(
  uuid, uuid, uuid, jsonb, text, uuid, jsonb, text, timestamptz,
  uuid, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_v22_prospect_result(
  uuid, uuid, uuid, jsonb, text, uuid, jsonb, text, timestamptz,
  uuid, jsonb, text, jsonb
) to service_role;

comment on function public.start_v22_prospect_analysis is
  'Atomically creates an owned prospect job and reserves its Case-scoped entitlement.';
comment on function public.persist_v22_prospect_result is
  'Idempotently persists exact v2.2 source snapshots, report payload, and job/report linkage before success.';

commit;
