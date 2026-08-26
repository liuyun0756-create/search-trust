-- SearchTrust v2.2 case-centric data model.
-- Forward-only, expand-only migration: existing v2.1 rows remain valid.

begin;

create table public.client_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  site_url text not null,
  normalized_domain text not null,
  business_name text not null,
  business_identity jsonb not null,
  operating_model text not null
    check (operating_model in ('storefront', 'service_area', 'hybrid')),
  primary_service text not null,
  target_market jsonb not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  latest_report_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_cases_nonempty_identity_check check (
    btrim(site_url) <> '' and
    btrim(normalized_domain) <> '' and
    btrim(business_name) <> '' and
    btrim(primary_service) <> ''
  ),
  constraint client_cases_normalized_domain_check check (
    normalized_domain = lower(normalized_domain) and
    normalized_domain !~ '[^a-z0-9.-]' and
    normalized_domain not like '%..%' and
    left(normalized_domain, 1) not in ('.', '-') and
    right(normalized_domain, 1) not in ('.', '-')
  ),
  constraint client_cases_json_shape_check check (
    jsonb_typeof(business_identity) = 'object' and
    jsonb_typeof(target_market) = 'object'
  ),
  constraint client_cases_archive_state_check check (
    (status = 'active' and archived_at is null) or
    (status = 'archived' and archived_at is not null)
  )
);

create index idx_client_cases_user_status_updated
  on public.client_cases (user_id, status, updated_at desc);
create index idx_client_cases_user_domain
  on public.client_cases (user_id, normalized_domain);
create index idx_client_cases_latest_report
  on public.client_cases (latest_report_id)
  where latest_report_id is not null;

create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  google_subject text not null,
  account_email text,
  account_display_name text,
  granted_scopes text[] not null default '{}',
  access_token_ciphertext bytea,
  access_token_iv bytea,
  access_token_auth_tag bytea,
  refresh_token_ciphertext bytea,
  refresh_token_iv bytea,
  refresh_token_auth_tag bytea,
  encryption_key_version text,
  token_expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'error', 'revoked', 'deleted')),
  last_error_code text,
  last_error_message text,
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_connections_subject_check check (btrim(google_subject) <> ''),
  constraint google_connections_scope_check check (
    array_position(granted_scopes, null) is null
  ),
  constraint google_connections_access_token_triplet_check check (
    (access_token_ciphertext is null and access_token_iv is null and access_token_auth_tag is null) or
    (access_token_ciphertext is not null and access_token_iv is not null and access_token_auth_tag is not null)
  ),
  constraint google_connections_refresh_token_triplet_check check (
    (refresh_token_ciphertext is null and refresh_token_iv is null and refresh_token_auth_tag is null) or
    (refresh_token_ciphertext is not null and refresh_token_iv is not null and refresh_token_auth_tag is not null)
  ),
  constraint google_connections_key_version_check check (
    (
      access_token_ciphertext is null and
      refresh_token_ciphertext is null
    ) or btrim(coalesce(encryption_key_version, '')) <> ''
  ),
  constraint google_connections_terminal_token_check check (
    status not in ('revoked', 'deleted') or (
      access_token_ciphertext is null and access_token_iv is null and access_token_auth_tag is null and
      refresh_token_ciphertext is null and refresh_token_iv is null and refresh_token_auth_tag is null and
      encryption_key_version is null and token_expires_at is null
    )
  ),
  constraint google_connections_active_token_check check (
    status <> 'active' or access_token_ciphertext is not null
  ),
  constraint google_connections_status_timestamp_check check (
    (status = 'revoked' and revoked_at is not null and deleted_at is null) or
    (status = 'deleted' and deleted_at is not null) or
    (status in ('active', 'error') and revoked_at is null and deleted_at is null)
  )
);

create unique index uq_google_connections_live_subject
  on public.google_connections (user_id, google_subject)
  where deleted_at is null;
create index idx_google_connections_user_status
  on public.google_connections (user_id, status, updated_at desc);

