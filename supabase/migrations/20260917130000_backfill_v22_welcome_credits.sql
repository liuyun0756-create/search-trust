-- Backfill the V2.2 welcome grant for accounts that predate the unified
-- permanent-credit ledger. New accounts are handled by
-- register_v22_clerk_user; this migration only repairs legacy zero-balance
-- accounts and remains safe to replay.

begin;

with candidates as (
  select u.id
  from public.users u
  where u.credit_balance = 0
    and not exists (
      select 1
      from public.credit_ledger l
      where l.user_id = u.id
        and l.kind = 'welcome_grant'
    )
),
inserted_grants as (
  insert into public.credit_ledger (
    user_id,
    kind,
    delta,
    balance_after,
    idempotency_key
  )
  select
    candidate.id,
    'welcome_grant',
    5,
    5,
    'welcome:' || candidate.id::text
  from candidates candidate
  on conflict do nothing
  returning user_id
)
update public.users u
set credit_balance = 5,
    updated_at = now()
where u.credit_balance = 0
  and exists (select 1 from inserted_grants grant_row where grant_row.user_id = u.id);

commit;
