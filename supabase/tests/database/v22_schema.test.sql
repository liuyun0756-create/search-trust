begin;

create extension if not exists pgtap with schema extensions;

select plan(55);

select has_table('public', 'client_cases', 'v2.2 client_cases exists');
select has_table('public', 'google_connections', 'v2.2 google_connections exists');
select has_table('public', 'case_source_bindings', 'v2.2 case_source_bindings exists');
select has_table('public', 'data_snapshots', 'v2.2 data_snapshots exists');
select has_table('public', 'analysis_jobs', 'v2.2 analysis_jobs exists');
select has_table('public', 'report_shares', 'v2.2 report_shares exists');
select has_table('public', 'google_oauth_sessions', 'v2.2 Google OAuth sessions exist');
select has_table('public', 'google_connection_events', 'v2.2 Google connection events exist');
select has_table('public', 'google_token_broker_requests', 'v2.2 Google broker replay claims exist');

select has_column('public', 'reports', 'case_id', 'reports has a Case owner');
select has_column('public', 'reports', 'report_v2_2', 'reports has the v2.2 contract payload');
select has_column('public', 'reports', 'snapshot_ids', 'reports records immutable input snapshots');
select has_column('public', 'client_cases', 'location_key', 'Cases have a generated Location identity key');
select has_column('public', 'analysis_jobs', 'state_revision', 'analysis jobs track backend state revisions');
select has_column(
  'public', 'analysis_jobs', 'terminal_effects_revision',
  'analysis jobs track the terminal revision claimed for side effects'
);
select has_column('public', 'google_connections', 'refresh_lease_id', 'Google connections have refresh leases');
select has_column(
  'public', 'google_connections', 'refresh_lease_expires_at',
  'Google refresh leases have explicit expiry'
);

select has_pk('public', 'client_cases', 'client_cases has a primary key');
select has_pk('public', 'google_connections', 'google_connections has a primary key');
select has_pk('public', 'case_source_bindings', 'case_source_bindings has a primary key');
select has_pk('public', 'data_snapshots', 'data_snapshots has a primary key');
select has_pk('public', 'analysis_jobs', 'analysis_jobs has a primary key');
select has_pk('public', 'google_oauth_sessions', 'google_oauth_sessions has a primary key');
select has_pk('public', 'google_connection_events', 'google_connection_events has a primary key');
select has_pk('public', 'google_token_broker_requests', 'google_token_broker_requests has a primary key');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.client_cases'::regclass),
  'client_cases has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_connections'::regclass),
  'google_connections has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.case_source_bindings'::regclass),
  'case_source_bindings has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.data_snapshots'::regclass),
  'data_snapshots has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.analysis_jobs'::regclass),
  'analysis_jobs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.report_shares'::regclass),
  'report_shares has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_oauth_sessions'::regclass),
  'google_oauth_sessions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_connection_events'::regclass),
  'google_connection_events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_token_broker_requests'::regclass),
  'google_token_broker_requests has RLS enabled'
);

select ok(
  has_table_privilege('service_role', 'public.client_cases', 'SELECT'),
  'service_role can read client_cases'
);
select ok(
  not has_table_privilege('anon', 'public.client_cases', 'SELECT'),
  'anon cannot read client_cases'
);
select ok(
  not has_table_privilege('authenticated', 'public.client_cases', 'SELECT'),
  'authenticated cannot read client_cases'
);
select ok(
  not has_table_privilege('anon', 'public.report_shares', 'SELECT'),
  'anon cannot read report_shares directly'
);
select ok(
  not has_table_privilege('anon', 'public.google_oauth_sessions', 'SELECT'),
  'anon cannot read Google OAuth sessions'
);
select ok(
  not has_table_privilege('authenticated', 'public.google_connection_events', 'SELECT'),
  'authenticated cannot read Google connection events'
);
select ok(
  not has_table_privilege('anon', 'public.google_token_broker_requests', 'SELECT'),
  'anon cannot read Google broker replay claims'
);

select has_trigger(
  'public', 'data_snapshots', 'enforce_data_snapshot_immutability',
  'data snapshots have an immutability trigger'
);
select has_trigger(
  'public', 'reports', 'enforce_report_v2_2_immutability',
  'completed v2.2 reports have an immutability trigger'
);
select has_trigger(
  'public', 'users', 'delete_user_v22_case_graphs',
  'user deletion removes Case graphs before connection cascades'
);
select has_trigger(
  'public', 'client_cases', 'enforce_client_case_site_immutability',
  'Case website identity has an immutability trigger'
);
select has_trigger(
  'public', 'google_oauth_sessions', 'validate_google_oauth_session_ownership',
  'Google OAuth sessions enforce Case ownership'
);

select has_function(
  'public', 'v22_case_location_key', array['jsonb'],
  'Case Location identity function exists'
);
select has_function(
  'public', 'apply_analysis_job_event',
  array[
    'uuid', 'uuid', 'bigint', 'text', 'text', 'smallint', 'integer',
    'text', 'text', 'jsonb', 'timestamp with time zone', 'timestamp with time zone'
  ],
  'analysis job callback function exists'
);
select has_function(
  'public', 'rotate_v22_report_share',
  array['uuid', 'uuid', 'uuid', 'text', 'timestamp with time zone'],
  'atomic report share rotation function exists'
);
select has_function(
  'public', 'cleanup_expired_google_oauth_sessions', array['timestamp with time zone'],
  'expired Google OAuth session cleanup exists'
);
select has_function(
  'public', 'cleanup_expired_google_token_broker_requests', array['timestamp with time zone'],
  'expired Google broker replay claim cleanup exists'
);
select has_index(
  'public', 'client_cases', 'uq_client_cases_user_domain_location',
  'Case user/domain/Location uniqueness is database-enforced'
);
select ok(
  (
    select attgenerated = 's'
    from pg_attribute
    where attrelid = 'public.client_cases'::regclass
      and attname = 'location_key'
  ),
  'Case Location key is a stored generated column'
);

select ok(
  (
    select condeferrable
    from pg_constraint
    where conrelid = 'public.data_snapshots'::regclass
      and confrelid = 'public.case_source_bindings'::regclass
      and contype = 'f'
  ),
  'snapshot-to-binding audit reference is deferrable'
);
select ok(
  (
    select condeferrable
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and confrelid = 'public.reports'::regclass
      and contype = 'f'
  ),
  'report version lineage reference is deferrable'
);

select * from finish();
rollback;
