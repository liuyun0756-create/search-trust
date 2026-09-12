begin;

set local role postgres;
set local lock_timeout = '2s';
set local statement_timeout = '60s';

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(28);

select is(
  (
    select string_agg(version, ',' order by version)
    from supabase_migrations.schema_migrations
  ),
  '20260706000000,20260707000000,20260812000000,20260826000000,20260827000000,20260827010000,20260903000000,20260904000000,20260904100000,20260905000000,20260905100000,20260905200000,20260906000000,20260907000000,20260907100000,20260908000000,20260909170000,20260910000000,20260910100000,20260912100000',
  'the database has exactly the approved 20 migrations in order'
);

select is(
  (
    select string_agg(c.relname, ',' order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in (
        'analysis_attempt_charges', 'analysis_jobs', 'audit_credit_ledger',
        'case_report_entitlements', 'case_source_bindings', 'client_cases',
        'data_snapshots', 'google_connection_events', 'google_connections',
        'google_oauth_sessions', 'google_sync_jobs', 'google_token_broker_requests',
        'identity_deletion_receipts', 'job_cost_summaries', 'orders',
        'report_shares', 'reports', 'users'
      )
  ),
  'analysis_attempt_charges,analysis_jobs,audit_credit_ledger,case_report_entitlements,case_source_bindings,client_cases,data_snapshots,google_connection_events,google_connections,google_oauth_sessions,google_sync_jobs,google_token_broker_requests,identity_deletion_receipts,job_cost_summaries,orders,report_shares,reports,users',
  'all 18 application tables exist'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'analysis_attempt_charges', 'analysis_jobs', 'audit_credit_ledger',
        'case_report_entitlements', 'case_source_bindings', 'client_cases',
        'data_snapshots', 'google_connection_events', 'google_connections',
        'google_oauth_sessions', 'google_sync_jobs', 'google_token_broker_requests',
        'identity_deletion_receipts', 'job_cost_summaries', 'orders',
        'report_shares', 'reports', 'users'
      )
      and c.relrowsecurity
  ),
  18::bigint,
  'RLS is enabled on every application table'
);

