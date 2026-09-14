begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(105);

select has_column('public','audit_credit_ledger','order_id','Payment ledger retains order identity');
select col_is_fk('public','audit_credit_ledger','order_id','Payment ledger order has FK');
select col_is_null('public','audit_credit_ledger','order_id','Attempt ledger does not require an order');
select has_index('public','orders','uq_orders_pending_case_verified_credit_checkout','Only one pending Verified checkout per Case');
select has_column('public','orders','provider_product_id','Verified orders retain the server-selected provider product');
select has_index('public','audit_credit_ledger','uq_audit_credit_ledger_order_kind','Payment ledger deduplicates order and kind');
select ok((select pg_get_constraintdef(oid) like '%case_verified_credit%' from pg_constraint where conrelid='public.orders'::regclass and conname='orders_purchase_kind_check'),'Verified purchase kind is accepted');
select ok((select pg_get_constraintdef(oid) like '%1900%' and pg_get_constraintdef(oid) like '%USD%' from pg_constraint where conrelid='public.orders'::regclass and conname='orders_purchase_shape_check'),'Verified purchase requires $19 USD');
select ok((select pg_get_constraintdef(oid) like '%case_verified_credit%' from pg_constraint where conrelid='public.orders'::regclass and conname='orders_payment_reference_check'),'Verified payment reference states are constrained');
select ok((select pg_get_constraintdef(oid) like '%purchase_credit%' and pg_get_constraintdef(oid) like '%payment_refund_debit%' and pg_get_constraintdef(oid) like '%payment_refund_manual_review%' from pg_constraint where conrelid='public.audit_credit_ledger'::regclass and conname='audit_credit_ledger_kind_check'),'Payment and refund ledger kinds exist');
select has_function('public','fulfill_v22_verified_credit_payment',array['uuid','text','text','uuid','integer','text','text','text'],'Verified credit fulfillment RPC exists');
select has_function('public','refund_v22_verified_credit_payment',array['uuid','text','text','uuid','integer','text','text','text'],'Verified credit refund validates payment identity and value');
select ok((select bool_and(has_function_privilege('service_role',signature,'EXECUTE') and not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE')) from unnest(array[
  'public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)',
  'public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)'
]) as signatures(signature)), 'Verified payment RPCs are service-role-only');

select has_table('public', 'verified_analysis_inputs', 'Verified inputs exist');
select has_column('public', 'client_cases', 'latest_verified_report_id', 'Case retains latest Verified');
select col_is_fk('public', 'client_cases', 'latest_verified_report_id', 'Verified pointer has a report FK');
select has_pk('public', 'verified_analysis_inputs', 'Verified input job identity is unique');
select has_index('public', 'verified_analysis_inputs', 'uq_verified_analysis_inputs_case_job', 'Verified Case/job index exists');
select ok((select relrowsecurity from pg_class where oid='public.verified_analysis_inputs'::regclass), 'Verified inputs have RLS');
select ok(not has_table_privilege('anon','public.verified_analysis_inputs','SELECT') and not has_table_privilege('authenticated','public.verified_analysis_inputs','SELECT'), 'Browsers cannot read inputs');
select has_function('public','start_v22_verified_analysis',array['uuid','uuid','uuid','text','text','uuid','uuid'],'Verified start RPC includes expected parent');
select has_function('public','resolve_v22_verified_analysis_input',array['uuid','uuid','integer'],'Verified resolve RPC exists');
select has_function('public','persist_v22_verified_result',array['uuid','uuid','jsonb','integer'],'Verified persist RPC exists');
select has_function('public','expire_v22_stale_verified_jobs',array['timestamp with time zone','integer'],'Verified compensation RPC exists');
select has_function('public','settle_v22_verified_job_on_report_link',array[]::text[],'Verified report linking has an atomic settlement trigger function');
select has_function('public','prevent_v22_report_backed_compensation',array[]::text[],'Report-backed jobs have a compensation guard function');
select has_trigger('public','analysis_jobs','settle_v22_verified_job_on_report_link','Verified report linking triggers atomic success settlement');
select has_trigger('public','analysis_attempt_charges','prevent_v22_report_backed_compensation','Charge compensation cannot cross the durable report boundary');
select ok(not has_function_privilege('anon','public.settle_v22_verified_job_on_report_link()','EXECUTE')
  and not has_function_privilege('authenticated','public.settle_v22_verified_job_on_report_link()','EXECUTE')
  and not has_function_privilege('anon','public.prevent_v22_report_backed_compensation()','EXECUTE')
  and not has_function_privilege('authenticated','public.prevent_v22_report_backed_compensation()','EXECUTE'),
  'Verified settlement trigger functions are not browser-callable');
