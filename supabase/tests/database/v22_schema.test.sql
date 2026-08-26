begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public', 'client_cases', 'v2.2 client_cases exists');
select has_table('public', 'google_connections', 'v2.2 google_connections exists');
select has_table('public', 'case_source_bindings', 'v2.2 case_source_bindings exists');
select has_table('public', 'data_snapshots', 'v2.2 data_snapshots exists');
select has_table('public', 'analysis_jobs', 'v2.2 analysis_jobs exists');

select has_column('public', 'reports', 'case_id', 'reports has a Case owner');
select has_column('public', 'reports', 'report_v2_2', 'reports has the v2.2 contract payload');
select has_column('public', 'reports', 'snapshot_ids', 'reports records immutable input snapshots');

select has_pk('public', 'client_cases', 'client_cases has a primary key');
select has_pk('public', 'google_connections', 'google_connections has a primary key');
select has_pk('public', 'case_source_bindings', 'case_source_bindings has a primary key');
select has_pk('public', 'data_snapshots', 'data_snapshots has a primary key');
select has_pk('public', 'analysis_jobs', 'analysis_jobs has a primary key');

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