select is(
  (
    select count(*)
    from unnest(array[
      'analysis_attempt_charges', 'analysis_jobs', 'audit_credit_ledger',
      'case_report_entitlements', 'case_source_bindings', 'client_cases',
      'data_snapshots', 'google_connection_events', 'google_connections',
      'google_oauth_sessions', 'google_sync_jobs', 'google_token_broker_requests',
      'identity_deletion_receipts', 'job_cost_summaries', 'orders',
      'report_shares', 'reports', 'users'
    ]) as application_table(name)
    where has_table_privilege('anon', format('public.%I', name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', name), 'SELECT')
  ),
  0::bigint,
  'browser roles cannot read application tables directly'
);

select ok(
  (
    select bool_and(
      has_table_privilege('service_role', format('public.%I', name), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', name), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', name), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', name), 'DELETE')
    )
    from unnest(array[
      'analysis_attempt_charges', 'analysis_jobs', 'audit_credit_ledger',
      'case_report_entitlements', 'case_source_bindings', 'client_cases',
      'data_snapshots', 'google_connection_events', 'google_connections',
      'google_oauth_sessions', 'google_sync_jobs', 'google_token_broker_requests',
      'identity_deletion_receipts', 'job_cost_summaries', 'orders',
      'report_shares', 'reports', 'users'
    ]) as application_table(name)
  ),
  'service_role retains server-only CRUD access'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.rotate_v22_report_share(uuid,uuid,uuid,text,timestamp with time zone)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.rotate_v22_report_share(uuid,uuid,uuid,text,timestamp with time zone)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.rotate_v22_report_share(uuid,uuid,uuid,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'report sharing remains a server-only operation'
);

select lives_ok(
  $$
    insert into public.users (id, clerk_user_id, email, audit_credits)
    values
      ('22092000-0000-4000-8000-000000000001', 'v22-release-validation-20260912-user-a', 'release-a@example.invalid', 5),
      ('22092000-0000-4000-8000-000000000002', 'v22-release-validation-20260912-user-b', 'release-b@example.invalid', 5)
  $$,
  'synthetic users can be created inside the rollback transaction'
);

select lives_ok(
  $$
    insert into public.client_cases (
      id, user_id, site_url, normalized_domain, business_name,
      business_identity, operating_model, primary_service, target_market
    ) values
      (
        '22092001-0000-4000-8000-000000000001',
        '22092000-0000-4000-8000-000000000001',
        'https://release-a.example.invalid', 'release-a.example.invalid', 'Release Validation A',
        '{}', 'storefront', 'release validation', '{}'
      ),
      (
        '22092001-0000-4000-8000-000000000002',
        '22092000-0000-4000-8000-000000000002',
        'https://release-b.example.invalid', 'release-b.example.invalid', 'Release Validation B',
        '{}', 'service_area', 'release validation', '{}'
      )
  $$,
  'synthetic Case ownership can be created'
);

select lives_ok(
  $$
    insert into public.google_connections (
      id, user_id, google_subject, granted_scopes,
      access_token_ciphertext, access_token_iv, access_token_auth_tag,
      refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag,
      encryption_key_version, token_expires_at, status
    ) values
      (
        '22092002-0000-4000-8000-000000000001',
        '22092000-0000-4000-8000-000000000001',
        'v22-release-validation-20260912-google-a',
        array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly'],
        decode('01', 'hex'), decode('02', 'hex'), decode('03', 'hex'),
        decode('11', 'hex'), decode('12', 'hex'), decode('13', 'hex'),
        'release-validation', now() + interval '1 hour', 'active'
      ),
      (
        '22092002-0000-4000-8000-000000000002',
        '22092000-0000-4000-8000-000000000002',
        'v22-release-validation-20260912-google-b',
        array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly'],
        decode('04', 'hex'), decode('05', 'hex'), decode('06', 'hex'),
        decode('14', 'hex'), decode('15', 'hex'), decode('16', 'hex'),
        'release-validation', now() + interval '1 hour', 'active'
      )
  $$,
  'encrypted Google connection rows accept the current token contract'
);

select lives_ok(
  $$
    insert into public.case_source_bindings (
      id, case_id, connection_id, source_type,
      external_resource_id, external_resource_name,
      identity_match_status, health_status, confirmed_by_user_id, confirmed_at
    ) values
      (
        '22092003-0000-4000-8000-000000000001',
        '22092001-0000-4000-8000-000000000001',
        '22092002-0000-4000-8000-000000000001',
        'gsc', 'v22-release-validation-20260912-resource-a', 'Release resource A',
        'matched', 'healthy', '22092000-0000-4000-8000-000000000001', now()
      ),
      (
        '22092003-0000-4000-8000-000000000002',
        '22092001-0000-4000-8000-000000000002',
        '22092002-0000-4000-8000-000000000002',
        'gsc', 'v22-release-validation-20260912-resource-b', 'Release resource B',
        'matched', 'healthy', '22092000-0000-4000-8000-000000000002', now()
      )
  $$,
  'same-owner source bindings pass relationship validation'
);

select lives_ok(
  $$
    select public.request_v22_gsc_sync(
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092003-0000-4000-8000-000000000001',
      '2209200a-0000-4000-8000-000000000001'
    )
  $$,
  'a user-requested GSC sync enters the durable queue'
);

select lives_ok(
  $$
    insert into public.data_snapshots (
      id, case_id, source_type, schema_version, sync_trigger,
      health_status, normalized_payload, payload_checksum,
      provider_request_context
    ) values
      (
        '22092004-0000-4000-8000-000000000001',
        '22092001-0000-4000-8000-000000000001',
        'site', 'v22-release-validation-1', 'report_generation',
        'healthy', '{"marker":"v22-release-validation-20260912-a"}',
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{}'
      ),
      (
        '22092004-0000-4000-8000-000000000002',
        '22092001-0000-4000-8000-000000000002',
        'site', 'v22-release-validation-1', 'report_generation',
        'healthy', '{"marker":"v22-release-validation-20260912-b"}',
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '{}'
      )
  $$,
  'immutable source snapshots can be created for both Cases'
);

select lives_ok(
  $$
    insert into public.reports (
      id, report_id, user_id, page_url, gbp_url, status, access_type,
      report_v2_1
    ) values (
      '22092005-0000-4000-8000-000000000001',
      'v22-release-validation-20260912-legacy',
      '22092000-0000-4000-8000-000000000001',
      'https://release-a.example.invalid', '', 'paid_full', 'unlocked',
      '{"legacy":true}'
    )
  $$,
  'a historical report row remains valid without v2.2 fields'
);

select lives_ok(
  $$
    insert into public.reports (
      id, report_id, user_id, page_url, gbp_url, status, access_type,
      case_id, report_type, schema_version, version_number, report_v2_2,
      snapshot_ids, coverage_state, version_diff, generation_config,
      ruleset_version, copy_model_version
    ) values (
      '22092005-0000-4000-8000-000000000002',
      'v22-release-validation-20260912-prospect',
      '22092000-0000-4000-8000-000000000001',
      'https://release-a.example.invalid', '', 'paid_full', 'unlocked',
      '22092001-0000-4000-8000-000000000001', 'prospect',
      'v22-release-validation-1', 1,
      '{"marker":"v22-release-validation-20260912"}',
      array['22092004-0000-4000-8000-000000000001'::uuid],
      '{}', '{}', '{}', 'release-validation', 'release-validation'
    )
  $$,
  'the complete immutable v2.2 report shape is accepted'
);

select lives_ok(
  $$
    insert into public.analysis_jobs (
      id, case_id, report_id, job_type, status, current_stage,
      progress, attempt_count, idempotency_key, cost_counters,
      started_at, heartbeat_at, completed_at, state_revision,
      terminal_effects_revision, run_generation
    ) values (
      '22092006-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092005-0000-4000-8000-000000000002',
      'prospect_report', 'succeeded', 'completed', 100, 1,
      'v22-release-validation-20260912-job', '{}',
      now(), now(), now(), 1, 1, 1
    )
  $$,
  'a completed analysis job can reference its same-Case report'
);

select lives_ok(
  $$
    insert into public.orders (
      id, user_id, payment_id, amount, currency, credits_purchased,
      status, paid_at, case_id, purchase_kind
    ) values (
      '22092007-0000-4000-8000-000000000001',
      '22092000-0000-4000-8000-000000000001',
      'v22-release-validation-20260912-payment',
      1900, 'USD', 0, 'paid', now(),
      '22092001-0000-4000-8000-000000000001', 'case_prospect_report'
    )
  $$,
  'a paid Case-level order accepts the current payment contract'
);

select lives_ok(
  $$
    insert into public.case_report_entitlements (
      id, user_id, case_id, order_id, report_type, status
    ) values (
      '22092008-0000-4000-8000-000000000001',
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092007-0000-4000-8000-000000000001',
      'prospect', 'available'
    )
  $$,
  'a Case report entitlement can be attached to the paid order'
);

select lives_ok(
  $$
    insert into public.report_shares (
      id, user_id, case_id, report_id, token_hash, expires_at
    ) values (
      '22092009-0000-4000-8000-000000000001',
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092005-0000-4000-8000-000000000002',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      now() + interval '1 day'
    )
  $$,
  'a share can target the same user, Case, and v2.2 report'
);

select is(
  (
    select count(*)
    from public.reports
    where report_id = 'v22-release-validation-20260912-legacy'
      and report_v2_1 = '{"legacy":true}'::jsonb
      and case_id is null
      and report_v2_2 is null
  ),
  1::bigint,
  'historical report data is unchanged while v2.2 rows coexist'
);

select throws_ok(
  $$
    insert into public.case_source_bindings (
      case_id, connection_id, source_type, external_resource_id,
      external_resource_name, identity_match_status, health_status
    ) values (
      '22092001-0000-4000-8000-000000000001',
      '22092002-0000-4000-8000-000000000002',
      'ga4', 'v22-release-validation-cross-owner', 'Cross owner',
      'matched', 'healthy'
    )
  $$,
  '23514',
  'binding connection must belong to the case owner',
  'cross-user source bindings are rejected'
);

select throws_ok(
  $$
    insert into public.case_source_bindings (
      case_id, connection_id, source_type, external_resource_id,
      external_resource_name, identity_match_status, health_status
    ) values (
      '22092001-0000-4000-8000-000000000001',
      '22092002-0000-4000-8000-000000000001',
      'gsc', 'v22-release-validation-duplicate-source', 'Duplicate source',
      'matched', 'healthy'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "uq_case_source_bindings_active_source"',
  'only one active binding per Case and source is accepted'
);

select throws_ok(
  $$
    insert into public.reports (
      report_id, user_id, page_url, gbp_url, status, access_type,
      case_id, report_type, schema_version, version_number, report_v2_2,
      snapshot_ids, coverage_state, version_diff, generation_config,
      ruleset_version, copy_model_version
    ) values (
      'v22-release-validation-cross-user-report',
      '22092000-0000-4000-8000-000000000002',
      'https://release-a.example.invalid', '', 'paid_full', 'unlocked',
      '22092001-0000-4000-8000-000000000001', 'prospect',
      'v22-release-validation-1', 2, '{}',
      array['22092004-0000-4000-8000-000000000001'::uuid],
      '{}', '{}', '{}', 'release-validation', 'release-validation'
    )
  $$,
  '23514',
  'report case must belong to the report user',
  'cross-user report ownership is rejected'
);

select throws_ok(
  $$
    insert into public.reports (
      report_id, user_id, page_url, gbp_url, status, access_type,
      case_id, report_type, schema_version, version_number, report_v2_2,
      snapshot_ids, coverage_state, version_diff, generation_config,
      ruleset_version, copy_model_version
    ) values (
      'v22-release-validation-cross-case-snapshot',
      '22092000-0000-4000-8000-000000000001',
      'https://release-a.example.invalid', '', 'paid_full', 'unlocked',
      '22092001-0000-4000-8000-000000000001', 'prospect',
      'v22-release-validation-1', 2, '{}',
      array['22092004-0000-4000-8000-000000000002'::uuid],
      '{}', '{}', '{}', 'release-validation', 'release-validation'
    )
  $$,
  '23514',
  'all report snapshots must belong to the report case',
  'cross-Case snapshot lineage is rejected'
);

select throws_ok(
  $$
    insert into public.analysis_jobs (
      case_id, report_id, job_type, status, current_stage,
      progress, attempt_count, idempotency_key
    ) values (
      '22092001-0000-4000-8000-000000000002',
      '22092005-0000-4000-8000-000000000002',
      'prospect_report', 'queued', 'queued', 0, 0,
      'v22-release-validation-cross-case-job'
    )
  $$,
  '23514',
  'analysis job report must belong to the same case',
  'cross-Case analysis job report links are rejected'
);

select is(
  (
    select applied
    from public.apply_analysis_job_event(
      '22092006-0000-4000-8000-000000000001'::uuid,
      '22092001-0000-4000-8000-000000000001'::uuid,
      2::bigint, 'running'::text, 'retrying'::text, 50::smallint, 2::integer,
      null::text, null::text, '{}'::jsonb, now(), null::timestamptz,
      1::integer, now() + interval '20 minutes'
    )
  ),
  false,
  'a terminal analysis job cannot transition back to running'
);

select throws_ok(
  $$
    update public.data_snapshots
    set normalized_payload = '{"changed":true}'
    where id = '22092004-0000-4000-8000-000000000001'
  $$,
  '23514',
  'data snapshots are immutable',
  'completed source evidence cannot be changed'
);

select throws_ok(
  $$
    update public.reports
    set report_v2_2 = '{"changed":true}'
    where id = '22092005-0000-4000-8000-000000000002'
  $$,
  '23514',
  'completed v2.2 report payloads are immutable',
  'completed report evidence cannot be changed'
);

select throws_ok(
  $$
    insert into public.data_snapshots (
      case_id, source_type, schema_version, fetched_at, expires_at,
      sync_trigger, health_status, normalized_payload, raw_payload,
      payload_checksum, provider_request_context, retention_policy
    ) values (
      '22092001-0000-4000-8000-000000000001',
      'gbp', 'v22-release-validation-1', now(), now() + interval '31 days',
      'report_generation', 'healthy', '{}', '{}',
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      '{}', 'gbp_content_30d'
    )
  $$,
  '23514',
  'new row for relation "data_snapshots" violates check constraint "data_snapshots_retention_check"',
  'GBP raw content cannot exceed the 30-day retention boundary'
);

select * from finish();

rollback;
