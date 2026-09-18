begin;

set local role postgres;
set local lock_timeout = '2s';
set local statement_timeout = '60s';

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(47);

select is(
  (
    select string_agg(version, ',' order by version)
    from supabase_migrations.schema_migrations
  ),
  '20260706000000,20260707000000,20260812000000,20260826000000,20260827000000,20260827010000,20260903000000,20260904000000,20260904100000,20260905000000,20260905100000,20260905200000,20260906000000,20260907000000,20260907100000,20260908000000,20260909170000,20260910000000,20260910100000,20260912100000,20260913100000,20260913110000,20260914100000,20260914110000,20260914120000,20260914130000,20260914140000,20260914150000,20260914160000,20260917090000,20260917100000,20260917110000,20260917120000,20260917130000,20260917140000,20260918100000',
  'the database has exactly the approved 36 migrations in order'
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
        'report_shares', 'reports', 'users', 'verified_analysis_inputs',
        'verified_credit_refund_reviews'
      )
  ),
  'analysis_attempt_charges,analysis_jobs,audit_credit_ledger,case_report_entitlements,case_source_bindings,client_cases,data_snapshots,google_connection_events,google_connections,google_oauth_sessions,google_sync_jobs,google_token_broker_requests,identity_deletion_receipts,job_cost_summaries,orders,report_shares,reports,users,verified_analysis_inputs,verified_credit_refund_reviews',
  'all 20 application tables exist'
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
        'report_shares', 'reports', 'users', 'verified_analysis_inputs',
        'verified_credit_refund_reviews'
      )
      and c.relrowsecurity
  ),
  20::bigint,
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
      'report_shares', 'reports', 'users', 'verified_analysis_inputs',
      'verified_credit_refund_reviews'
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
      'report_shares', 'reports', 'users', 'verified_analysis_inputs',
      'verified_credit_refund_reviews'
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
    insert into public.users (id, clerk_user_id, email, audit_credits, credit_balance)
    values
      ('22092000-0000-4000-8000-000000000001', 'v22-release-validation-20260912-user-a', 'release-a@example.invalid', 5, 5),
      ('22092000-0000-4000-8000-000000000002', 'v22-release-validation-20260912-user-b', 'release-b@example.invalid', 5, 5)
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

select ok(
  (
    select bool_and(
      to_regprocedure(signature) is not null
      and has_function_privilege('service_role', signature, 'EXECUTE')
      and not has_function_privilege('anon', signature, 'EXECUTE')
      and not has_function_privilege('authenticated', signature, 'EXECUTE')
    )
    from unnest(array[
      'public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)',
      'public.resolve_v22_verified_analysis_input(uuid,uuid,integer)',
      'public.persist_v22_verified_result(uuid,uuid,jsonb,integer)',
      'public.expire_v22_stale_verified_jobs(timestamp with time zone,integer)',
      'public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)',
      'public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)',
      'public.record_v22_verified_credit_refund_review(text,uuid,text,text,uuid,integer,text,text,text,text,integer,text,boolean,text)',
      'public.claim_v22_verified_credit_checkout(uuid,uuid,text)',
      'public.attach_v22_verified_credit_checkout(uuid,uuid,uuid,uuid,text,text,text)'
    ]) rpc(signature)
  ),
  'Verified generation, payment, refund-review and checkout RPCs are service-only'
);

select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'client_cases' and column_name = 'latest_verified_report_id')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'verified_analysis_inputs' and column_name = 'public_gbp_snapshot_id' and is_nullable = 'NO')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'provider_product_id')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'checkout_initialization_token')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'checkout_initialization_started_at')
  and to_regclass('public.verified_credit_refund_reviews') is not null,
  'Verified lineage, frozen GBP, purchase binding and refund review schema are present'
);

