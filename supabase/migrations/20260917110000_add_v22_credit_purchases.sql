-- V22-095 phase 3: one account-level $19 credit purchase for every workflow.

begin;

alter table public.orders add column provider_refund_id text;
create unique index uq_orders_provider_refund_id
  on public.orders (provider_refund_id) where provider_refund_id is not null;

alter table public.orders
  drop constraint orders_purchase_kind_check,
  drop constraint orders_purchase_shape_check,
  drop constraint orders_payment_reference_check,
  add constraint orders_purchase_kind_check check (
    purchase_kind in ('legacy_credit', 'case_prospect_report', 'case_verified_credit', 'credit_purchase')
  ),
  add constraint orders_purchase_shape_check check (
    (purchase_kind = 'legacy_credit' and case_id is null and credits_purchased > 0) or
    (purchase_kind = 'case_prospect_report' and case_id is not null and credits_purchased = 0) or
    (purchase_kind = 'case_verified_credit' and case_id is not null
      and credits_purchased = 1 and amount = 1900 and currency is not distinct from 'USD') or
    (purchase_kind = 'credit_purchase' and case_id is null
      and credits_purchased = 1 and amount = 1900 and currency is not distinct from 'USD')
  ),
  add constraint orders_payment_reference_check check (
    (purchase_kind in ('case_verified_credit', 'credit_purchase') and
      (status in ('pending', 'failed') or payment_id is not null)) or
    (purchase_kind not in ('case_verified_credit', 'credit_purchase') and
      (payment_id is not null or order_id is not null or checkout_session_id is not null or
        (purchase_kind = 'case_prospect_report' and status in ('pending', 'failed'))))
  ),
  add constraint orders_credit_checkout_initialization_check check (
    purchase_kind <> 'credit_purchase' or status <> 'pending' or (
      checkout_initialization_token is not null
      and checkout_initialization_started_at is not null
      and btrim(coalesce(provider_product_id, '')) <> ''
      and (
        (checkout_session_id is null and checkout_url is null) or
        (checkout_session_id is not null and checkout_url is not null)
      )
    )
  );

create unique index uq_orders_pending_credit_purchase
  on public.orders (user_id)
  where purchase_kind = 'credit_purchase' and status = 'pending';

