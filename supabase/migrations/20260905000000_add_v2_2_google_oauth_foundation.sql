begin;

alter table public.google_connections
  add column refresh_lease_id uuid,
  add column refresh_lease_expires_at timestamptz;

alter table public.google_connections
  drop constraint google_connections_status_check,
  drop constraint google_connections_terminal_token_check,
  drop constraint google_connections_active_token_check,
  drop constraint google_connections_status_timestamp_check;

alter table public.google_connections
  add constraint google_connections_status_check check (
    status in ('active', 'error', 'reauth_required', 'revoked', 'deleted')
  ),
  add constraint google_connections_refresh_lease_check check (
    (refresh_lease_id is null and refresh_lease_expires_at is null) or
    (refresh_lease_id is not null and refresh_lease_expires_at is not null)
  ),
  add constraint google_connections_inactive_token_check check (
    status not in ('reauth_required', 'revoked', 'deleted') or (
      access_token_ciphertext is null and access_token_iv is null and access_token_auth_tag is null and
      refresh_token_ciphertext is null and refresh_token_iv is null and refresh_token_auth_tag is null and
      encryption_key_version is null and token_expires_at is null and
      refresh_lease_id is null and refresh_lease_expires_at is null
    )
  ),
  add constraint google_connections_active_token_check check (
    status <> 'active' or (
      access_token_ciphertext is not null and
      refresh_token_ciphertext is not null
    )
  ),
  add constraint google_connections_status_timestamp_check check (
    (status = 'revoked' and revoked_at is not null and deleted_at is null) or
    (status = 'deleted' and deleted_at is not null) or
    (status in ('active', 'error', 'reauth_required') and revoked_at is null and deleted_at is null)
  );

create index idx_google_connections_refresh_lease
  on public.google_connections (refresh_lease_expires_at)
  where refresh_lease_id is not null;

create table public.google_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete cascade,
  state_digest bytea not null,
  pkce_verifier_ciphertext bytea not null,
  pkce_verifier_iv bytea not null,
  pkce_verifier_auth_tag bytea not null,
  encryption_key_version text not null,
  requested_sources text[] not null,
  requested_scopes text[] not null,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  outcome_code text,
  created_at timestamptz not null default now(),
  constraint google_oauth_sessions_state_digest_check check (octet_length(state_digest) = 32),
  constraint google_oauth_sessions_verifier_check check (
    octet_length(pkce_verifier_ciphertext) > 0 and
    octet_length(pkce_verifier_iv) = 12 and
    octet_length(pkce_verifier_auth_tag) = 16 and
    btrim(encryption_key_version) <> ''
  ),
  constraint google_oauth_sessions_sources_check check (
    cardinality(requested_sources) between 1 and 3 and
    requested_sources <@ array['gsc', 'ga4', 'gbp']::text[] and
    array_position(requested_sources, null) is null
  ),
  constraint google_oauth_sessions_scopes_check check (
    cardinality(requested_scopes) > 0 and
    array_position(requested_scopes, null) is null
  ),
  constraint google_oauth_sessions_return_path_check check (
    return_path like '/%' and return_path not like '//%'
  ),
  constraint google_oauth_sessions_expiry_check check (
    expires_at > created_at and expires_at <= created_at + interval '10 minutes'
  ),
  constraint google_oauth_sessions_outcome_check check (
    (consumed_at is null and outcome_code is null) or
    (consumed_at is not null and btrim(coalesce(outcome_code, '')) <> '')
  )
);

create unique index uq_google_oauth_sessions_state_digest
  on public.google_oauth_sessions (state_digest);
create index idx_google_oauth_sessions_expiry
  on public.google_oauth_sessions (expires_at)
  where consumed_at is null;
create index idx_google_oauth_sessions_user_created
  on public.google_oauth_sessions (user_id, created_at desc);

