-- V22-081 security hardening: deletion fencing, idempotent deletion receipts,
-- and late Clerk create-event suppression. Forward-only and service-role-only.

begin;

alter table public.google_connections
  drop constraint google_connections_status_check,
  drop constraint google_connections_status_timestamp_check;

alter table public.google_connections
  add constraint google_connections_status_check check (
    status in ('active', 'error', 'reauth_required', 'deleting', 'revoked', 'deleted')
  ),
  add constraint google_connections_status_timestamp_check check (
    (status = 'revoked' and revoked_at is not null and deleted_at is null) or
    (status = 'deleted' and deleted_at is not null) or
    (status in ('active', 'error', 'reauth_required', 'deleting') and revoked_at is null and deleted_at is null)
  );

create table public.identity_deletion_receipts (
  event_id_digest bytea primary key,
  subject_digest bytea not null,
  event_occurred_at timestamptz not null,
  completed_at timestamptz not null default now(),
  result_code text not null check (result_code in ('deleted', 'already_deleted')),
  created_at timestamptz not null default now(),
  constraint identity_deletion_receipts_event_digest_check
    check (octet_length(event_id_digest) = 32),
  constraint identity_deletion_receipts_subject_digest_check
    check (octet_length(subject_digest) = 32)
);

create index idx_identity_deletion_receipts_subject_completed
  on public.identity_deletion_receipts (subject_digest, completed_at desc);
create index idx_identity_deletion_receipts_cleanup
  on public.identity_deletion_receipts (completed_at);

create or replace function public.prepare_v22_user_deletion(p_clerk_user_id text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if p_clerk_user_id is null or btrim(p_clerk_user_id) = '' or octet_length(p_clerk_user_id) > 255 then
    raise exception using errcode = '22023', message = 'INVALID_IDENTITY_SUBJECT';
  end if;

  select id into target_user_id
  from public.users
  where clerk_user_id = p_clerk_user_id
  for update;

  if target_user_id is null then
    return null;
  end if;

  update public.google_connections
  set status = 'deleting',
      refresh_lease_id = null,
      refresh_lease_expires_at = null,
      last_error_code = 'ACCOUNT_DELETION_PENDING',
      last_error_message = null,
      updated_at = now()
  where user_id = target_user_id
    and status in ('active', 'error', 'deleting');

  return target_user_id;
end;
$$;

create or replace function public.complete_v22_user_deletion(
  p_clerk_user_id text,
  p_event_id_digest bytea,
  p_subject_digest bytea,
  p_event_occurred_at timestamptz
)
returns text
language plpgsql
set search_path = public
as $$
declare
  existing_subject_digest bytea;
  target_user_id uuid;
  outcome text;
begin
  if p_clerk_user_id is null or btrim(p_clerk_user_id) = '' or octet_length(p_clerk_user_id) > 255 or
     p_event_occurred_at is null or
     octet_length(p_event_id_digest) <> 32 or octet_length(p_subject_digest) <> 32 then
    raise exception using errcode = '22023', message = 'INVALID_DELETION_RECEIPT';
  end if;

  lock table public.identity_deletion_receipts in share row exclusive mode;

  select subject_digest into existing_subject_digest
  from public.identity_deletion_receipts
  where event_id_digest = p_event_id_digest;

  if found then
    if existing_subject_digest is distinct from p_subject_digest then
      raise exception using errcode = '23514', message = 'DELETION_EVENT_CONFLICT';
    end if;
    return 'already_deleted';
  end if;

  select id into target_user_id
  from public.users
  where clerk_user_id = p_clerk_user_id
  for update;

  outcome := case when target_user_id is null then 'already_deleted' else 'deleted' end;

  insert into public.identity_deletion_receipts (
    event_id_digest, subject_digest, event_occurred_at, completed_at, result_code
  ) values (
    p_event_id_digest, p_subject_digest, p_event_occurred_at, now(), outcome
  );

  if target_user_id is not null then
    delete from public.users where id = target_user_id;
  end if;

  return outcome;
end;
$$;

create or replace function public.register_v22_clerk_user(
  p_clerk_user_id text,
  p_subject_digest bytea,
  p_email text,
  p_name text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  existing_user_id uuid;
begin
  if p_clerk_user_id is null or btrim(p_clerk_user_id) = '' or octet_length(p_clerk_user_id) > 255 or
     octet_length(p_subject_digest) <> 32 or
     p_email is null or btrim(p_email) = '' or octet_length(p_email) > 255 or
     (p_name is not null and octet_length(p_name) > 255) then
    raise exception using errcode = '22023', message = 'INVALID_IDENTITY_PROFILE';
  end if;

  lock table public.identity_deletion_receipts in share row exclusive mode;

  if exists (
    select 1
    from public.identity_deletion_receipts
    where subject_digest = p_subject_digest
      and completed_at >= now() - interval '90 days'
  ) then
    return 'blocked_deleted_identity';
  end if;

  select id into existing_user_id
  from public.users
  where clerk_user_id = p_clerk_user_id
  for update;

  if existing_user_id is not null then
    update public.users
    set email = p_email,
        name = p_name,
        updated_at = now()
    where id = existing_user_id;
    return 'existing';
  end if;

  insert into public.users (clerk_user_id, email, name, audit_credits)
  values (p_clerk_user_id, p_email, p_name, 5);
  return 'created';
end;
$$;

create or replace function public.cleanup_v22_identity_deletion_receipts(p_now timestamptz default now())
returns integer
language plpgsql
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_now is null then
    raise exception using errcode = '22023', message = 'INVALID_CLEANUP_TIME';
  end if;
  delete from public.identity_deletion_receipts
  where completed_at < p_now - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.deactivate_v22_google_bindings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('reauth_required', 'deleting', 'revoked', 'deleted') then
    update public.case_source_bindings
    set is_active = false,
        disconnected_at = now(),
        health_status = 'unavailable'
    where connection_id = new.id and is_active;
  end if;
  return new;
end;
$$;

alter table public.identity_deletion_receipts enable row level security;

grant select, insert, update, delete on table public.identity_deletion_receipts to service_role;
revoke all on table public.identity_deletion_receipts from public, anon, authenticated;

revoke all on function public.prepare_v22_user_deletion(text) from public, anon, authenticated;
revoke all on function public.complete_v22_user_deletion(text, bytea, bytea, timestamptz) from public, anon, authenticated;
revoke all on function public.register_v22_clerk_user(text, bytea, text, text) from public, anon, authenticated;
revoke all on function public.cleanup_v22_identity_deletion_receipts(timestamptz) from public, anon, authenticated;

grant execute on function public.prepare_v22_user_deletion(text) to service_role;
grant execute on function public.complete_v22_user_deletion(text, bytea, bytea, timestamptz) to service_role;
grant execute on function public.register_v22_clerk_user(text, bytea, text, text) to service_role;
grant execute on function public.cleanup_v22_identity_deletion_receipts(timestamptz) to service_role;

comment on table public.identity_deletion_receipts is
  'Service-role-only 90-day non-PII digests preventing replay and late recreation after Clerk user deletion.';

commit;

-- Verification after applying:
-- select relrowsecurity from pg_class where oid = 'public.identity_deletion_receipts'::regclass;
-- select status, count(*) from public.google_connections group by status;
