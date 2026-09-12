begin;

set local role postgres;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(1);

select is(
  (
    (select count(*) from public.users where clerk_user_id like 'v22-release-validation-%')
    + (select count(*) from public.client_cases where normalized_domain like 'release-%.example.invalid')
    + (select count(*) from public.google_connections where google_subject like 'v22-release-validation-%')
    + (select count(*) from public.case_source_bindings where external_resource_id like 'v22-release-validation-%')
    + (select count(*) from public.google_sync_jobs where request_key = '2209200a-0000-4000-8000-000000000001')
    + (select count(*) from public.data_snapshots where schema_version = 'v22-release-validation-1')
    + (select count(*) from public.reports where report_id like 'v22-release-validation-%')
    + (select count(*) from public.analysis_jobs where idempotency_key like 'v22-release-validation-%')
    + (select count(*) from public.orders where payment_id like 'v22-release-validation-%')
  ),
  0::bigint,
  'release validation left no synthetic data behind'
);

select * from finish();

rollback;
