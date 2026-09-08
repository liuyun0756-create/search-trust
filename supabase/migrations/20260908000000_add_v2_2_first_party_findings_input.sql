-- V22-070: resolve trusted single-source Findings inputs for Railway only.
-- Apply while verified-analysis feature flags remain disabled.
begin;

create function public.resolve_v22_first_party_findings_input(
  p_case_id uuid,
  p_parent_report_id uuid,
  p_gsc_snapshot_id uuid,
  p_ga4_snapshot_id uuid,
  p_gbp_snapshot_id uuid,
  p_evaluated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.client_cases;
  parent public.reports;
  requested record;
  selected record;
  snapshots jsonb := '[]'::jsonb;
begin
  if p_case_id is null or p_parent_report_id is null or p_gsc_snapshot_id is null
     or p_ga4_snapshot_id is null or p_evaluated_at is null
     or p_gsc_snapshot_id = p_ga4_snapshot_id
     or p_gbp_snapshot_id in (p_gsc_snapshot_id, p_ga4_snapshot_id) then
    raise exception 'FIRST_PARTY_INPUT_INVALID' using errcode = '22023';
  end if;

  -- The Case and parent are frozen before bindings/snapshots are projected.
  select * into c from public.client_cases
  where id = p_case_id and status = 'active'
  for share;
  if not found then
    raise exception 'FIRST_PARTY_CASE_INVALID' using errcode = '42501';
  end if;

  select * into parent from public.reports
  where id = p_parent_report_id
    and case_id = p_case_id
    and report_type = 'prospect'
    and schema_version = '2.2.0'
    and status = 'paid_full'
    and report_v2_2 is not null
  for share;
  if not found or c.latest_report_id is distinct from parent.id then
    raise exception 'FIRST_PARTY_PARENT_INVALID' using errcode = '22023';
  end if;

  for requested in
    select * from (values
      ('gsc'::text, 'gsc_sync_v1'::text, p_gsc_snapshot_id, 1),
      ('ga4'::text, 'ga4_sync_v1'::text, p_ga4_snapshot_id, 2),
      ('gbp'::text, 'gbp_sync_v1'::text, p_gbp_snapshot_id, 3)
    ) as expected(source_type, schema_version, snapshot_id, source_order)
    where snapshot_id is not null
    order by source_order
  loop
    select
      s.id as snapshot_id,
      s.case_id,
      s.binding_id,
      s.source_type,
      s.schema_version,
      s.fetched_at,
      s.expires_at,
      s.health_status,
      s.health_reasons,
      s.normalized_payload,
      s.raw_payload,
      s.raw_content_deleted_at,
      s.payload_checksum,
      s.provider_request_context,
      s.retention_policy,
      s.coverage_start,
      s.coverage_end,
      b.connection_id,
      b.external_resource_id,
      b.identity_match_status,
      b.confirmed_at
    into selected
    from public.data_snapshots s
    join public.case_source_bindings b on b.id = s.binding_id
    where s.id = requested.snapshot_id
      and s.case_id = p_case_id
      and s.source_type = requested.source_type
      and s.schema_version = requested.schema_version
      and b.case_id = p_case_id
      and b.source_type = requested.source_type
      and b.is_active
      and b.identity_match_status = 'matched'
      and b.confirmed_at is not null
      and b.health_status = s.health_status
      and b.health_reasons = s.health_reasons
      and b.external_resource_id = s.provider_request_context->>'external_resource_id'
      and not exists (
        select 1
        from public.data_snapshots newer
        where newer.binding_id = s.binding_id
          and newer.source_type = s.source_type
          and (newer.fetched_at, newer.id) > (s.fetched_at, s.id)
      )
    for share of s, b;

    if not found then
      raise exception 'FIRST_PARTY_BINDING_INVALID' using errcode = '22023';
    end if;
    if selected.fetched_at > p_evaluated_at then
      raise exception 'FIRST_PARTY_SNAPSHOT_INVALID' using errcode = '22023';
    end if;
    if selected.expires_at is null or selected.expires_at <= p_evaluated_at then
      if requested.source_type = 'gbp' then
        raise exception 'FIRST_PARTY_GBP_CONTENT_EXPIRED' using errcode = '22023';
      end if;
      raise exception 'FIRST_PARTY_SNAPSHOT_EXPIRED' using errcode = '22023';
    end if;
    if selected.coverage_start is null or selected.coverage_end is null
       or selected.coverage_start > selected.coverage_end
       or selected.payload_checksum !~ '^sha256:[a-f0-9]{64}$'
       or jsonb_typeof(selected.health_reasons) <> 'array'
       or jsonb_typeof(selected.normalized_payload) <> 'object' then
      raise exception 'FIRST_PARTY_SNAPSHOT_INVALID' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.google_connections g
      where g.id = selected.connection_id
        and g.user_id = c.user_id
        and g.status = 'active'
    ) then
      raise exception 'FIRST_PARTY_CONNECTION_INVALID' using errcode = '22023';
    end if;
    if requested.source_type = 'gbp' and (
      selected.retention_policy <> 'gbp_content_30d'
      or selected.raw_payload is null
      or selected.raw_content_deleted_at is not null
      or jsonb_typeof(selected.raw_payload) <> 'object'
    ) then
      raise exception 'FIRST_PARTY_GBP_CONTENT_EXPIRED' using errcode = '22023';
    end if;
    if requested.source_type <> 'gbp' and selected.raw_payload is not null then
      raise exception 'FIRST_PARTY_SNAPSHOT_INVALID' using errcode = '22023';
    end if;

    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'snapshot_id', selected.snapshot_id,
      'case_id', selected.case_id,
      'binding_id', selected.binding_id,
      'source_type', selected.source_type,
      'schema_version', selected.schema_version,
      'fetched_at', selected.fetched_at,
      'expires_at', selected.expires_at,
      'identity_match_status', selected.identity_match_status,
      'health_status', selected.health_status,
      'health_reasons', selected.health_reasons,
      'normalized_payload', selected.normalized_payload,
      'raw_payload', case when requested.source_type = 'gbp' then selected.raw_payload else null end,
      'payload_checksum', selected.payload_checksum,
      'external_resource_id', selected.external_resource_id,
      'coverage_start', selected.coverage_start,
      'coverage_end', selected.coverage_end
    ));
  end loop;

  return jsonb_build_object(
    'case_id', p_case_id,
    'parent_report_id', p_parent_report_id,
    'evaluated_at', p_evaluated_at,
    'snapshots', snapshots
  );
end;
$$;

revoke all on function public.resolve_v22_first_party_findings_input(
  uuid, uuid, uuid, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_v22_first_party_findings_input(
  uuid, uuid, uuid, uuid, uuid, timestamptz
) to service_role;

commit;

-- Rollback: keep verified-analysis flags off. This read-only RPC may remain safely;
-- remove it only with a later forward migration after Railway no longer calls it.