select ok((select bool_and(has_function_privilege('service_role',signature,'EXECUTE') and not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE')) from unnest(array[
  'public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)',
  'public.resolve_v22_verified_analysis_input(uuid,uuid,integer)',
  'public.persist_v22_verified_result(uuid,uuid,jsonb,integer)',
  'public.expire_v22_stale_verified_jobs(timestamptz,integer)'
]) as signatures(signature)), 'All Verified RPCs are service-role-only');
select ok((select count(*)=5 from pg_constraint where conrelid='public.verified_analysis_inputs'::regclass and contype='f'), 'Verified input has job, Case, parent and two snapshot FKs');

select has_table('public', 'client_cases', 'v2.2 client_cases exists');
select has_table('public', 'google_connections', 'v2.2 google_connections exists');
select has_table('public', 'case_source_bindings', 'v2.2 case_source_bindings exists');
select has_table('public', 'data_snapshots', 'v2.2 data_snapshots exists');
select has_table('public', 'analysis_jobs', 'v2.2 analysis_jobs exists');
select has_table('public', 'job_cost_summaries', 'v2.2 job cost summaries exist');
select has_table('public', 'report_shares', 'v2.2 report_shares exists');
select has_table('public', 'google_oauth_sessions', 'v2.2 Google OAuth sessions exist');
select has_table('public', 'google_connection_events', 'v2.2 Google connection events exist');
select has_table('public', 'google_token_broker_requests', 'v2.2 Google broker replay claims exist');

select has_column('public', 'reports', 'case_id', 'reports has a Case owner');
select has_column('public', 'reports', 'report_v2_2', 'reports has the v2.2 contract payload');
select has_column('public', 'reports', 'snapshot_ids', 'reports records immutable input snapshots');
select has_column('public', 'client_cases', 'location_key', 'Cases have a generated Location identity key');
select has_column('public', 'analysis_jobs', 'state_revision', 'analysis jobs track backend state revisions');
select has_column('public', 'google_sync_jobs', 'cost_counters', 'Google sync jobs track provider cost counters');
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
select has_pk('public', 'job_cost_summaries', 'job cost summaries have a primary key');
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
  (select relrowsecurity from pg_class where oid = 'public.job_cost_summaries'::regclass),
  'job_cost_summaries has RLS enabled'
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
  has_table_privilege('service_role', 'public.job_cost_summaries', 'SELECT'),
  'service_role can read job cost summaries'
);
select ok(
  not has_table_privilege('anon', 'public.job_cost_summaries', 'SELECT'),
  'anon cannot read job cost summaries'
);
select ok(
  not has_table_privilege('authenticated', 'public.job_cost_summaries', 'SELECT'),
  'authenticated cannot read job cost summaries'
);
select ok(
  not has_table_privilege('anon', 'public.job_cost_summaries', 'INSERT'),
  'anon cannot insert job cost summaries'
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
    'text', 'text', 'jsonb', 'timestamp with time zone', 'timestamp with time zone',
    'integer', 'timestamp with time zone'
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
select has_function(
  'public', 'request_v22_gbp_sync', array['uuid', 'uuid', 'uuid', 'uuid'],
  'GBP user-requested synchronization exists'
);
select has_function(
  'public', 'finish_v22_gbp_sync',
  array['uuid', 'uuid', 'jsonb', 'jsonb', 'text', 'text', 'jsonb'],
  'GBP synchronization atomically persists manifest and temporary Content'
);
select has_function(
  'public', 'persist_v22_google_sync_cost', array['uuid', 'text', 'jsonb'],
  'Google synchronization has a shared private cost persistence boundary'
);
select has_function(
  'public', 'finish_v22_gsc_sync',
  array['uuid', 'uuid', 'jsonb', 'text', 'text', 'jsonb', 'jsonb'],
  'GSC finish accepts bounded cost counters'
);
select has_function(
  'public', 'fail_v22_gsc_sync',
  array['uuid', 'uuid', 'text', 'boolean', 'jsonb'],
  'GSC failure accepts bounded cost counters'
);
select has_function(
  'public', 'finish_v22_ga4_sync',
  array['uuid', 'uuid', 'jsonb', 'text', 'text', 'jsonb', 'jsonb'],
  'GA4 finish accepts bounded cost counters'
);
select has_function(
  'public', 'fail_v22_ga4_sync',
  array['uuid', 'uuid', 'text', 'boolean', 'jsonb'],
  'GA4 failure accepts bounded cost counters'
);
select has_function(
  'public', 'finish_v22_gbp_sync',
  array['uuid', 'uuid', 'jsonb', 'jsonb', 'text', 'text', 'jsonb', 'jsonb'],
  'GBP finish accepts bounded cost counters'
);
select has_function(
  'public', 'fail_v22_gbp_sync',
  array['uuid', 'uuid', 'text', 'boolean', 'jsonb'],
  'GBP failure accepts bounded cost counters'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.finish_v22_gsc_sync(uuid,uuid,jsonb,text,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute cost-aware Google sync completion'
);
select has_function(
  'public', 'cleanup_v22_expired_gbp_content', array['timestamp with time zone', 'integer'],
  'expired GBP Content cleanup exists'
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