create table public.case_source_bindings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases(id) on delete cascade,
  connection_id uuid references public.google_connections(id) on delete set null,
  source_type text not null check (source_type in ('gsc', 'ga4', 'gbp')),
  external_resource_id text not null,
  external_resource_name text not null,
  identity_match_status text not null
    check (identity_match_status in ('not_checked', 'matched', 'mismatch', 'needs_confirmation')),
  identity_match_evidence jsonb not null default '{}'::jsonb,
  health_status text not null
    check (health_status in ('not_checked', 'healthy', 'unhealthy', 'unavailable', 'expired', 'error')),
  health_reasons jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  confirmed_by_user_id uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  last_synced_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_source_bindings_resource_check check (
    btrim(external_resource_id) <> '' and btrim(external_resource_name) <> ''
  ),
  constraint case_source_bindings_json_shape_check check (
    jsonb_typeof(identity_match_evidence) = 'object' and
    jsonb_typeof(health_reasons) = 'array'
  ),
  constraint case_source_bindings_active_state_check check (
    (is_active and connection_id is not null and disconnected_at is null) or
    (not is_active and disconnected_at is not null)
  ),
  constraint case_source_bindings_confirmation_check check (
    (confirmed_by_user_id is null and confirmed_at is null) or
    (confirmed_by_user_id is not null and confirmed_at is not null)
  )
);

create unique index uq_case_source_bindings_active_source
  on public.case_source_bindings (case_id, source_type)
  where is_active;
create index idx_case_source_bindings_connection
  on public.case_source_bindings (connection_id)
  where connection_id is not null;

create table public.data_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases(id) on delete cascade,
  binding_id uuid references public.case_source_bindings(id)
    on delete no action deferrable initially deferred,
  source_type text not null
    check (source_type in ('site', 'serp', 'competitor', 'gsc', 'gbp', 'ga4', 'pagespeed')),
  schema_version text not null,
  coverage_start date,
  coverage_end date,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  sync_trigger text not null
    check (sync_trigger in ('report_generation', 'user_sync', 'retry', 'migration')),
  health_status text not null
    check (health_status in ('not_checked', 'healthy', 'unhealthy', 'unavailable', 'expired', 'error')),
  health_reasons jsonb not null default '[]'::jsonb,
  normalized_payload jsonb not null,
  raw_payload jsonb,
  payload_checksum text not null,
  provider_request_context jsonb not null default '{}'::jsonb,
  retention_policy text not null default 'standard'
    check (retention_policy in ('standard', 'gbp_content_30d')),
  raw_content_deleted_at timestamptz,
  supersedes_snapshot_id uuid references public.data_snapshots(id)
    on delete no action deferrable initially deferred,
  created_at timestamptz not null default now(),
  constraint data_snapshots_schema_version_check check (btrim(schema_version) <> ''),
  constraint data_snapshots_coverage_check check (
    coverage_start is null or coverage_end is null or coverage_start <= coverage_end
  ),
  constraint data_snapshots_json_shape_check check (
    jsonb_typeof(health_reasons) = 'array' and
    jsonb_typeof(normalized_payload) = 'object' and
    (raw_payload is null or jsonb_typeof(raw_payload) in ('object', 'array')) and
    jsonb_typeof(provider_request_context) = 'object'
  ),
  constraint data_snapshots_checksum_check check (
    payload_checksum ~ '^sha256:[0-9a-f]{64}$'
  ),
  constraint data_snapshots_retention_check check (
    retention_policy <> 'gbp_content_30d' or (
      source_type = 'gbp' and
      expires_at is not null and
      expires_at <= fetched_at + interval '30 days'
    )
  ),
  constraint data_snapshots_raw_cleanup_check check (
    raw_content_deleted_at is null or (
      retention_policy = 'gbp_content_30d' and raw_payload is null
    )
  ),
  constraint data_snapshots_not_self_superseding_check check (
    supersedes_snapshot_id is null or supersedes_snapshot_id <> id
  )
);

create index idx_data_snapshots_case_source_fetched
  on public.data_snapshots (case_id, source_type, fetched_at desc);
create index idx_data_snapshots_binding
  on public.data_snapshots (binding_id)
  where binding_id is not null;
create index idx_data_snapshots_supersedes
  on public.data_snapshots (supersedes_snapshot_id)
  where supersedes_snapshot_id is not null;
create index idx_data_snapshots_raw_expiry
  on public.data_snapshots (expires_at)
  where retention_policy = 'gbp_content_30d' and raw_payload is not null;