create table public.credit_purchase_refund_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_refund_id text not null unique check (btrim(provider_refund_id) <> ''),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id text not null check (btrim(payment_id) <> ''),
  user_id uuid not null references public.users(id) on delete restrict,
  checkout_session_id text not null check (btrim(checkout_session_id) <> ''),
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  payment_amount integer not null check (payment_amount = 1900),
  payment_currency text not null check (payment_currency = 'USD'),
  payment_refund_status text check (payment_refund_status in ('partial', 'full')),
  reason text not null check (reason in (
    'partial_refund', 'amount_mismatch', 'currency_mismatch',
    'payment_refund_status_mismatch', 'credit_already_spent'
  )),
  refund_amount integer check (refund_amount is null or refund_amount >= 0),
  refund_currency text check (refund_currency is null or btrim(refund_currency) <> ''),
  is_partial boolean not null,
  status text not null default 'manual_review' check (status = 'manual_review'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_credit_purchase_refund_reviews_order
  on public.credit_purchase_refund_reviews (order_id, created_at desc);
alter table public.credit_purchase_refund_reviews enable row level security;
revoke all on table public.credit_purchase_refund_reviews from public, anon, authenticated;
grant all on table public.credit_purchase_refund_reviews to service_role;

create function public.claim_v22_credit_checkout(
  p_user_id uuid,
  p_product_id text
)
returns table (
  action text,
  order_id uuid,
  checkout_session_id text,
  checkout_url text,
  provider_product_id text,
  initialization_token uuid,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_order public.orders;
  created_order public.orders;
  now_at timestamptz := clock_timestamp();
  retry_seconds integer;
begin
  if btrim(coalesce(p_product_id, '')) = '' or length(p_product_id) > 255 then
    raise exception 'V22_CREDIT_CHECKOUT_PRODUCT_INVALID';
  end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  if not found then raise exception 'V22_CREDIT_CHECKOUT_USER_INVALID'; end if;

  select * into pending_order from public.orders o
  where o.user_id = p_user_id
    and o.purchase_kind = 'credit_purchase'
    and o.status = 'pending'
  for update;

  if pending_order.id is not null then
    if (pending_order.checkout_session_id is null) <> (pending_order.checkout_url is null)
      or pending_order.checkout_initialization_token is null
      or pending_order.checkout_initialization_started_at is null
      or btrim(coalesce(pending_order.provider_product_id, '')) = '' then
      raise exception 'V22_CREDIT_CHECKOUT_STATE_INVALID';
    end if;
    if pending_order.checkout_session_id is not null then
      return query select 'reuse'::text, pending_order.id,
        pending_order.checkout_session_id::text, pending_order.checkout_url,
        pending_order.provider_product_id, pending_order.checkout_initialization_token, 0;
      return;
    end if;
    if pending_order.checkout_initialization_started_at > now_at - interval '60 seconds' then
      retry_seconds := greatest(1, least(60, ceil(extract(epoch from
        (pending_order.checkout_initialization_started_at + interval '60 seconds' - now_at)))::integer));
      return query select 'initializing'::text, pending_order.id, null::text, null::text,
        pending_order.provider_product_id, pending_order.checkout_initialization_token, retry_seconds;
      return;
    end if;
    update public.orders set status = 'failed'
    where id = pending_order.id and status = 'pending'
      and checkout_session_id is null and checkout_url is null
      and checkout_initialization_token = pending_order.checkout_initialization_token
      and checkout_initialization_started_at = pending_order.checkout_initialization_started_at;
    if not found then raise exception 'V22_CREDIT_CHECKOUT_STALE_CAS_FAILED'; end if;
  end if;

  insert into public.orders (
    user_id, case_id, purchase_kind, amount, currency, credits_purchased, status,
    provider_product_id, checkout_initialization_token, checkout_initialization_started_at
  ) values (
    p_user_id, null, 'credit_purchase', 1900, 'USD', 1, 'pending',
    p_product_id, gen_random_uuid(), now_at
  ) returning * into created_order;

  return query select 'create'::text, created_order.id, null::text, null::text,
    created_order.provider_product_id, created_order.checkout_initialization_token, 0;
end;
$$;

create function public.attach_v22_credit_checkout(
  p_user_id uuid,
  p_order_id uuid,
  p_initialization_token uuid,
  p_product_id text,
  p_checkout_session_id text,
  p_checkout_url text
)
returns table (checkout_session_id text, checkout_url text, idempotent boolean)
language plpgsql
security definer
set search_path = public
as $$
declare payment_order public.orders;
begin
  if p_initialization_token is null
    or btrim(coalesce(p_product_id, '')) = ''
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or length(p_checkout_session_id) > 255
    or btrim(coalesce(p_checkout_url, '')) = ''
    or p_checkout_url !~ '^https://[^[:space:]]+$' then
    raise exception 'V22_CREDIT_CHECKOUT_ATTACH_INVALID';
  end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  if not found then raise exception 'V22_CREDIT_CHECKOUT_USER_INVALID'; end if;
  select * into payment_order from public.orders o where o.id = p_order_id for update;
  if payment_order.id is null
    or payment_order.user_id is distinct from p_user_id
    or payment_order.case_id is not null
    or payment_order.purchase_kind is distinct from 'credit_purchase'
    or payment_order.status is distinct from 'pending'
    or payment_order.provider_product_id is distinct from p_product_id
    or payment_order.checkout_initialization_token is distinct from p_initialization_token then
    raise exception 'V22_CREDIT_CHECKOUT_ATTACH_MISMATCH';
  end if;

  if payment_order.checkout_session_id is not null or payment_order.checkout_url is not null then
    if payment_order.checkout_session_id is distinct from p_checkout_session_id
      or payment_order.checkout_url is distinct from p_checkout_url then
      raise exception 'V22_CREDIT_CHECKOUT_ATTACH_REPLAY_MISMATCH';
    end if;
    return query select payment_order.checkout_session_id::text, payment_order.checkout_url, true;
    return;
  end if;

  update public.orders o set checkout_session_id = p_checkout_session_id,
    checkout_url = p_checkout_url
  where o.id = payment_order.id and o.status = 'pending'
    and o.checkout_session_id is null and o.checkout_url is null;
  if not found then raise exception 'V22_CREDIT_CHECKOUT_ATTACH_CAS_FAILED'; end if;
  return query select p_checkout_session_id, p_checkout_url, false;
end;
$$;

create function public.fulfill_v22_credit_payment(
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_amount integer,
  p_currency text,
  p_checkout_session_id text,
  p_product_id text
)
returns table (fulfilled boolean, idempotent boolean, credits_added integer, credit_balance integer)
language plpgsql
set search_path = public
as $$
declare
  owner public.users%rowtype;
  payment_order public.orders%rowtype;
  purchase public.credit_ledger%rowtype;
  reversal public.credit_ledger%rowtype;
  resulting_balance integer;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount is distinct from 1900
    or p_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'V22_CREDIT_PAYMENT_INVALID';
  end if;
  select * into owner from public.users u
    where u.clerk_user_id = p_clerk_user_id for update;
  if owner.id is null then raise exception 'V22_CREDIT_PAYMENT_OWNER_MISMATCH'; end if;
  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner.id
    or payment_order.case_id is not null
    or payment_order.purchase_kind is distinct from 'credit_purchase'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount
    or payment_order.currency is distinct from p_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or (payment_order.payment_id is not null and payment_order.payment_id is distinct from p_payment_id) then
    raise exception 'V22_CREDIT_PAYMENT_ORDER_MISMATCH';
  end if;
  select * into purchase from public.credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'credit_purchase';
  select * into reversal from public.credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'purchase_refund_debit';
  resulting_balance := owner.credit_balance;

  if payment_order.status = 'paid' then
    if purchase.id is null or reversal.id is not null then
      raise exception 'V22_CREDIT_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, 0, resulting_balance;
    return;
  end if;
  if payment_order.status = 'refunded' then
    if purchase.id is null then raise exception 'V22_CREDIT_PAYMENT_LEDGER_INVALID'; end if;
    return query select true, true, 0, resulting_balance;
    return;
  end if;
  if payment_order.status not in ('pending', 'failed') or purchase.id is not null then
    raise exception 'V22_CREDIT_PAYMENT_STATE_INVALID';
  end if;

  update public.orders set status = 'paid', payment_id = p_payment_id,
    paid_at = coalesce(paid_at, now()) where id = payment_order.id;
  update public.users u set credit_balance = u.credit_balance + 1, updated_at = now()
    where u.id = owner.id returning u.credit_balance into resulting_balance;
  insert into public.credit_ledger (
    user_id, order_id, kind, delta, balance_after, idempotency_key
  ) values (
    owner.id, payment_order.id, 'credit_purchase', 1, resulting_balance,
    'order:' || payment_order.id::text || ':purchase'
  );
  return query select true, false, 1, resulting_balance;
end;
$$;

create function public.record_v22_credit_refund_review(
  p_provider_refund_id text,
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_payment_amount integer,
  p_payment_currency text,
  p_checkout_session_id text,
  p_product_id text,
  p_reason text,
  p_refund_amount integer,
  p_refund_currency text,
  p_is_partial boolean,
  p_payment_refund_status text
)
returns table (review_id uuid, idempotent boolean, status text, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner public.users%rowtype;
  payment_order public.orders%rowtype;
  review_row public.credit_purchase_refund_reviews%rowtype;
  inserted boolean;
begin
  if btrim(coalesce(p_provider_refund_id, '')) = ''
    or btrim(coalesce(p_payment_id, '')) = ''
    or p_payment_amount is distinct from 1900
    or p_payment_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = ''
    or p_reason not in ('partial_refund','amount_mismatch','currency_mismatch','payment_refund_status_mismatch','credit_already_spent')
    or p_is_partial is null
    or (p_refund_amount is not null and p_refund_amount < 0)
    or (p_refund_currency is not null and btrim(p_refund_currency) = '')
    or (p_payment_refund_status is not null and p_payment_refund_status not in ('partial','full')) then
    raise exception 'V22_CREDIT_REFUND_REVIEW_INVALID';
  end if;
  select * into owner from public.users u
    where u.clerk_user_id = p_clerk_user_id for update;
  if owner.id is null then raise exception 'V22_CREDIT_REFUND_REVIEW_OWNER_MISMATCH'; end if;
  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner.id
    or payment_order.case_id is not null or payment_order.purchase_kind is distinct from 'credit_purchase'
    or payment_order.amount is distinct from p_payment_amount
    or payment_order.currency is distinct from p_payment_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or (payment_order.payment_id is not null and payment_order.payment_id is distinct from p_payment_id) then
    raise exception 'V22_CREDIT_REFUND_REVIEW_ORDER_MISMATCH';
  end if;
  if payment_order.payment_id is null then
    update public.orders set payment_id = p_payment_id where id = payment_order.id;
  end if;
  insert into public.credit_purchase_refund_reviews (
    provider_refund_id, order_id, payment_id, user_id, checkout_session_id,
    provider_product_id, payment_amount, payment_currency, payment_refund_status,
    reason, refund_amount, refund_currency, is_partial
  ) values (
    p_provider_refund_id, payment_order.id, p_payment_id, owner.id, p_checkout_session_id,
    p_product_id, p_payment_amount, p_payment_currency, p_payment_refund_status,
    p_reason, p_refund_amount, p_refund_currency, p_is_partial
  ) on conflict (provider_refund_id) do nothing returning * into review_row;
  inserted := found;
  if not inserted then
    select * into review_row from public.credit_purchase_refund_reviews
      where provider_refund_id = p_provider_refund_id for update;
    if review_row.order_id is distinct from payment_order.id
      or review_row.reason is distinct from p_reason
      or review_row.refund_amount is distinct from p_refund_amount
      or review_row.refund_currency is distinct from p_refund_currency
      or review_row.is_partial is distinct from p_is_partial then
      raise exception 'V22_CREDIT_REFUND_REVIEW_REPLAY_MISMATCH';
    end if;
    update public.credit_purchase_refund_reviews set updated_at = now()
      where id = review_row.id returning * into review_row;
  end if;
  return query select review_row.id, not inserted, 'manual_review'::text, review_row.reason;
end;
$$;

create function public.refund_v22_credit_payment(
  p_provider_refund_id text,
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_amount integer,
  p_currency text,
  p_checkout_session_id text,
  p_product_id text
)
returns table (
  refunded boolean,
  idempotent boolean,
  reversal_applied boolean,
  manual_review boolean,
  credit_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  owner public.users%rowtype;
  payment_order public.orders%rowtype;
  purchase public.credit_ledger%rowtype;
  reversal public.credit_ledger%rowtype;
  review_row public.credit_purchase_refund_reviews%rowtype;
  resulting_balance integer;
begin
  if btrim(coalesce(p_provider_refund_id, '')) = ''
    or btrim(coalesce(p_payment_id, '')) = ''
    or p_amount is distinct from 1900 or p_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'V22_CREDIT_REFUND_INVALID';
  end if;
  select * into owner from public.users u
    where u.clerk_user_id = p_clerk_user_id for update;
  if owner.id is null then raise exception 'V22_CREDIT_REFUND_OWNER_MISMATCH'; end if;
  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner.id
    or payment_order.case_id is not null or payment_order.purchase_kind is distinct from 'credit_purchase'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount or payment_order.currency is distinct from p_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or payment_order.payment_id is distinct from p_payment_id then
    raise exception 'V22_CREDIT_REFUND_ORDER_MISMATCH';
  end if;
  select * into purchase from public.credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'credit_purchase';
  select * into reversal from public.credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'purchase_refund_debit';
  select * into review_row from public.credit_purchase_refund_reviews r
    where r.provider_refund_id = p_provider_refund_id;
  resulting_balance := owner.credit_balance;
  if payment_order.status = 'refunded' then
    if payment_order.provider_refund_id is distinct from p_provider_refund_id
      or purchase.id is null or (reversal.id is null and review_row.id is null) then
      raise exception 'V22_CREDIT_REFUND_LEDGER_INVALID';
    end if;
    return query select true, true, reversal.id is not null, review_row.id is not null, resulting_balance;
    return;
  end if;
  if payment_order.status <> 'paid' or purchase.id is null or reversal.id is not null then
    raise exception 'V22_CREDIT_REFUND_STATE_INVALID';
  end if;
  if resulting_balance >= 1 then
    update public.users u set credit_balance = u.credit_balance - 1, updated_at = now()
      where u.id = owner.id returning u.credit_balance into resulting_balance;
    insert into public.credit_ledger (
      user_id, order_id, kind, delta, balance_after, idempotency_key
    ) values (
      owner.id, payment_order.id, 'purchase_refund_debit', -1, resulting_balance,
      'order:' || payment_order.id::text || ':refund'
    );
  else
    insert into public.credit_purchase_refund_reviews (
      provider_refund_id, order_id, payment_id, user_id, checkout_session_id,
      provider_product_id, payment_amount, payment_currency, payment_refund_status,
      reason, refund_amount, refund_currency, is_partial
    ) values (
      p_provider_refund_id, payment_order.id, p_payment_id, owner.id, p_checkout_session_id,
      p_product_id, p_amount, p_currency, 'full', 'credit_already_spent',
      p_amount, p_currency, false
    ) returning * into review_row;
  end if;
  update public.orders set status = 'refunded', provider_refund_id = p_provider_refund_id
    where id = payment_order.id;
  return query select true, false, resulting_balance < owner.credit_balance,
    review_row.id is not null, resulting_balance;
end;
$$;

revoke all on function public.claim_v22_credit_checkout(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_v22_credit_checkout(uuid,text) to service_role;
revoke all on function public.attach_v22_credit_checkout(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.attach_v22_credit_checkout(uuid,uuid,uuid,text,text,text) to service_role;
revoke all on function public.fulfill_v22_credit_payment(uuid,text,text,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.fulfill_v22_credit_payment(uuid,text,text,integer,text,text,text) to service_role;
revoke all on function public.refund_v22_credit_payment(text,uuid,text,text,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.refund_v22_credit_payment(text,uuid,text,text,integer,text,text,text) to service_role;
revoke all on function public.record_v22_credit_refund_review(text,uuid,text,text,integer,text,text,text,text,integer,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.record_v22_credit_refund_review(text,uuid,text,text,integer,text,text,text,text,integer,text,boolean,text)
  to service_role;

comment on function public.claim_v22_credit_checkout(uuid,text) is
  'Serializes account-level one-credit checkout creation and safely reuses or recovers it.';
comment on function public.fulfill_v22_credit_payment(uuid,text,text,integer,text,text,text) is
  'Credits exactly one permanent account credit for an exact bound $19 Dodo payment.';
comment on function public.refund_v22_credit_payment(text,uuid,text,text,integer,text,text,text) is
  'Reverses one unspent purchased credit or records manual review when that credit was already spent.';

commit;
