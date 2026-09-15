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
    + (select count(*) from public.case_source_bindings where external_resource_id ~ 'searchtrust_release_validation_')
    + (select count(*) from public.data_snapshots where normalized_payload::text ~ 'searchtrust_release_validation_'
        or provider_request_context::text ~ 'searchtrust_release_validation_')
    + (select count(*) from public.reports where ruleset_version ~ 'searchtrust_release_validation_'
        or copy_model_version ~ 'searchtrust_release_validation_')
    + (select count(*) from public.analysis_jobs where idempotency_key ~ 'searchtrust_release_validation_'
        or id in (
          '22092006-0000-4000-8000-000000000010',
          '22092006-0000-4000-8000-000000000011',
          '22092006-0000-4000-8000-000000000012'
        ))
    + (select count(*) from public.analysis_attempt_charges where job_id in (
        '22092006-0000-4000-8000-000000000010',
        '22092006-0000-4000-8000-000000000011',
        '22092006-0000-4000-8000-000000000012'
      ))
    + (select count(*) from public.audit_credit_ledger where job_id in (
        '22092006-0000-4000-8000-000000000010',
        '22092006-0000-4000-8000-000000000011',
        '22092006-0000-4000-8000-000000000012'
      ) or order_id in (
        select id from public.orders where provider_product_id ~ 'searchtrust_release_validation_'
      ))
    + (select count(*) from public.verified_analysis_inputs where job_id in (
        '22092006-0000-4000-8000-000000000010',
        '22092006-0000-4000-8000-000000000011',
        '22092006-0000-4000-8000-000000000012'
      ))
    + (select count(*) from public.orders where payment_id ~ 'searchtrust_release_validation_'
        or provider_product_id ~ 'searchtrust_release_validation_'
        or checkout_session_id ~ 'searchtrust_release_validation_')
    + (select count(*) from public.verified_credit_refund_reviews where payment_id ~ 'searchtrust_release_validation_'
        or provider_refund_id ~ 'searchtrust_release_validation_')
  ),
  0::bigint,
  'release validation left no synthetic data behind'
);

select * from finish();

rollback;