alter table public.reports
  add column case_id uuid references public.client_cases(id) on delete cascade,
  add column report_type text check (report_type in ('prospect', 'verified_execution')),
  add column schema_version text,
  add column version_number integer check (version_number > 0),
  add column parent_report_id uuid references public.reports(id)
    on delete no action deferrable initially deferred,
  add column report_v2_2 jsonb,
  add column snapshot_ids uuid[],
  add column coverage_state jsonb,
  add column version_diff jsonb,
  add column generation_config jsonb,
  add column ruleset_version text,
  add column copy_model_version text,
  add constraint reports_v2_2_json_shape_check check (
    (report_v2_2 is null or jsonb_typeof(report_v2_2) = 'object') and
    (coverage_state is null or jsonb_typeof(coverage_state) = 'object') and
    (version_diff is null or jsonb_typeof(version_diff) = 'object') and
    (generation_config is null or jsonb_typeof(generation_config) = 'object')
  ),
  add constraint reports_v2_2_complete_payload_check check (
    report_v2_2 is null or (
      case_id is not null and
      report_type is not null and
      btrim(coalesce(schema_version, '')) <> '' and
      version_number is not null and
      coalesce(cardinality(snapshot_ids), 0) > 0 and
      coverage_state is not null and
      version_diff is not null and
      generation_config is not null and
      btrim(coalesce(ruleset_version, '')) <> '' and
      btrim(coalesce(copy_model_version, '')) <> ''
    )
  ),
  add constraint reports_v2_2_parent_shape_check check (
    report_type is null or
    (report_type = 'prospect' and parent_report_id is null) or
    (report_type = 'verified_execution' and parent_report_id is not null)
  );

create index idx_reports_case_version
  on public.reports (case_id, version_number desc)
  where case_id is not null;
create index idx_reports_parent_report
  on public.reports (parent_report_id)
  where parent_report_id is not null;

