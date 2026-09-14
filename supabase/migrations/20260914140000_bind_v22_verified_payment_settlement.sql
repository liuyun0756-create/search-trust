-- Bind every Verified credit settlement to the exact Dodo checkout and product.
-- Also make a late payment.succeeded delivery safe after the same payment was refunded.
begin;

alter table public.orders
  add column provider_product_id text;

drop function public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text);
drop function public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text);

create function public.fulfill_v22_verified_credit_payment(
  p_local_order_id uuid, p_payment_id text, p_clerk_user_id text,
  p_case_id uuid, p_amount integer, p_currency text,
  p_checkout_session_id text, p_product_id text
)
returns table (fulfilled boolean, idempotent boolean, credits_added integer, audit_credits integer)
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
  payment_order public.orders;
  resulting_balance integer;
  purchase public.audit_credit_ledger;
  reversal public.audit_credit_ledger;
  reversal_count integer;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount is distinct from 1900
    or p_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'V22_VERIFIED_PAYMENT_INVALID';
  end if;

  select c.user_id into owner_id from public.client_cases c
    where c.id = p_case_id for no key update;
  if owner_id is null then raise exception 'V22_VERIFIED_PAYMENT_CASE_INVALID'; end if;

  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount
    or payment_order.currency is distinct from p_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or (payment_order.payment_id is not null and payment_order.payment_id is distinct from p_payment_id) then
    raise exception 'V22_VERIFIED_PAYMENT_ORDER_MISMATCH';
  end if;

  select u.audit_credits into resulting_balance from public.users u
    where u.id = owner_id and u.clerk_user_id = p_clerk_user_id for update;
  if not found then raise exception 'V22_VERIFIED_PAYMENT_OWNER_MISMATCH'; end if;

  select * into purchase from public.audit_credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'purchase_credit';
  select * into reversal from public.audit_credit_ledger l
    where l.order_id = payment_order.id
      and l.kind in ('payment_refund_debit', 'payment_refund_manual_review');
  select count(*) into reversal_count from public.audit_credit_ledger l
    where l.order_id = payment_order.id
      and l.kind in ('payment_refund_debit', 'payment_refund_manual_review');

  if payment_order.status = 'paid' then
    if purchase.id is null or purchase.user_id is distinct from owner_id
      or purchase.case_id is distinct from p_case_id or purchase.job_id is not null
      or purchase.delta is distinct from 1 or reversal_count <> 0 then
      raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, 0, resulting_balance;
    return;
  end if;

  if payment_order.status = 'refunded' then
    if payment_order.payment_id is distinct from p_payment_id
      or purchase.id is null or purchase.user_id is distinct from owner_id
      or purchase.case_id is distinct from p_case_id or purchase.job_id is not null
      or purchase.delta is distinct from 1
      or reversal_count <> 1 or reversal.id is null or reversal.user_id is distinct from owner_id
      or reversal.case_id is distinct from p_case_id or reversal.job_id is not null
      or reversal.delta is distinct from
        (case when reversal.kind = 'payment_refund_debit' then -1 else 0 end) then
      raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, 0, resulting_balance;
    return;
  end if;

  if payment_order.status not in ('pending', 'failed')
    or purchase.id is not null or reversal.id is not null then
    raise exception 'V22_VERIFIED_PAYMENT_STATE_INVALID';
  end if;

  update public.orders set status = 'paid', payment_id = p_payment_id,
    paid_at = coalesce(paid_at, now()) where id = payment_order.id;
  update public.users u set audit_credits = u.audit_credits + 1
    where u.id = owner_id returning u.audit_credits into resulting_balance;
  insert into public.audit_credit_ledger (user_id,case_id,order_id,kind,delta,balance_after)
    values (owner_id,p_case_id,payment_order.id,'purchase_credit',1,resulting_balance);
  return query select true, false, 1, resulting_balance;
end;
$$;

