-- Match the acquisition input RPC client's 60-second total timeout.
-- PostgREST applies this role setting before executing the outer statement.
alter role service_role set statement_timeout = '60s';
notify pgrst, 'reload config';
