-- SearchTrust v2.2 revocable client-report sharing.
-- Only SHA-256 token digests are stored; plaintext tokens exist only in the
-- one-time API response that creates or rotates a share.

begin;

create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  token_hash text not null unique,
  view_mode text not null default 'client' check (view_mode = 'client'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_shares_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint report_shares_expiry_check check (expires_at > created_at),
  constraint report_shares_access_check check (
    last_accessed_at is null or last_accessed_at >= created_at
  ),
  constraint report_shares_revoke_check check (
    revoked_at is null or revoked_at >= created_at
  )
);

create unique index if not exists uq_report_shares_active_report
  on public.report_shares (report_id)
  where revoked_at is null;

create index if not exists idx_report_shares_user_case_created
  on public.report_shares (user_id, case_id, created_at desc);

create index if not exists idx_report_shares_active_expiry
  on public.report_shares (expires_at)
  where revoked_at is null;

create or replace function public.rotate_v22_report_share(
  p_user_id uuid,
  p_case_id uuid,
  p_report_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_share_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then
    raise exception 'invalid report share parameters';
  end if;

  if not exists (
    select 1
    from public.reports r
    where r.id = p_report_id
      and r.user_id = p_user_id
      and r.case_id = p_case_id
      and r.report_v2_2 is not null
  ) then
    raise exception 'report share target does not belong to user and case';
  end if;

  update public.report_shares
  set revoked_at = coalesce(revoked_at, now())
  where report_id = p_report_id and revoked_at is null;

  insert into public.report_shares (
    user_id, case_id, report_id, token_hash, view_mode, expires_at
  ) values (
    p_user_id, p_case_id, p_report_id, p_token_hash, 'client', p_expires_at
  )
  returning id into created_share_id;

  return created_share_id;
end;
$$;

alter table public.report_shares enable row level security;

grant select, insert, update, delete on table public.report_shares to service_role;
revoke all on table public.report_shares from anon, authenticated;
revoke all on function public.rotate_v22_report_share(uuid, uuid, uuid, text, timestamptz) from public;
grant execute on function public.rotate_v22_report_share(uuid, uuid, uuid, text, timestamptz) to service_role;

comment on table public.report_shares is 'Revocable, expiring v2.2 client-report shares; stores token digests only.';
comment on column public.report_shares.token_hash is 'Lowercase SHA-256 digest of the one-time plaintext share token.';

commit;

-- Verification after applying:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'report_shares'
-- order by ordinal_position;
-- select relrowsecurity from pg_class where oid = 'public.report_shares'::regclass;
-- select routine_name from information_schema.routines
-- where routine_schema = 'public' and routine_name = 'rotate_v22_report_share';

-- Rollback (destructive: revokes and deletes all existing share links):
-- begin;
-- drop function if exists public.rotate_v22_report_share(uuid, uuid, uuid, text, timestamptz);
-- drop table if exists public.report_shares;
-- commit;
