begin;

-- A lost HTTP acknowledgement may leave PostgreSQL durably succeeded while
-- Redis retries the same run. Rebuild the frozen input capability only for the
-- exact report-backed, consumed-charge success tuple; all other terminal jobs
-- remain unreadable to the executor.
create or replace function public.resolve_v22_verified_analysis_input(
  p_job_id uuid,
  p_case_id uuid,
  p_run_generation integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  charge public.analysis_attempt_charges;
  succeeded_report public.reports;
  source_snapshots jsonb;
  first_party jsonb;
  public_gbp jsonb;
begin
  select * into job
  from public.analysis_jobs j
  where j.id = p_job_id
    and j.case_id = p_case_id
    and j.job_type = 'verified_report'
    and j.run_generation = p_run_generation
  for share;
  if not found then
    raise exception 'V22_VERIFIED_JOB_INVALID';
  end if;

  select * into bound
  from public.verified_analysis_inputs i
  where i.job_id = p_job_id and i.case_id = p_case_id
  for share;
  if not found then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;

  if job.status not in ('queued', 'running') then
    if job.status <> 'succeeded'
      or job.report_id is distinct from p_job_id
      or job.current_stage <> 'completed'
      or job.progress <> 100
      or job.error_code is not null
      or job.completed_at is null then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;

    select * into charge
    from public.analysis_attempt_charges a
    where a.job_id = p_job_id
    for share;
    select * into succeeded_report
    from public.reports r
    where r.id = p_job_id
    for share;
    if charge.id is null
      or charge.case_id is distinct from p_case_id
      or charge.source <> 'account_credit'
      or charge.state <> 'consumed'
      or charge.settled_at is null
      or succeeded_report.id is null
      or succeeded_report.case_id is distinct from p_case_id
      or succeeded_report.user_id is distinct from charge.user_id
      or succeeded_report.report_type <> 'verified_execution'
      or succeeded_report.schema_version <> '2.2.0'
      or succeeded_report.parent_report_id is distinct from bound.parent_report_id
      or succeeded_report.report_v2_2 #>> '{report_version,report_id}' is distinct from p_job_id::text
      or succeeded_report.report_v2_2 #>> '{report_version,report_type}' is distinct from 'verified_execution'
      or succeeded_report.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text then
      raise exception 'V22_VERIFIED_JOB_INVALID';
    end if;
  end if;

  select jsonb_object_agg(d.source_type, jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at
  )) into source_snapshots
  from public.data_snapshots d
  where d.id = any(bound.parent_snapshot_ids);

  select jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'normalized_payload',d.normalized_payload,'payload_checksum',d.payload_checksum,
    'created_at',d.created_at,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'reference',d.provider_request_context->'customer_public_gbp_reference'
  ) into public_gbp
  from public.data_snapshots d
  where d.id = bound.public_gbp_snapshot_id
    and d.case_id = p_case_id
    and d.source_type = 'gbp';
  if public_gbp is null then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;

  select jsonb_agg(jsonb_build_object(
    'snapshot_id',d.id,'case_id',d.case_id,'binding_id',d.binding_id,'source_type',d.source_type,
    'schema_version',d.schema_version,'fetched_at',d.fetched_at,'expires_at',d.expires_at,
    'identity_match_status','matched','health_status',d.health_status,'health_reasons',d.health_reasons,
    'normalized_payload',d.normalized_payload,'raw_payload',null,'payload_checksum',d.payload_checksum,
    'external_resource_id',d.provider_request_context->>'external_resource_id',
    'coverage_start',d.coverage_start,'coverage_end',d.coverage_end
  ) order by case d.id when bound.gsc_snapshot_id then 1 else 2 end) into first_party
  from public.data_snapshots d
  where d.id in (bound.gsc_snapshot_id, bound.ga4_snapshot_id);

  return jsonb_build_object(
    'schema_version','v22_verified_resolved_input_v1',
    'job_id',p_job_id,
    'case_id',p_case_id,
    'parent_report',bound.parent_payload,
    'parent_payload_checksum',bound.parent_payload_checksum,
    'site_snapshot',source_snapshots->'site',
    'serp_snapshot',source_snapshots->'serp',
    'competitor_snapshot',source_snapshots->'competitor',
    'public_gbp_snapshot',public_gbp,
    'first_party_snapshots',first_party
  );
end;
$$;

revoke all on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer)
  to service_role;

comment on function public.resolve_v22_verified_analysis_input(uuid,uuid,integer) is
  'Resolves frozen Verified inputs for active work or exact consumed report-backed success replay.';

commit;
