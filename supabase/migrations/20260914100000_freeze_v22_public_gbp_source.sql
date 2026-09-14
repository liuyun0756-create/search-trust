-- Persist and freeze the exact public GBP source used by Prospect and Verified reports.
begin;

alter table public.verified_analysis_inputs
  add constraint verified_analysis_inputs_public_gbp_snapshot_fk
  foreign key (public_gbp_snapshot_id) references public.data_snapshots(id) on delete restrict;

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
  p_public_gbp_snapshot_id uuid,
  p_public_gbp_payload jsonb,
  p_public_gbp_checksum text,
  p_public_gbp_expires_at timestamptz,
  p_public_gbp_reference jsonb,
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
    p_site_snapshot_id, p_serp_snapshot_id, p_competitor_snapshot_id, p_public_gbp_snapshot_id
  ];
  inserted_count integer := 0;
begin
  if jsonb_typeof(p_site_payload) <> 'object'
     or jsonb_typeof(p_serp_payload) <> 'object'
     or jsonb_typeof(p_competitor_payload) <> 'object'
     or jsonb_typeof(p_public_gbp_payload) <> 'object'
     or jsonb_typeof(p_public_gbp_reference) <> 'object'
     or jsonb_typeof(p_report_payload) <> 'object' then
    raise exception 'v2.2 result payloads must be objects';
  end if;
  if p_site_checksum !~ '^sha256:[0-9a-f]{64}$'
     or p_serp_checksum !~ '^sha256:[0-9a-f]{64}$'
     or p_competitor_checksum !~ '^sha256:[0-9a-f]{64}$'
     or p_public_gbp_checksum !~ '^sha256:[0-9a-f]{64}$' then
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
     or p_competitor_payload->>'schema_version' <> 'competitor_collection_snapshot_v1'
     or p_public_gbp_payload->>'schema_version' <> 'customer_public_gbp_snapshot_v1' then
    raise exception 'v2.2 source snapshot schema mismatch';
  end if;
  if (p_competitor_payload->>'job_id')::uuid <> p_job_id
     or (p_competitor_payload->>'market_snapshot_id')::uuid <> p_serp_snapshot_id
     or p_competitor_payload->>'market_snapshot_checksum' <> p_serp_checksum then
    raise exception 'v2.2 source snapshot lineage mismatch';
  end if;
  if p_public_gbp_payload->>'health_status' <> 'healthy'
     or p_public_gbp_payload->>'identity_match_status' <> 'matched'
     or p_public_gbp_payload->>'subject_reference_checksum' !~ '^sha256:[0-9a-f]{64}$'
     or (p_public_gbp_payload->>'expires_at')::timestamptz is distinct from p_public_gbp_expires_at
     or p_public_gbp_expires_at <= (p_public_gbp_payload->>'completed_at')::timestamptz
     or (p_public_gbp_reference->>'case_id')::uuid is distinct from p_case_id
     or p_public_gbp_reference->>'confirmation_source' is distinct from 'user'
     or p_public_gbp_payload->'request_target' is distinct from jsonb_build_object(
        'public_gbp_url',p_public_gbp_reference->'public_gbp_url',
        'entity_keys',p_public_gbp_reference->'entity_keys') then
    raise exception 'v2.2 public GBP source mismatch';
  end if;
  if (p_report_payload->'identity'->>'case_id')::uuid <> p_case_id
     or (p_report_payload->'report_version'->>'report_id')::uuid <> p_job_id
     or p_report_payload->'report_version'->>'report_type' <> 'prospect'
     or p_report_payload->'report_version'->>'schema_version' <> '2.2.0'
     or (p_report_payload->'report_version'->>'version_number')::integer <> 1
     or p_report_payload->'report_version'->'parent_report_id' <> 'null'::jsonb then
    raise exception 'v2.2 prospect report identity mismatch';
  end if;
  if p_public_gbp_reference->>'site_url' is distinct from p_report_payload #>> '{identity,business,site_url}'
     or p_public_gbp_reference->>'public_gbp_url' is distinct from p_report_payload #>> '{identity,business,public_gbp_url}'
     or (select count(*) from jsonb_array_elements(p_report_payload #> '{data_coverage,sources}') c
          where c->>'source_type'='gbp' and c->>'health_status'='healthy'
            and c->>'identity_match_status'='matched'
            and c->'snapshot_ids'=jsonb_build_array(p_public_gbp_snapshot_id::text)) <> 1
     or not exists (select 1 from jsonb_array_elements(p_report_payload->'evidence_index') e
          where e->>'source_type'='gbp' and (e->>'snapshot_id')::uuid=p_public_gbp_snapshot_id
            and e->>'health_status'='healthy'
            and e #>> '{source_locator,url}'=p_public_gbp_reference->>'public_gbp_url') then
    raise exception 'v2.2 public GBP report binding mismatch';
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
    ),
    (
      p_public_gbp_snapshot_id, p_case_id, 'gbp', p_public_gbp_payload->>'schema_version',
      (p_public_gbp_payload->>'completed_at')::timestamptz, p_public_gbp_expires_at,
      'report_generation', 'healthy', coalesce(p_public_gbp_payload->'limitations', '[]'::jsonb),
      p_public_gbp_payload, p_public_gbp_checksum, jsonb_build_object(
        'job_id',p_job_id,'customer_public_gbp_reference',p_public_gbp_reference,
        'subject_reference_checksum',p_public_gbp_payload->>'subject_reference_checksum')
    )
  on conflict (id) do nothing;
  get diagnostics inserted_count = row_count;

  if exists (
    select 1
    from (values
      (p_site_snapshot_id, 'site', p_site_checksum, p_site_payload),
      (p_serp_snapshot_id, 'serp', p_serp_checksum, p_serp_payload),
      (p_competitor_snapshot_id, 'competitor', p_competitor_checksum, p_competitor_payload),
      (p_public_gbp_snapshot_id, 'gbp', p_public_gbp_checksum, p_public_gbp_payload)
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
  if not exists (
    select 1 from public.data_snapshots snapshot
    where snapshot.id=p_public_gbp_snapshot_id and snapshot.case_id=p_case_id
      and snapshot.provider_request_context->'customer_public_gbp_reference'=p_public_gbp_reference
      and snapshot.provider_request_context->>'subject_reference_checksum'
        =p_public_gbp_payload->>'subject_reference_checksum'
      and snapshot.provider_request_context->>'job_id'=p_job_id::text
  ) then
    raise exception 'immutable v2.2 public GBP reference conflict';
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


create function public.persist_v22_prospect_result(
  p_job_id uuid,p_case_id uuid,
  p_site_snapshot_id uuid,p_site_payload jsonb,p_site_checksum text,
  p_serp_snapshot_id uuid,p_serp_payload jsonb,p_serp_checksum text,p_serp_expires_at timestamptz,
  p_competitor_snapshot_id uuid,p_competitor_payload jsonb,p_competitor_checksum text,
  p_public_gbp_snapshot_id uuid,p_public_gbp_payload jsonb,p_public_gbp_checksum text,
  p_public_gbp_expires_at timestamptz,p_public_gbp_reference jsonb,
  p_report_payload jsonb,p_run_generation integer
) returns table(report_id uuid,idempotent boolean)
language plpgsql set search_path=public as $$
declare current_generation integer;
begin
  select run_generation into current_generation from public.analysis_jobs
    where id=p_job_id and case_id=p_case_id for update;
  if current_generation is null or current_generation<>p_run_generation then
    raise exception 'prospect analysis generation is no longer active';
  end if;
  return query select * from public.persist_v22_prospect_result(
    p_job_id,p_case_id,p_site_snapshot_id,p_site_payload,p_site_checksum,
    p_serp_snapshot_id,p_serp_payload,p_serp_checksum,p_serp_expires_at,
    p_competitor_snapshot_id,p_competitor_payload,p_competitor_checksum,
    p_public_gbp_snapshot_id,p_public_gbp_payload,p_public_gbp_checksum,
    p_public_gbp_expires_at,p_public_gbp_reference,p_report_payload);
end;
$$;

create or replace function public.start_v22_verified_analysis(
  p_user_id uuid, p_case_id uuid, p_job_id uuid, p_idempotency_key text,
  p_parent_payload_checksum text, p_expected_parent_report_id uuid, p_previous_job_id uuid default null
) returns table (
  job_id uuid, created boolean, idempotent boolean, parent_report_id uuid,
  gsc_snapshot_id uuid, ga4_snapshot_id uuid, public_gbp_snapshot_id uuid, audit_credits integer
)
language plpgsql set search_path = public as $$
declare
  c public.client_cases;
  parent public.reports;
  current_report public.reports;
  existing_job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  b public.case_source_bindings;
  s public.data_snapshots;
  public_snapshot public.data_snapshots;
  public_reference jsonb;
  source text;
  selected_gsc uuid;
  selected_ga4 uuid;
  public_ids uuid[];
  resulting_balance integer;
  discovered_connection_ids uuid[];
  locked_connection_ids uuid[] := '{}'::uuid[];
  current_connection_ids uuid[];
  connection_to_lock record;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200
    or p_parent_payload_checksum is null or p_parent_payload_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;
  -- Google selection/sync locks connection -> Case -> binding. Discover without
  -- locks, then acquire every relevant connection in UUID order before the Case.
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into discovered_connection_ids
  from public.case_source_bindings binding
  join public.client_cases owned_case on owned_case.id = binding.case_id
  where binding.case_id = p_case_id and owned_case.user_id = p_user_id
    and binding.is_active and binding.source_type in ('gsc','ga4');
  for connection_to_lock in select g.id from public.google_connections g
    where g.id = any(discovered_connection_ids) and g.user_id = p_user_id
    order by g.id for update
  loop
    locked_connection_ids := array_append(locked_connection_ids, connection_to_lock.id);
  end loop;

  -- Serialize attempts only after obtaining the shared Google lock prefix.
  -- NO KEY UPDATE lets compensation's ledger FK take Case KEY SHARE while this
  -- transaction waits for the job; FOR UPDATE would form a Case/job deadlock.
  select * into c from public.client_cases
  where id = p_case_id and user_id = p_user_id and status = 'active' for no key update;
  if not found then raise exception 'V22_VERIFIED_CASE_INVALID'; end if;

  select * into existing_job from public.analysis_jobs j
  where j.id = p_job_id or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by (j.id = p_job_id) desc limit 1 for update;
  if found then
    select * into bound from public.verified_analysis_inputs i where i.job_id = existing_job.id;
    if existing_job.id is distinct from p_job_id or existing_job.case_id is distinct from p_case_id
      or existing_job.job_type <> 'verified_report' or existing_job.idempotency_key <> p_idempotency_key
      or existing_job.previous_job_id is distinct from p_previous_job_id
      or bound.job_id is null or bound.case_id <> p_case_id
      or bound.parent_report_id is distinct from p_expected_parent_report_id
      or bound.parent_payload_checksum is distinct from p_parent_payload_checksum
      or not exists (select 1 from public.analysis_attempt_charges a where a.job_id = p_job_id
        and a.case_id = p_case_id and a.user_id = p_user_id and a.source = 'account_credit') then
      raise exception 'V22_VERIFIED_IDENTITY_CONFLICT';
    end if;
    select u.audit_credits into resulting_balance from public.users u where u.id = p_user_id;
    return query select p_job_id, false, true, bound.parent_report_id, bound.gsc_snapshot_id,
      bound.ga4_snapshot_id, bound.public_gbp_snapshot_id, resulting_balance;
    return;
  end if;
  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs j where j.id = p_previous_job_id and j.case_id = p_case_id
      and j.job_type = 'verified_report' and j.status = 'failed'
  ) then raise exception 'V22_VERIFIED_PREVIOUS_JOB_INVALID'; end if;

  select * into current_report from public.reports r where r.id = c.latest_report_id for share;
  select * into parent from public.reports r
  where r.id = case when current_report.report_type = 'prospect' then current_report.id
    when current_report.report_type = 'verified_execution' then current_report.parent_report_id end for share;
  -- The trusted caller hashes a report before this transaction. Bind its exact
  -- identity to the parent selected under the Case lock before any debit/write.
  if p_expected_parent_report_id is null or parent.id is distinct from p_expected_parent_report_id then
    raise exception 'V22_VERIFIED_PARENT_CHANGED';
  end if;
  if parent.id is null or parent.user_id <> p_user_id or parent.case_id <> p_case_id
    or parent.report_type <> 'prospect' or parent.status <> 'paid_full' or parent.schema_version <> '2.2.0'
    or parent.parent_report_id is not null or jsonb_typeof(parent.report_v2_2) is distinct from 'object'
    or parent.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text
    or parent.report_v2_2 #>> '{report_version,report_id}' is distinct from parent.id::text
    or parent.report_v2_2 #>> '{report_version,report_type}' is distinct from 'prospect'
    or parent.report_v2_2 #>> '{report_version,schema_version}' is distinct from '2.2.0'
    or parent.report_v2_2 #> '{report_version,parent_report_id}' is distinct from 'null'::jsonb
    or parent.report_v2_2 #>> '{report_version,version_number}' is distinct from parent.version_number::text then
    raise exception 'V22_VERIFIED_PARENT_INVALID';
  end if;
  if cardinality(parent.snapshot_ids) is distinct from 4 or (
    select count(distinct d.source_type) from public.data_snapshots d
    where d.id = any(parent.snapshot_ids) and d.case_id = p_case_id and d.source_type in ('site','serp','competitor','gbp')
  ) <> 4 then raise exception 'V22_VERIFIED_PARENT_SNAPSHOTS_INVALID'; end if;

  select array_agg(distinct (e->>'snapshot_id')::uuid) into public_ids
  from jsonb_array_elements(parent.report_v2_2->'evidence_index') e
  where e->>'source_type' = 'gbp' and e->>'health_status' = 'healthy'
    and e #>> '{source_locator,url}' = c.business_identity->>'public_gbp_url'
    and btrim(c.business_identity->>'public_gbp_url') <> ''
    and exists (select 1 from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type' = 'gbp' and coverage->>'health_status' = 'healthy'
        and coverage->>'identity_match_status' = 'matched'
        and coverage->'snapshot_ids' @> jsonb_build_array(e->>'snapshot_id'));
  if cardinality(public_ids) is distinct from 1 or not (public_ids[1] = any(parent.snapshot_ids))
    or parent.report_v2_2 #>> '{identity,business,public_gbp_url}'
       is distinct from c.business_identity->>'public_gbp_url'
    or (select count(*) from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type'='gbp' and coverage->>'health_status'='healthy'
        and coverage->>'identity_match_status'='matched'
        and coverage->'snapshot_ids'=jsonb_build_array(public_ids[1]::text)) <> 1 then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;
  select * into public_snapshot from public.data_snapshots d
    where d.id=public_ids[1] and d.case_id=p_case_id for share;
  public_reference := public_snapshot.provider_request_context->'customer_public_gbp_reference';
  if public_snapshot.id is null or public_snapshot.source_type <> 'gbp'
    or public_snapshot.schema_version <> 'customer_public_gbp_snapshot_v1'
    or public_snapshot.health_status <> 'healthy' or public_snapshot.expires_at is null
    or public_snapshot.expires_at <= now() or public_snapshot.fetched_at > now()
    or public_snapshot.normalized_payload->>'schema_version' <> 'customer_public_gbp_snapshot_v1'
    or public_snapshot.normalized_payload->>'health_status' <> 'healthy'
    or public_snapshot.normalized_payload->>'identity_match_status' <> 'matched'
    or public_snapshot.normalized_payload->>'subject_reference_checksum' !~ '^sha256:[0-9a-f]{64}$'
    or public_snapshot.provider_request_context->>'subject_reference_checksum'
       is distinct from public_snapshot.normalized_payload->>'subject_reference_checksum'
    or jsonb_typeof(public_reference) is distinct from 'object'
    or (public_reference->>'case_id')::uuid is distinct from p_case_id
    or public_reference->>'site_url' is distinct from parent.report_v2_2 #>> '{identity,business,site_url}'
    or public_reference->>'public_gbp_url' is distinct from c.business_identity->>'public_gbp_url'
    or public_reference->>'confirmation_source' is distinct from 'user'
    or public_snapshot.normalized_payload->'request_target' is distinct from jsonb_build_object(
      'public_gbp_url',public_reference->'public_gbp_url','entity_keys',public_reference->'entity_keys')
    or public_snapshot.fetched_at is distinct from (public_snapshot.normalized_payload->>'completed_at')::timestamptz
    or public_snapshot.expires_at is distinct from (public_snapshot.normalized_payload->>'expires_at')::timestamptz then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;

  perform 1 from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4')
    order by binding.id for share;
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into current_connection_ids
  from public.case_source_bindings binding
  where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4');
  -- A rebinding may finish between discovery and our Case lock. Never acquire a
  -- newly discovered connection after the Case: roll back so callers can retry.
  if current_connection_ids is distinct from discovered_connection_ids
    or current_connection_ids is distinct from locked_connection_ids then
    raise exception 'V22_VERIFIED_BINDING_CHANGED' using errcode = '40001';
  end if;
  foreach source in array array['gsc','ga4'] loop
    select * into b from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.source_type = source and binding.is_active for share;
    if b.id is null or b.identity_match_status <> 'matched' or b.confirmed_at is null
      or b.confirmed_by_user_id is distinct from p_user_id or b.health_status <> 'healthy' then
      raise exception 'V22_VERIFIED_BINDING_INVALID';
    end if;
    perform 1 from public.google_connections g
      where g.id = b.connection_id and g.user_id = p_user_id and g.status = 'active';
    if not found then raise exception 'V22_VERIFIED_CONNECTION_INVALID'; end if;
    -- Pick the latest first, then validate; never fall back to an older healthy row.
    select * into s from public.data_snapshots d where d.binding_id = b.id and d.source_type = source
      order by d.fetched_at desc, d.id desc limit 1 for share;
    if s.id is null or s.case_id <> p_case_id or s.health_status <> 'healthy'
      or s.schema_version <> source || '_sync_v1' or s.expires_at is null or s.expires_at <= now()
      or s.fetched_at > now() or s.coverage_start is null or s.coverage_end is null
      or s.raw_payload is not null
      or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id then
      raise exception 'V22_VERIFIED_SNAPSHOT_INVALID';
    end if;
    if source = 'gsc' then selected_gsc := s.id; else selected_ga4 := s.id; end if;
  end loop;
  if public_ids[1] in (selected_gsc, selected_ga4) then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  update public.users u set audit_credits = u.audit_credits - 1
    where u.id = p_user_id and u.audit_credits >= 1 returning u.audit_credits into resulting_balance;
  if resulting_balance is null then raise exception 'V22_VERIFIED_CREDIT_UNAVAILABLE'; end if;
  insert into public.analysis_jobs (
    id,case_id,job_type,status,current_stage,progress,attempt_count,idempotency_key,
    cost_counters,run_generation,deadline_at,previous_job_id
  ) values (p_job_id,p_case_id,'verified_report','queued','queued',0,0,p_idempotency_key,
    '{}'::jsonb,1,now()+interval '20 minutes',p_previous_job_id);
  insert into public.analysis_attempt_charges(user_id,case_id,job_id,source)
    values (p_user_id,p_case_id,p_job_id,'account_credit');
  insert into public.audit_credit_ledger(user_id,case_id,job_id,kind,delta,balance_after)
    values (p_user_id,p_case_id,p_job_id,'attempt_debit',-1,resulting_balance);
  -- Service-role caller hashes the complete ReportV22 using recursive sorted keys,
  -- preserved array order and JSON.stringify. Do not reserialize JSONB for hashing:
  -- PostgreSQL numeric scale is not the application's canonical byte encoding.
  insert into public.verified_analysis_inputs(job_id,case_id,parent_report_id,gsc_snapshot_id,
    ga4_snapshot_id,public_gbp_snapshot_id,parent_snapshot_ids,parent_payload,parent_payload_checksum)
    values (p_job_id,p_case_id,parent.id,selected_gsc,selected_ga4,public_ids[1],
      parent.snapshot_ids,parent.report_v2_2,p_parent_payload_checksum);
  return query select p_job_id,true,false,parent.id,selected_gsc,selected_ga4,public_ids[1],resulting_balance;
end;
$$;


create or replace function public.resolve_v22_verified_analysis_input(p_job_id uuid,p_case_id uuid,p_run_generation integer)
returns jsonb language plpgsql set search_path = public as $$
declare
  bound public.verified_analysis_inputs;
  source_snapshots jsonb;
  first_party jsonb;
  public_gbp jsonb;
begin
  perform 1 from public.analysis_jobs j where j.id = p_job_id and j.case_id = p_case_id
    and j.job_type = 'verified_report' and j.run_generation = p_run_generation
    and j.status in ('queued','running') for share;
  if not found then raise exception 'V22_VERIFIED_JOB_INVALID'; end if;
  select * into bound from public.verified_analysis_inputs i
    where i.job_id = p_job_id and i.case_id = p_case_id for share;
  if not found then raise exception 'V22_VERIFIED_INPUT_INVALID'; end if;
  select jsonb_object_agg(d.source_type, jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at
  )) into source_snapshots from public.data_snapshots d where d.id = any(bound.parent_snapshot_ids);
  select jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'reference',d.provider_request_context->'customer_public_gbp_reference'
  ) into public_gbp from public.data_snapshots d
    where d.id=bound.public_gbp_snapshot_id and d.case_id=p_case_id and d.source_type='gbp';
  if public_gbp is null then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;
  select jsonb_agg(jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'binding_id',d.binding_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'identity_match_status','matched','health_status',d.health_status,'health_reasons',d.health_reasons,
    'normalized_payload',d.normalized_payload,'raw_payload',null,'payload_checksum',d.payload_checksum,
    'external_resource_id',d.provider_request_context->>'external_resource_id',
    'coverage_start',d.coverage_start,'coverage_end',d.coverage_end
  ) order by case d.id when bound.gsc_snapshot_id then 1 else 2 end) into first_party
  from public.data_snapshots d where d.id in (bound.gsc_snapshot_id,bound.ga4_snapshot_id);
  return jsonb_build_object('schema_version','v22_verified_resolved_input_v1','job_id',p_job_id,
    'case_id',p_case_id,'parent_report',bound.parent_payload,'parent_payload_checksum',bound.parent_payload_checksum,
    'site_snapshot',source_snapshots->'site','serp_snapshot',source_snapshots->'serp',
    'competitor_snapshot',source_snapshots->'competitor','public_gbp_snapshot',public_gbp,
    'first_party_snapshots',first_party);
end;
$$;

revoke all on function public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb) to service_role;
revoke all on function public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb,integer) to service_role;
revoke all on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)
  to service_role;
revoke all on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  to service_role;

commit;