select lives_ok(
  $$
    update public.client_cases
    set business_identity = jsonb_build_object(
      'public_gbp_url', 'https://maps.searchtrust_release_validation.example.invalid/place'
    )
    where id = '22092001-0000-4000-8000-000000000001';

    insert into public.case_source_bindings (
      id, case_id, connection_id, source_type, external_resource_id,
      external_resource_name, identity_match_status, health_status,
      confirmed_by_user_id, confirmed_at
    ) values (
      '22092003-0000-4000-8000-000000000003',
      '22092001-0000-4000-8000-000000000001',
      '22092002-0000-4000-8000-000000000001',
      'ga4', 'searchtrust_release_validation_ga4', 'Synthetic GA4',
      'matched', 'healthy', '22092000-0000-4000-8000-000000000001', now()
    );

    insert into public.data_snapshots (
      id, case_id, binding_id, source_type, schema_version, fetched_at,
      expires_at, coverage_start, coverage_end, sync_trigger, health_status,
      normalized_payload, payload_checksum, provider_request_context
    ) values
      (
        '22092004-0000-4000-8000-000000000010',
        '22092001-0000-4000-8000-000000000001',
        '22092003-0000-4000-8000-000000000001', 'gsc', 'gsc_sync_v1',
        now() - interval '2 minutes', now() + interval '7 days', current_date - 30, current_date - 1,
        'report_generation', 'healthy', '{"schema_version":"gsc_sync_v1"}',
        'sha256:1010101010101010101010101010101010101010101010101010101010101010',
        '{"external_resource_id":"v22-release-validation-20260912-resource-a"}'
      ),
      (
        '22092004-0000-4000-8000-000000000011',
        '22092001-0000-4000-8000-000000000001',
        '22092003-0000-4000-8000-000000000003', 'ga4', 'ga4_sync_v1',
        now() - interval '2 minutes', now() + interval '7 days', current_date - 30, current_date - 1,
        'report_generation', 'healthy', '{"schema_version":"ga4_sync_v1"}',
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        '{"external_resource_id":"searchtrust_release_validation_ga4"}'
      );

    insert into public.data_snapshots (
      id, case_id, source_type, schema_version, fetched_at, expires_at,
      sync_trigger, health_status, normalized_payload, payload_checksum,
      provider_request_context
    ) values
      (
        '22092004-0000-4000-8000-000000000012',
        '22092001-0000-4000-8000-000000000001', 'serp', 'serp_market_snapshot_v1',
        now() - interval '3 minutes', now() + interval '7 days', 'report_generation', 'healthy',
        '{"schema_version":"serp_market_snapshot_v1"}',
        'sha256:1212121212121212121212121212121212121212121212121212121212121212', '{}'
      ),
      (
        '22092004-0000-4000-8000-000000000013',
        '22092001-0000-4000-8000-000000000001', 'competitor', 'competitor_collection_snapshot_v1',
        now() - interval '3 minutes', now() + interval '7 days', 'report_generation', 'healthy',
        '{"schema_version":"competitor_collection_snapshot_v1"}',
        'sha256:1313131313131313131313131313131313131313131313131313131313131313', '{}'
      );

    insert into public.data_snapshots (
      id, case_id, source_type, schema_version, fetched_at, expires_at,
      sync_trigger, health_status, normalized_payload, payload_checksum,
      provider_request_context
    ) values (
      '22092004-0000-4000-8000-000000000014',
      '22092001-0000-4000-8000-000000000001', 'gbp', 'customer_public_gbp_snapshot_v1',
      '2026-09-14T10:02:00Z', '2099-09-14T10:02:00Z', 'report_generation', 'healthy',
      jsonb_build_object(
        'schema_version', 'customer_public_gbp_snapshot_v1',
        'health_status', 'healthy', 'identity_match_status', 'matched',
        'subject_reference_checksum', 'sha256:1414141414141414141414141414141414141414141414141414141414141414',
        'completed_at', '2026-09-14T10:02:00Z', 'expires_at', '2099-09-14T10:02:00Z',
        'request_target', jsonb_build_object(
          'public_gbp_url', 'https://maps.searchtrust_release_validation.example.invalid/place',
          'entity_keys', jsonb_build_array(jsonb_build_object('kind', 'cid', 'value', 'searchtrust_release_validation'))
        )
      ),
      'sha256:1414141414141414141414141414141414141414141414141414141414141414',
      jsonb_build_object(
        'subject_reference_checksum', 'sha256:1414141414141414141414141414141414141414141414141414141414141414',
        'customer_public_gbp_reference', jsonb_build_object(
          'case_id', '22092001-0000-4000-8000-000000000001',
          'site_url', 'https://release-a.example.invalid',
          'public_gbp_url', 'https://maps.searchtrust_release_validation.example.invalid/place',
          'entity_keys', jsonb_build_array(jsonb_build_object('kind', 'cid', 'value', 'searchtrust_release_validation')),
          'confirmation_source', 'user', 'confirmed_at', '2026-09-14T10:00:00Z'
        )
      )
    );

    update public.google_connections
    set status = 'active'
    where id = '22092002-0000-4000-8000-000000000001';
    update public.case_source_bindings
    set identity_match_status = 'matched', health_status = 'healthy',
        confirmed_by_user_id = '22092000-0000-4000-8000-000000000001',
        confirmed_at = coalesce(confirmed_at, now())
    where case_id = '22092001-0000-4000-8000-000000000001'
      and source_type in ('gsc', 'ga4');

    insert into public.reports (
      id, report_id, user_id, page_url, gbp_url, status, access_type,
      case_id, report_type, schema_version, version_number, report_v2_2,
      snapshot_ids, coverage_state, version_diff, generation_config,
      ruleset_version, copy_model_version
    ) values (
      '22092005-0000-4000-8000-000000000010',
      '22092005-0000-4000-8000-000000000010',
      '22092000-0000-4000-8000-000000000001',
      'https://release-a.example.invalid',
      'https://maps.searchtrust_release_validation.example.invalid/place',
      'paid_full', 'unlocked', '22092001-0000-4000-8000-000000000001',
      'prospect', '2.2.1', 1,
      jsonb_build_object(
        'identity', jsonb_build_object(
          'case_id', '22092001-0000-4000-8000-000000000001',
          'business', jsonb_build_object(
            'site_url', 'https://release-a.example.invalid',
            'public_gbp_url', 'https://maps.searchtrust_release_validation.example.invalid/place'
          )
        ),
        'report_version', jsonb_build_object(
          'report_id', '22092005-0000-4000-8000-000000000010',
          'report_type', 'prospect', 'schema_version', '2.2.1',
          'parent_report_id', null, 'version_number', 1
        ),
        'evidence_index', jsonb_build_array(jsonb_build_object(
          'source_type', 'gbp', 'health_status', 'healthy',
          'snapshot_id', '22092004-0000-4000-8000-000000000014',
          'source_locator', jsonb_build_object('url', 'https://maps.searchtrust_release_validation.example.invalid/place')
        )),
        'data_coverage', jsonb_build_object('sources', jsonb_build_array(jsonb_build_object(
          'source_type', 'gbp', 'health_status', 'healthy', 'identity_match_status', 'matched',
          'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000014')
        ))),
        'client_delivery', jsonb_build_object(
          'decision', '{}'::jsonb,
          'evidence_cards', jsonb_build_array('{}'::jsonb),
          'priority_actions', jsonb_build_array('{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
          'roadmap', jsonb_build_array('{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
          'coverage_appendix', '{}'::jsonb,
          'next_review_date', '2026-12-13'
        )
      ),
      array[
        '22092004-0000-4000-8000-000000000001'::uuid,
        '22092004-0000-4000-8000-000000000012'::uuid,
        '22092004-0000-4000-8000-000000000013'::uuid,
        '22092004-0000-4000-8000-000000000014'::uuid
      ],
      '{}', '{}', '{}', 'searchtrust_release_validation_rules', 'searchtrust_release_validation_copy'
    );
    update public.client_cases
    set latest_report_id = '22092005-0000-4000-8000-000000000010'
    where id = '22092001-0000-4000-8000-000000000001';
  $$,
  'Verified acceptance source graph and original Prospect lineage are valid'
);

select lives_ok(
  $$
    create temp table searchtrust_release_validation_checkout as
    select * from public.claim_v22_credit_checkout(
      '22092000-0000-4000-8000-000000000001',
      'searchtrust_release_validation_product'
    )
  $$,
  'a $19 one-credit checkout is claimed atomically'
);

select lives_ok(
  $$
    select * from public.attach_v22_credit_checkout(
      '22092000-0000-4000-8000-000000000001',
      (select order_id from searchtrust_release_validation_checkout),
      (select initialization_token from searchtrust_release_validation_checkout),
      'searchtrust_release_validation_product',
      'searchtrust_release_validation_checkout',
      'https://checkout.dodopayments.com/session/searchtrust_release_validation'
    )
  $$,
  'the synthetic provider checkout is attached to the exact claim'
);

select lives_ok(
  $$
    select * from public.fulfill_v22_credit_payment(
      (select order_id from searchtrust_release_validation_checkout),
      'searchtrust_release_validation_payment',
      'v22-release-validation-20260912-user-a',
      1900, 'USD',
      'searchtrust_release_validation_checkout',
      'searchtrust_release_validation_product'
    )
  $$,
  'successful purchase adds exactly one account credit'
);

select is(
  (
    select idempotent
    from public.fulfill_v22_credit_payment(
      (select order_id from searchtrust_release_validation_checkout),
      'searchtrust_release_validation_payment',
      'v22-release-validation-20260912-user-a',
      1900, 'USD',
      'searchtrust_release_validation_checkout',
      'searchtrust_release_validation_product'
    )
  ),
  true,
  'duplicate payment fulfillment is idempotent'
);

select is(
  (
    select u.credit_balance::text || ':' || count(j.id)::text
    from public.users u
    left join public.analysis_jobs j
      on j.case_id = '22092001-0000-4000-8000-000000000001'
      and j.job_type = 'verified_report'
    where u.id = '22092000-0000-4000-8000-000000000001'
    group by u.credit_balance
  ),
  '6:0',
  'payment leaves one new credit and does not auto-generate'
);

select lives_ok(
  $$
    select * from public.start_v22_verified_analysis(
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092006-0000-4000-8000-000000000010',
      'searchtrust_release_validation_success',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '22092005-0000-4000-8000-000000000010', null
    )
  $$,
  'a successful Verified attempt freezes inputs and debits one credit'
);

select is(
  (
    select idempotent from public.start_v22_verified_analysis(
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092006-0000-4000-8000-000000000010',
      'searchtrust_release_validation_success',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '22092005-0000-4000-8000-000000000010', null
    )
  ),
  true,
  'Verified start replay does not debit twice'
);

select lives_ok(
  $$
    select * from public.persist_v22_verified_result(
      '22092006-0000-4000-8000-000000000010',
      '22092001-0000-4000-8000-000000000001',
      jsonb_build_object(
        'identity', jsonb_build_object(
          'case_id', '22092001-0000-4000-8000-000000000001',
          'business', jsonb_build_object(
            'site_url', 'https://release-a.example.invalid',
            'public_gbp_url', 'https://maps.searchtrust_release_validation.example.invalid/place'
          )
        ),
        'report_version', jsonb_build_object(
          'report_id', '22092006-0000-4000-8000-000000000010',
          'report_type', 'verified_execution', 'schema_version', '2.2.1',
          'parent_report_id', '22092005-0000-4000-8000-000000000010',
          'version_number', 2, 'generated_at', '2026-09-14T11:00:00Z',
          'ruleset_version', 'searchtrust_release_validation_rules',
          'copy_model_version', 'searchtrust_release_validation_copy'
        ),
        'first_party_performance', jsonb_build_object(
          'gsc', jsonb_build_object('snapshot_id', '22092004-0000-4000-8000-000000000010'),
          'ga4', jsonb_build_object('snapshot_id', '22092004-0000-4000-8000-000000000011')
        ),
        'evidence_index', '[]'::jsonb,
        'data_coverage', jsonb_build_object('sources', jsonb_build_array(
          jsonb_build_object('source_type', 'site', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000001')),
          jsonb_build_object('source_type', 'serp', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000012')),
          jsonb_build_object('source_type', 'competitor', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000013')),
          jsonb_build_object('source_type', 'gbp', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000014')),
          jsonb_build_object('source_type', 'gsc', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000010')),
          jsonb_build_object('source_type', 'ga4', 'snapshot_ids', jsonb_build_array('22092004-0000-4000-8000-000000000011'))
        )),
        'version_diff', jsonb_build_object(
          'kind', 'upgrade', 'parent_report_id', '22092005-0000-4000-8000-000000000010',
          'entries', jsonb_build_array(jsonb_build_object('change_type', 'confirmed'))
        ),
        'client_delivery', jsonb_build_object(
          'decision', '{}'::jsonb,
          'evidence_cards', jsonb_build_array('{}'::jsonb),
          'priority_actions', jsonb_build_array('{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
          'roadmap', jsonb_build_array('{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
          'coverage_appendix', '{}'::jsonb,
          'next_review_date', '2026-12-13'
        )
      ),
      1
    )
  $$,
  'successful Verified generation persists and settles atomically'
);

select is(
  (
    select j.status || ':' || c.state || ':' || u.credit_balance::text
    from public.analysis_jobs j
    join public.workflow_charges c on c.analysis_job_id = j.id
    join public.users u on u.id = c.user_id
    where j.id = '22092006-0000-4000-8000-000000000010'
  ),
  'succeeded:consumed:5',
  'successful generation consumes its one debit and retains the resulting balance'
);

select lives_ok(
  $$
    select * from public.start_v22_verified_analysis(
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092006-0000-4000-8000-000000000011',
      'searchtrust_release_validation_failure',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '22092005-0000-4000-8000-000000000010', null
    )
  $$,
  'a controlled failing Verified attempt debits a new credit'
);

select lives_ok(
  $$
    select * from public.apply_analysis_job_event(
      '22092006-0000-4000-8000-000000000011',
      '22092001-0000-4000-8000-000000000001',
      1::bigint, 'failed', 'failed', 30::smallint, 1,
      'SEARCHTRUST_RELEASE_VALIDATION_FAILURE',
      'Synthetic controlled failure.', '{}'::jsonb, now(), now(), 1, null::timestamptz
    )
  $$,
  'terminal technical failure compensates the reserved credit'
);

select is(
  (
    select c.state || ':' || u.credit_balance::text || ':' || count(l.id)::text
    from public.workflow_charges c
    join public.users u on u.id = c.user_id
    join public.credit_ledger l on l.workflow_charge_id = c.id
    where c.analysis_job_id = '22092006-0000-4000-8000-000000000011'
    group by c.state, u.credit_balance
  ),
  'compensated:5:2',
  'technical failure restores exactly one credit with debit and refund ledger entries'
);

select is(
  (
    select applied::text || ':' || terminal_effects_applied::text
    from public.apply_analysis_job_event(
      '22092006-0000-4000-8000-000000000011',
      '22092001-0000-4000-8000-000000000001',
      1::bigint, 'failed', 'failed', 30::smallint, 1,
      'SEARCHTRUST_RELEASE_VALIDATION_FAILURE',
      'Synthetic controlled failure.', '{}'::jsonb, now(), now(), 1, null::timestamptz
    )
  ),
  'false:false',
  'terminal failure replay cannot refund a second time'
);

select lives_ok(
  $$
    select * from public.start_v22_verified_analysis(
      '22092000-0000-4000-8000-000000000001',
      '22092001-0000-4000-8000-000000000001',
      '22092006-0000-4000-8000-000000000012',
      'searchtrust_release_validation_retry',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '22092005-0000-4000-8000-000000000010',
      '22092006-0000-4000-8000-000000000011'
    )
  $$,
  'retry creates a distinct job linked to the failed attempt and charges again'
);

select is(
  (
    select j.previous_job_id::text || ':' || c.state || ':' || u.credit_balance::text
    from public.analysis_jobs j
    join public.workflow_charges c on c.analysis_job_id = j.id
    join public.users u on u.id = c.user_id
    where j.id = '22092006-0000-4000-8000-000000000012'
  ),
  '22092006-0000-4000-8000-000000000011:reserved:4',
  'retry lineage and second one-credit reservation are exact'
);

select is(
  (
    select r.parent_report_id::text || ':' || cc.latest_report_id::text || ':' || cc.latest_verified_report_id::text
    from public.reports r
    join public.client_cases cc on cc.id = r.case_id
    where r.id = '22092006-0000-4000-8000-000000000010'
  ),
  '22092005-0000-4000-8000-000000000010:22092006-0000-4000-8000-000000000010:22092006-0000-4000-8000-000000000010',
  'Verified report lineage always points to the original Prospect'
);

select * from finish();

rollback;
