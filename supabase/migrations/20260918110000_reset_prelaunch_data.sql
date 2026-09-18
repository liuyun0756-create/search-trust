-- One-time production reset approved before the first real v2.2 users.
-- The exact-count guard prevents this migration from erasing any data created
-- after the approved inventory was captured. Fresh databases remain a no-op.
begin;

do $$
declare
  actual jsonb;
  approved jsonb := jsonb_build_object(
    'users', 17,
    'client_cases', 4,
    'reports', 29,
    'orders', 10,
    'data_snapshots', 6,
    'analysis_jobs', 8,
    'workflow_charges', 8,
    'credit_ledger', 32,
    'job_cost_summaries', 26,
    'prospect_discovery_tasks', 8,
    'report_shares', 0,
    'case_report_entitlements', 0,
    'verified_analysis_inputs', 0,
    'analysis_attempt_charges', 0,
    'audit_credit_ledger', 0,
    'verified_credit_refund_reviews', 0,
    'credit_purchase_refund_reviews', 0,
    'google_connections', 1,
    'case_source_bindings', 2,
    'google_sync_jobs', 5,
    'google_oauth_sessions', 9,
    'google_token_broker_requests', 6,
    'google_connection_events', 17,
    'identity_deletion_receipts', 0
  );
  empty_inventory jsonb;
begin
  select jsonb_object_agg(key, 0) into empty_inventory
  from jsonb_object_keys(approved) as keys(key);

  actual := jsonb_build_object(
    'users', (select count(*) from public.users),
    'client_cases', (select count(*) from public.client_cases),
    'reports', (select count(*) from public.reports),
    'orders', (select count(*) from public.orders),
    'data_snapshots', (select count(*) from public.data_snapshots),
    'analysis_jobs', (select count(*) from public.analysis_jobs),
    'workflow_charges', (select count(*) from public.workflow_charges),
    'credit_ledger', (select count(*) from public.credit_ledger),
    'job_cost_summaries', (select count(*) from public.job_cost_summaries),
    'prospect_discovery_tasks', (select count(*) from public.prospect_discovery_tasks),
    'report_shares', (select count(*) from public.report_shares),
    'case_report_entitlements', (select count(*) from public.case_report_entitlements),
    'verified_analysis_inputs', (select count(*) from public.verified_analysis_inputs),
    'analysis_attempt_charges', (select count(*) from public.analysis_attempt_charges),
    'audit_credit_ledger', (select count(*) from public.audit_credit_ledger),
    'verified_credit_refund_reviews', (select count(*) from public.verified_credit_refund_reviews),
    'credit_purchase_refund_reviews', (select count(*) from public.credit_purchase_refund_reviews),
    'google_connections', (select count(*) from public.google_connections),
    'case_source_bindings', (select count(*) from public.case_source_bindings),
    'google_sync_jobs', (select count(*) from public.google_sync_jobs),
    'google_oauth_sessions', (select count(*) from public.google_oauth_sessions),
    'google_token_broker_requests', (select count(*) from public.google_token_broker_requests),
    'google_connection_events', (select count(*) from public.google_connection_events),
    'identity_deletion_receipts', (select count(*) from public.identity_deletion_receipts)
  );

  if actual = empty_inventory then
    return;
  end if;
  if actual <> approved then
    raise exception using
      errcode = 'P0001',
      message = 'V22_PRELAUNCH_CLEANUP_INVENTORY_CHANGED';
  end if;

  truncate table
    public.analysis_attempt_charges,
    public.audit_credit_ledger,
    public.case_report_entitlements,
    public.case_source_bindings,
    public.credit_ledger,
    public.credit_purchase_refund_reviews,
    public.data_snapshots,
    public.google_connection_events,
    public.google_connections,
    public.google_oauth_sessions,
    public.google_sync_jobs,
    public.google_token_broker_requests,
    public.identity_deletion_receipts,
    public.job_cost_summaries,
    public.prospect_discovery_tasks,
    public.report_shares,
    public.verified_analysis_inputs,
    public.verified_credit_refund_reviews,
    public.workflow_charges,
    public.analysis_jobs,
    public.reports,
    public.orders,
    public.client_cases,
    public.users
  restart identity;
end;
$$;

commit;