create table public.google_connection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  connection_id uuid references public.google_connections(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete set null,
  event_type text not null check (
    event_type in (
      'authorization_started', 'authorization_succeeded', 'authorization_denied',
      'authorization_failed', 'scope_extended', 'refresh_succeeded',
      'refresh_failed', 'revoked', 'deleted'
    )
  ),
  requested_sources text[] not null default '{}',
  covered_sources text[] not null default '{}',
  result_code text not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  constraint google_connection_events_sources_check check (
    requested_sources <@ array['gsc', 'ga4', 'gbp']::text[] and
    covered_sources <@ array['gsc', 'ga4', 'gbp']::text[] and
    array_position(requested_sources, null) is null and
    array_position(covered_sources, null) is null
  ),
  constraint google_connection_events_safe_text_check check (
    btrim(result_code) <> '' and octet_length(result_code) <= 100 and
    btrim(request_id) <> '' and octet_length(request_id) <= 200
  )
);

create index idx_google_connection_events_user_created
  on public.google_connection_events (user_id, created_at desc);
create index idx_google_connection_events_connection_created
  on public.google_connection_events (connection_id, created_at desc)
  where connection_id is not null;

create or replace function public.validate_google_oauth_session_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  case_owner uuid;
begin
  if new.case_id is null then
    return new;
  end if;

  select user_id into case_owner
  from public.client_cases
  where id = new.case_id;

  if not found or case_owner is distinct from new.user_id then
    raise exception using
      errcode = '23514',
      message = 'OAuth session Case must belong to its user';
  end if;
  return new;
end;
$$;

create trigger validate_google_oauth_session_ownership
before insert or update of user_id, case_id on public.google_oauth_sessions
for each row execute function public.validate_google_oauth_session_ownership();

create or replace function public.validate_google_connection_event_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  connection_owner uuid;
  case_owner uuid;
begin
  if new.connection_id is not null then
    select user_id into connection_owner
    from public.google_connections
    where id = new.connection_id;
    if not found or connection_owner is distinct from new.user_id then
      raise exception using errcode = '23514', message = 'Google connection event must use an owned connection';
    end if;
  end if;

  if new.case_id is not null then
    select user_id into case_owner
    from public.client_cases
    where id = new.case_id;
    if not found or case_owner is distinct from new.user_id then
      raise exception using errcode = '23514', message = 'Google connection event must use an owned Case';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_google_connection_event_ownership
before insert or update of user_id, connection_id, case_id on public.google_connection_events
for each row execute function public.validate_google_connection_event_ownership();

create or replace function public.validate_v22_connection_token_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('reauth_required', 'revoked', 'deleted') and (
    new.access_token_ciphertext is not null or
    new.access_token_iv is not null or
    new.access_token_auth_tag is not null or
    new.refresh_token_ciphertext is not null or
    new.refresh_token_iv is not null or
    new.refresh_token_auth_tag is not null or
    new.encryption_key_version is not null or
    new.token_expires_at is not null or
    new.refresh_lease_id is not null or
    new.refresh_lease_expires_at is not null
  ) then
    raise exception using
      errcode = '23514',
      message = 'inactive Google connections must not retain token material';
  end if;
  return new;
end;
$$;

create or replace function public.cleanup_expired_google_oauth_sessions(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.google_oauth_sessions
  where greatest(expires_at, coalesce(consumed_at, expires_at)) < p_now - interval '24 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.google_oauth_sessions enable row level security;
alter table public.google_connection_events enable row level security;

grant select, insert, update, delete on table public.google_oauth_sessions to service_role;
grant select, insert, update, delete on table public.google_connection_events to service_role;

revoke all on table public.google_oauth_sessions from anon, authenticated;
revoke all on table public.google_connection_events from anon, authenticated;
revoke all on function public.cleanup_expired_google_oauth_sessions(timestamptz) from public, anon, authenticated;
grant execute on function public.cleanup_expired_google_oauth_sessions(timestamptz) to service_role;

comment on table public.google_oauth_sessions is 'Server-only one-time OAuth state and encrypted PKCE verifier records.';
comment on table public.google_connection_events is 'Non-secret audit events for Google connection lifecycle changes.';
comment on column public.google_connections.refresh_lease_id is 'Short-lived compare-and-set lease holder for token refresh.';

commit;