create function public.refund_v22_verified_credit_payment(
  p_local_order_id uuid, p_payment_id text, p_clerk_user_id text,
  p_case_id uuid, p_amount integer, p_currency text,
  p_checkout_session_id text, p_product_id text
)
returns table (refunded boolean, idempotent boolean, reversal_applied boolean,
  manual_review boolean, audit_credits integer)
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
  payment_order public.orders;
  resulting_balance integer;
  purchase public.audit_credit_ledger;
  reversal public.audit_credit_ledger;
  reversal_kind text;
  reversal_count integer;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount is distinct from 1900
    or p_currency is distinct from 'USD'
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'V22_VERIFIED_PAYMENT_INVALID';
  end if;

  select c.user_id into owner_id from public.client_cases c
    where c.id = p_case_id for no key update;
  if owner_id is null then raise exception 'V22_VERIFIED_PAYMENT_CASE_INVALID'; end if;

  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount
    or payment_order.currency is distinct from p_currency
    or payment_order.checkout_session_id is distinct from p_checkout_session_id
    or payment_order.provider_product_id is distinct from p_product_id
    or payment_order.payment_id is distinct from p_payment_id then
    raise exception 'V22_VERIFIED_PAYMENT_ORDER_MISMATCH';
  end if;

  select u.audit_credits into resulting_balance from public.users u
    where u.id = owner_id and u.clerk_user_id = p_clerk_user_id for update;
  if not found then raise exception 'V22_VERIFIED_PAYMENT_OWNER_MISMATCH'; end if;

  select * into purchase from public.audit_credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'purchase_credit';
  if purchase.id is null or purchase.user_id is distinct from owner_id
    or purchase.case_id is distinct from p_case_id or purchase.job_id is not null
    or purchase.delta is distinct from 1 then
    raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
  end if;
  select * into reversal from public.audit_credit_ledger l where l.order_id = payment_order.id
    and l.kind in ('payment_refund_debit', 'payment_refund_manual_review');
  select count(*) into reversal_count from public.audit_credit_ledger l where l.order_id = payment_order.id
    and l.kind in ('payment_refund_debit', 'payment_refund_manual_review');

  if payment_order.status = 'refunded' then
    if reversal_count <> 1 or reversal.id is null or reversal.user_id is distinct from owner_id
      or reversal.case_id is distinct from p_case_id or reversal.job_id is not null
      or reversal.delta is distinct from
        (case when reversal.kind = 'payment_refund_debit' then -1 else 0 end) then
      raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, reversal.kind = 'payment_refund_debit',
      reversal.kind = 'payment_refund_manual_review', resulting_balance;
    return;
  end if;

  if payment_order.status <> 'paid' or reversal_count <> 0 then
    raise exception 'V22_VERIFIED_PAYMENT_STATE_INVALID';
  end if;
  if resulting_balance >= 1 then
    update public.users u set audit_credits = u.audit_credits - 1
      where u.id = owner_id returning u.audit_credits into resulting_balance;
    reversal_kind := 'payment_refund_debit';
  else
    reversal_kind := 'payment_refund_manual_review';
  end if;
  insert into public.audit_credit_ledger (user_id,case_id,order_id,kind,delta,balance_after)
    values (owner_id,p_case_id,payment_order.id,reversal_kind,
      case when reversal_kind = 'payment_refund_debit' then -1 else 0 end,resulting_balance);
  update public.orders set status = 'refunded' where id = payment_order.id;
  return query select true, false, reversal_kind = 'payment_refund_debit',
    reversal_kind = 'payment_refund_manual_review', resulting_balance;
end;
$$;

revoke all on function public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)
  from public, anon, authenticated;
grant execute on function public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)
  to service_role;
revoke all on function public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)
  from public, anon, authenticated;
grant execute on function public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text,text,text)
  to service_role;

comment on column public.orders.provider_product_id is
  'Server-selected provider product bound to a Verified credit checkout before payment.';
comment on function public.fulfill_v22_verified_credit_payment is
  'Atomically verifies owner, Case, amount, currency, checkout session and product; refunded replay is a zero-credit success.';
comment on function public.refund_v22_verified_credit_payment is
  'Reverses one exact fully-refunded Verified purchase or records immutable manual review when the credit was spent.';

commit;
