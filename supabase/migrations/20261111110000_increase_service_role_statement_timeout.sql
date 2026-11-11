-- Idempotent role setting; no business function or lock timeout changes.
-- Pair with the V22_CAPABILITY_INPUT client's 180-second total budget.
-- This does not override preparation leases or hosted Data API/gateway limits.
begin;
alter role service_role set statement_timeout = '180s';
notify pgrst, 'reload config';
commit;

-- Rollback in a separate approved migration/transaction:
-- begin;
-- alter role service_role set statement_timeout = '60s';
-- notify pgrst, 'reload config';
-- commit;