alter table public.client_cases
  add constraint client_cases_latest_report_fk
  foreign key (latest_report_id) references public.reports(id) on delete set null;

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.client_cases(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  job_type text not null
    check (job_type in ('prospect_report', 'verified_report', 'source_sync')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  current_stage text not null,
  progress smallint not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key text not null,
  error_code text,
  user_message text,
  cost_counters jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_jobs_nonempty_check check (
    btrim(current_stage) <> '' and btrim(idempotency_key) <> ''
  ),
  constraint analysis_jobs_cost_shape_check check (jsonb_typeof(cost_counters) = 'object'),
  constraint analysis_jobs_terminal_state_check check (
    (status in ('queued', 'running') and completed_at is null) or
    (status = 'succeeded' and progress = 100 and completed_at is not null and error_code is null) or
    (status = 'failed' and completed_at is not null and btrim(coalesce(error_code, '')) <> '')
  )
);

create unique index uq_analysis_jobs_case_idempotency
  on public.analysis_jobs (case_id, idempotency_key);
create index idx_analysis_jobs_status_heartbeat
  on public.analysis_jobs (status, heartbeat_at);
create index idx_analysis_jobs_case_created
  on public.analysis_jobs (case_id, created_at desc);
create index idx_analysis_jobs_report
  on public.analysis_jobs (report_id)
  where report_id is not null;

create or replace function public.set_v22_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_client_cases_updated_at
before update on public.client_cases
for each row execute function public.set_v22_updated_at();

create trigger set_google_connections_updated_at
before update on public.google_connections
for each row execute function public.set_v22_updated_at();

create trigger set_case_source_bindings_updated_at
before update on public.case_source_bindings
for each row execute function public.set_v22_updated_at();

create trigger set_analysis_jobs_updated_at
before update on public.analysis_jobs
for each row execute function public.set_v22_updated_at();

create or replace function public.validate_v22_connection_token_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('revoked', 'deleted') and (
    new.access_token_ciphertext is not null or
    new.access_token_iv is not null or
    new.access_token_auth_tag is not null or
    new.refresh_token_ciphertext is not null or
    new.refresh_token_iv is not null or
    new.refresh_token_auth_tag is not null or
    new.encryption_key_version is not null or
    new.token_expires_at is not null
  ) then
    raise exception using
      errcode = '23514',
      message = 'terminal Google connections must not retain token material';
  end if;
  return new;
end;
$$;

create trigger validate_google_connection_token_state
before insert or update on public.google_connections
for each row execute function public.validate_v22_connection_token_state();

create or replace function public.validate_v22_case_latest_report()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  candidate record;
begin
  if new.latest_report_id is null then
    return new;
  end if;

  select case_id, user_id into candidate
  from public.reports
  where id = new.latest_report_id;

  if not found or candidate.case_id is distinct from new.id or candidate.user_id is distinct from new.user_id then
    raise exception using
      errcode = '23514',
      message = 'latest_report_id must reference a report owned by the same case and user';
  end if;
  return new;
end;
$$;

create trigger validate_client_case_latest_report
before insert or update of latest_report_id, user_id on public.client_cases
for each row execute function public.validate_v22_case_latest_report();

create or replace function public.validate_v22_binding_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  case_owner uuid;
  connection_owner uuid;
begin
  select user_id into case_owner from public.client_cases where id = new.case_id;
  if not found then
    return new;
  end if;

  if new.connection_id is not null then
    select user_id into connection_owner from public.google_connections where id = new.connection_id;
    if not found or connection_owner is distinct from case_owner then
      raise exception using errcode = '23514', message = 'binding connection must belong to the case owner';
    end if;
  end if;

  if new.confirmed_by_user_id is not null and new.confirmed_by_user_id is distinct from case_owner then
    raise exception using errcode = '23514', message = 'binding confirmer must be the case owner';
  end if;
  return new;
end;
$$;

create trigger validate_case_source_binding_ownership
before insert or update of case_id, connection_id, confirmed_by_user_id on public.case_source_bindings
for each row execute function public.validate_v22_binding_ownership();

create or replace function public.validate_v22_snapshot_relationships()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  related_case_id uuid;
  related_source_type text;
begin
  if new.binding_id is not null then
    select case_id, source_type into related_case_id, related_source_type
    from public.case_source_bindings where id = new.binding_id;
    if not found or related_case_id is distinct from new.case_id or related_source_type is distinct from new.source_type then
      raise exception using errcode = '23514', message = 'snapshot binding must match snapshot case and source';
    end if;
  end if;

  if new.supersedes_snapshot_id is not null then
    select case_id, source_type into related_case_id, related_source_type
    from public.data_snapshots where id = new.supersedes_snapshot_id;
    if not found or related_case_id is distinct from new.case_id or related_source_type is distinct from new.source_type then
      raise exception using errcode = '23514', message = 'superseded snapshot must match snapshot case and source';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_data_snapshot_relationships
before insert or update of case_id, binding_id, source_type, supersedes_snapshot_id on public.data_snapshots
for each row execute function public.validate_v22_snapshot_relationships();

create or replace function public.enforce_v22_snapshot_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if row(
    new.id, new.case_id, new.binding_id, new.source_type, new.schema_version,
    new.coverage_start, new.coverage_end, new.fetched_at, new.expires_at,
    new.sync_trigger, new.health_status, new.health_reasons,
    new.normalized_payload, new.payload_checksum, new.provider_request_context,
    new.retention_policy, new.supersedes_snapshot_id, new.created_at
  ) is distinct from row(
    old.id, old.case_id, old.binding_id, old.source_type, old.schema_version,
    old.coverage_start, old.coverage_end, old.fetched_at, old.expires_at,
    old.sync_trigger, old.health_status, old.health_reasons,
    old.normalized_payload, old.payload_checksum, old.provider_request_context,
    old.retention_policy, old.supersedes_snapshot_id, old.created_at
  ) then
    raise exception using errcode = '23514', message = 'data snapshots are immutable';
  end if;

  if not (
    old.retention_policy = 'gbp_content_30d' and
    old.raw_payload is not null and new.raw_payload is null and
    old.raw_content_deleted_at is null and new.raw_content_deleted_at is not null
  ) then
    raise exception using errcode = '23514', message = 'only one-way GBP raw content cleanup is allowed';
  end if;
  return new;
end;
$$;

create trigger enforce_data_snapshot_immutability
before update on public.data_snapshots
for each row execute function public.enforce_v22_snapshot_immutability();

create or replace function public.validate_v22_report_relationships()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  case_owner uuid;
  parent_row record;
  snapshot_count integer;
  unique_snapshot_count integer;
  matching_snapshot_count integer;
begin
  if new.case_id is not null then
    select user_id into case_owner from public.client_cases where id = new.case_id;
    if not found or case_owner is distinct from new.user_id then
      raise exception using errcode = '23514', message = 'report case must belong to the report user';
    end if;
  end if;

  if new.parent_report_id is not null then
    select case_id, user_id, version_number into parent_row
    from public.reports where id = new.parent_report_id;
    if not found or
       parent_row.case_id is distinct from new.case_id or
       parent_row.user_id is distinct from new.user_id or
       parent_row.version_number is null or
       new.version_number is null or
       parent_row.version_number >= new.version_number then
      raise exception using errcode = '23514', message = 'parent report must be an earlier version from the same case and user';
    end if;
  end if;

  if new.snapshot_ids is not null then
    snapshot_count := cardinality(new.snapshot_ids);
    select count(distinct snapshot_id) into unique_snapshot_count
    from unnest(new.snapshot_ids) as ids(snapshot_id);
    if snapshot_count is distinct from unique_snapshot_count then
      raise exception using errcode = '23514', message = 'snapshot_ids must not contain duplicates or nulls';
    end if;

    select count(*) into matching_snapshot_count
    from public.data_snapshots
    where id = any(new.snapshot_ids) and case_id = new.case_id;
    if matching_snapshot_count is distinct from snapshot_count then
      raise exception using errcode = '23514', message = 'all report snapshots must belong to the report case';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_report_v2_2_relationships
before insert or update of user_id, case_id, version_number, parent_report_id, snapshot_ids on public.reports
for each row execute function public.validate_v22_report_relationships();

create or replace function public.enforce_v22_report_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.report_v2_2 is not null and row(
    new.case_id, new.report_type, new.schema_version, new.version_number,
    new.parent_report_id, new.report_v2_2, new.snapshot_ids, new.coverage_state,
    new.version_diff, new.generation_config, new.ruleset_version, new.copy_model_version
  ) is distinct from row(
    old.case_id, old.report_type, old.schema_version, old.version_number,
    old.parent_report_id, old.report_v2_2, old.snapshot_ids, old.coverage_state,
    old.version_diff, old.generation_config, old.ruleset_version, old.copy_model_version
  ) then
    raise exception using errcode = '23514', message = 'completed v2.2 report payloads are immutable';
  end if;
  return new;
end;
$$;

create trigger enforce_report_v2_2_immutability
before update on public.reports
for each row execute function public.enforce_v22_report_immutability();

create or replace function public.validate_v22_job_report()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  report_case_id uuid;
begin
  if new.report_id is null then
    return new;
  end if;
  select case_id into report_case_id from public.reports where id = new.report_id;
  if not found or report_case_id is distinct from new.case_id then
    raise exception using errcode = '23514', message = 'analysis job report must belong to the same case';
  end if;
  return new;
end;
$$;

create trigger validate_analysis_job_report
before insert or update of case_id, report_id on public.analysis_jobs
for each row execute function public.validate_v22_job_report();

-- Deleting a user first removes their case graphs. This guarantees that connection
-- cascades cannot temporarily null an active binding before that binding is deleted.
create or replace function public.delete_v22_user_case_graphs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.client_cases where user_id = old.id;
  return old;
end;
$$;

create trigger delete_user_v22_case_graphs
before delete on public.users
for each row execute function public.delete_v22_user_case_graphs();

alter table public.client_cases enable row level security;
alter table public.google_connections enable row level security;
alter table public.case_source_bindings enable row level security;
alter table public.data_snapshots enable row level security;
alter table public.analysis_jobs enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.client_cases to service_role;
grant select, insert, update, delete on table public.google_connections to service_role;
grant select, insert, update, delete on table public.case_source_bindings to service_role;
grant select, insert, update, delete on table public.data_snapshots to service_role;
grant select, insert, update, delete on table public.analysis_jobs to service_role;

revoke all on table public.client_cases from anon, authenticated;
revoke all on table public.google_connections from anon, authenticated;
revoke all on table public.case_source_bindings from anon, authenticated;
revoke all on table public.data_snapshots from anon, authenticated;
revoke all on table public.analysis_jobs from anon, authenticated;

comment on table public.client_cases is 'SearchTrust v2.2 user-owned analysis cases; archive is the default deletion path.';
comment on table public.google_connections is 'Server-only Google OAuth connections with application-encrypted token material.';
comment on table public.case_source_bindings is 'Confirmed Case-to-Google-resource bindings with source health metadata.';
comment on table public.data_snapshots is 'Immutable normalized source snapshots; only expiring GBP raw content may be redacted.';
comment on table public.analysis_jobs is 'Idempotent, resumable v2.2 report and source-sync jobs.';
comment on column public.reports.report_v2_2 is 'Immutable SearchTrust v2.2 report contract payload once populated.';

commit;
