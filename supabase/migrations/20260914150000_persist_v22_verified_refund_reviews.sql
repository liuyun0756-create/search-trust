begin;

create table public.verified_credit_refund_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_refund_id text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id text not null,
  user_id uuid not null references public.users(id) on delete restrict,
  case_id uuid not null references public.client_cases(id) on delete restrict,
  checkout_session_id text not null,
  provider_product_id text not null,
  payment_amount integer not null,
  payment_currency text not null,
  payment_refund_status text,
  reason text not null,
  refund_amount integer,
  refund_currency text,
  is_partial boolean not null,
  status text not null default 'manual_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_credit_refund_reviews_provider_refund_check
    check (btrim(provider_refund_id) <> ''),
  constraint verified_credit_refund_reviews_payment_check
    check (btrim(payment_id) <> '' and payment_amount = 1900 and payment_currency = 'USD'),
  constraint verified_credit_refund_reviews_binding_check
    check (btrim(checkout_session_id) <> '' and btrim(provider_product_id) <> ''),
  constraint verified_credit_refund_reviews_reason_check
    check (reason in ('partial_refund','amount_mismatch','currency_mismatch','payment_refund_status_mismatch')),
  constraint verified_credit_refund_reviews_refund_check
    check ((refund_amount is null or refund_amount >= 0)
      and (refund_currency is null or btrim(refund_currency) <> '')),
  constraint verified_credit_refund_reviews_status_check check (status = 'manual_review')
);

create index ix_verified_credit_refund_reviews_order
  on public.verified_credit_refund_reviews(order_id, created_at desc);

alter table public.verified_credit_refund_reviews enable row level security;
revoke all on table public.verified_credit_refund_reviews from public, anon, authenticated;
grant all on table public.verified_credit_refund_reviews to service_role;

create function public.record_v22_verified_credit_refund_review(
  p_provider_refund_id text,
  p_local_order_id uuid,
  p_payment_id text,
  p_clerk_user_id text,
  p_case_id uuid,
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
  owner_id uuid;
  payment_order public.orders;
  review_row public.verified_credit_refund_reviews;
  inserted boolean;
begin
  if btrim(coalesce(p_provider_refund_id, '')) = ''
    or btrim(coalesce(p_payment_id, '')) = ''
    or btrim(coalesce(p_clerk_user_id, '')) = ''
    or p_payment_amount is distinct from 1900
    or p_payment_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = ''
    or p_reason is null
    or p_reason not in ('partial_refund','amount_mismatch','currency_mismatch','payment_refund_status_mismatch')
    or p_is_partial is null
    or (p_refund_amount is not null and p_refund_amount < 0)
    or (p_refund_currency is not null and btrim(p_refund_currency) = '')
    or (p_payment_refund_status is not null and p_payment_refund_status not in ('partial','full')) then
    raise exception 'V22_VERIFIED_REFUND_REVIEW_INVALID';
  end if;

  if (p_reason = 'partial_refund' and not p_is_partial)
    or (p_reason = 'amount_mismatch' and
      (p_is_partial or p_refund_amount is not distinct from p_payment_amount))
    or (p_reason = 'currency_mismatch' and
      (p_is_partial or p_refund_amount is distinct from p_payment_amount
        or p_refund_currency is not distinct from p_payment_currency))
    or (p_reason = 'payment_refund_status_mismatch' and
      (p_is_partial or p_refund_amount is distinct from p_payment_amount
        or p_refund_currency is distinct from p_payment_currency
        or p_payment_refund_status is not distinct from 'full')) then
    raise exception 'V22_VERIFIED_REFUND_REVIEW_REASON_INVALID';
  end if;

  select c.user_id into owner_id from public.client_cases c
    where c.id = p_case_id for no key update;
  if owner_id is null then raise exception 'V22_VERIFIED_REFUND_REVIEW_CASE_INVALID'; end if;

  select * into payment_order from public.orders o
    where o.id = p_local_order_id for update;
  if payment_order.id is null
    or payment_order.user_id is distinct from owner_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_payment_amount
    or payment_order.currency is distinct from p_payment_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or (payment_order.payment_id is not null and payment_order.payment_id is distinct from p_payment_id)
    or payment_order.status not in ('pending','failed','paid','refunded') then
    raise exception 'V22_VERIFIED_REFUND_REVIEW_ORDER_MISMATCH';
  end if;

  perform 1 from public.users u where u.id = owner_id
    and u.clerk_user_id = p_clerk_user_id for update;
  if not found then raise exception 'V22_VERIFIED_REFUND_REVIEW_OWNER_MISMATCH'; end if;

  if payment_order.payment_id is null then
    update public.orders o set payment_id = p_payment_id where o.id = payment_order.id;
  end if;

  insert into public.verified_credit_refund_reviews (
    provider_refund_id,order_id,payment_id,user_id,case_id,checkout_session_id,
    provider_product_id,payment_amount,payment_currency,payment_refund_status,
    reason,refund_amount,refund_currency,is_partial
  ) values (
    p_provider_refund_id,payment_order.id,p_payment_id,owner_id,p_case_id,p_checkout_session_id,
    p_product_id,p_payment_amount,p_payment_currency,p_payment_refund_status,
    p_reason,p_refund_amount,p_refund_currency,p_is_partial
  ) on conflict (provider_refund_id) do nothing returning * into review_row;
  inserted := found;

  if not inserted then
    select * into review_row from public.verified_credit_refund_reviews r
      where r.provider_refund_id = p_provider_refund_id for update;
    if review_row.id is null
      or review_row.order_id is distinct from payment_order.id
      or review_row.payment_id is distinct from p_payment_id
      or review_row.user_id is distinct from owner_id
      or review_row.case_id is distinct from p_case_id
      or review_row.checkout_session_id is distinct from p_checkout_session_id
      or review_row.provider_product_id is distinct from p_product_id
      or review_row.payment_amount is distinct from p_payment_amount
      or review_row.payment_currency is distinct from p_payment_currency
      or review_row.payment_refund_status is distinct from p_payment_refund_status
      or review_row.reason is distinct from p_reason
      or review_row.refund_amount is distinct from p_refund_amount
      or review_row.refund_currency is distinct from p_refund_currency
      or review_row.is_partial is distinct from p_is_partial
      or review_row.status is distinct from 'manual_review' then
      raise exception 'V22_VERIFIED_REFUND_REVIEW_REPLAY_MISMATCH';
    end if;
    update public.verified_credit_refund_reviews r set updated_at = now()
      where r.id = review_row.id returning * into review_row;
  end if;

  return query select review_row.id, not inserted, 'manual_review'::text, p_reason;
end;
$$;

revoke all on function public.record_v22_verified_credit_refund_review(
  text,uuid,text,text,uuid,integer,text,text,text,text,integer,text,boolean,text
) from public, anon, authenticated;
grant execute on function public.record_v22_verified_credit_refund_review(
  text,uuid,text,text,uuid,integer,text,text,text,text,integer,text,boolean,text
) to service_role;

comment on table public.verified_credit_refund_reviews is
  'Restricted, durable queue of non-exact Verified-credit refunds requiring operator review.';
comment on function public.record_v22_verified_credit_refund_review is
  'Validates the frozen order/payment/session/product tuple and idempotently records a refund review.';

commit;
