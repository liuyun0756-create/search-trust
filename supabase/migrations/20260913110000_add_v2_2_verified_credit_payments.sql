-- A Verified checkout buys one account credit; payment never starts a job.
begin;

alter table public.orders
  drop constraint orders_purchase_kind_check,
  drop constraint orders_purchase_shape_check,
  drop constraint orders_payment_reference_check,
  add constraint orders_purchase_kind_check check (
    purchase_kind in ('legacy_credit', 'case_prospect_report', 'case_verified_credit')
  ),
  add constraint orders_purchase_shape_check check (
    (purchase_kind = 'legacy_credit' and case_id is null and credits_purchased > 0) or
    (purchase_kind = 'case_prospect_report' and case_id is not null and credits_purchased = 0) or
    (purchase_kind = 'case_verified_credit' and case_id is not null
      and credits_purchased = 1 and amount = 1900 and currency = 'USD')
  ),
  add constraint orders_payment_reference_check check (
    (purchase_kind = 'case_verified_credit' and
      (status in ('pending', 'failed') or payment_id is not null)) or
    (purchase_kind <> 'case_verified_credit' and
      (payment_id is not null or order_id is not null or checkout_session_id is not null or
        (purchase_kind = 'case_prospect_report' and status in ('pending', 'failed'))))
  );

create unique index uq_orders_pending_case_verified_credit_checkout
  on public.orders (case_id)
  where purchase_kind = 'case_verified_credit' and status = 'pending';

alter table public.audit_credit_ledger
  add column order_id uuid references public.orders(id) on delete restrict,
  drop constraint audit_credit_ledger_kind_check,
  drop constraint audit_credit_ledger_check,
  add constraint audit_credit_ledger_kind_check check (
    kind in ('attempt_debit', 'technical_failure_credit', 'purchase_credit',
      'payment_refund_debit', 'payment_refund_manual_review')
  ),
  add constraint audit_credit_ledger_delta_check check (
    (kind = 'attempt_debit' and delta = -1) or
    (kind = 'technical_failure_credit' and delta = 1) or
    (kind = 'purchase_credit' and delta = 1) or
    (kind = 'payment_refund_debit' and delta = -1) or
    (kind = 'payment_refund_manual_review' and delta = 0)
  ),
  add constraint audit_credit_ledger_order_shape_check check (
    (kind in ('attempt_debit', 'technical_failure_credit') and order_id is null) or
    (kind in ('purchase_credit', 'payment_refund_debit', 'payment_refund_manual_review')
      and order_id is not null and case_id is not null and job_id is null)
  );

create unique index uq_audit_credit_ledger_order_kind
  on public.audit_credit_ledger (order_id, kind) where order_id is not null;

create function public.protect_v22_payment_credit_ledger()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.kind in ('purchase_credit', 'payment_refund_debit', 'payment_refund_manual_review') then
    raise exception 'Verified payment ledger is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.kind in ('purchase_credit', 'payment_refund_debit', 'payment_refund_manual_review') then
    raise exception 'Verified payment ledger is immutable';
  end if;
  return new;
end;
$$;

create trigger protect_v22_payment_credit_ledger
before update or delete on public.audit_credit_ledger
for each row execute function public.protect_v22_payment_credit_ledger();

create function public.fulfill_v22_verified_credit_payment(
  p_local_order_id uuid, p_payment_id text, p_clerk_user_id text,
  p_case_id uuid, p_amount integer, p_currency text
)
returns table (fulfilled boolean, idempotent boolean, credits_added integer, audit_credits integer)
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
  payment_order public.orders;
  resulting_balance integer;
  purchase public.audit_credit_ledger;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount is distinct from 1900
    or p_currency is distinct from 'USD' then
    raise exception 'V22_VERIFIED_PAYMENT_INVALID';
  end if;
  -- Case -> order -> user. NO KEY UPDATE allows compensation's Case FK check
  -- while it holds a job/user lock; neither payment RPC ever locks a job.
  select c.user_id into owner_id from public.client_cases c
    where c.id = p_case_id for no key update;
  if owner_id is null then raise exception 'V22_VERIFIED_PAYMENT_CASE_INVALID'; end if;
  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount or payment_order.currency is distinct from p_currency
    or (payment_order.payment_id is not null and payment_order.payment_id is distinct from p_payment_id) then
    raise exception 'V22_VERIFIED_PAYMENT_ORDER_MISMATCH';
  end if;
  select u.audit_credits into resulting_balance from public.users u
    where u.id = owner_id and u.clerk_user_id = p_clerk_user_id for update;
  if not found then raise exception 'V22_VERIFIED_PAYMENT_OWNER_MISMATCH'; end if;
  select * into purchase from public.audit_credit_ledger l
    where l.order_id = payment_order.id and l.kind = 'purchase_credit';
  if payment_order.status = 'paid' then
    if purchase.id is null or purchase.user_id is distinct from owner_id
      or purchase.case_id is distinct from p_case_id then
      raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, 0, resulting_balance;
    return;
  end if;
  if payment_order.status not in ('pending', 'failed') or purchase.id is not null then
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
  p_case_id uuid, p_amount integer, p_currency text
)
returns table (refunded boolean, idempotent boolean, reversal_applied boolean,
  manual_review boolean, audit_credits integer)
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
  payment_order public.orders;
  resulting_balance integer;
  reversal public.audit_credit_ledger;
  reversal_kind text;
begin
  if btrim(coalesce(p_payment_id, '')) = '' or p_amount is distinct from 1900
    or p_currency is distinct from 'USD' then
    raise exception 'V22_VERIFIED_PAYMENT_INVALID';
  end if;
  -- Match fulfillment's lock order and avoid conflicting with attempt ledger FKs.
  select c.user_id into owner_id from public.client_cases c
    where c.id = p_case_id for no key update;
  if owner_id is null then raise exception 'V22_VERIFIED_PAYMENT_CASE_INVALID'; end if;
  select * into payment_order from public.orders o where o.id = p_local_order_id for update;
  if payment_order.id is null or payment_order.user_id is distinct from owner_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.credits_purchased is distinct from 1
    or payment_order.amount is distinct from p_amount or payment_order.currency is distinct from p_currency
    or payment_order.payment_id is distinct from p_payment_id then
    raise exception 'V22_VERIFIED_PAYMENT_ORDER_MISMATCH';
  end if;
  select u.audit_credits into resulting_balance from public.users u
    where u.id = owner_id and u.clerk_user_id = p_clerk_user_id for update;
  if not found then raise exception 'V22_VERIFIED_PAYMENT_OWNER_MISMATCH'; end if;
  if not exists (select 1 from public.audit_credit_ledger l where l.order_id = payment_order.id
    and l.kind = 'purchase_credit' and l.user_id = owner_id and l.case_id = p_case_id) then
    raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
  end if;
  select * into reversal from public.audit_credit_ledger l where l.order_id = payment_order.id
    and l.kind in ('payment_refund_debit', 'payment_refund_manual_review');
  if payment_order.status = 'refunded' then
    if reversal.id is null or reversal.user_id is distinct from owner_id
      or reversal.case_id is distinct from p_case_id then
      raise exception 'V22_VERIFIED_PAYMENT_LEDGER_INVALID';
    end if;
    return query select true, true, reversal.kind = 'payment_refund_debit',
      reversal.kind = 'payment_refund_manual_review', resulting_balance;
    return;
  end if;
  if payment_order.status <> 'paid' or reversal.id is not null then
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

revoke all on function public.protect_v22_payment_credit_ledger() from public, anon, authenticated;
revoke all on function public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.fulfill_v22_verified_credit_payment(uuid,text,text,uuid,integer,text) to service_role;
revoke all on function public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.refund_v22_verified_credit_payment(uuid,text,text,uuid,integer,text) to service_role;

comment on column public.audit_credit_ledger.order_id is
  'Immutable payment evidence: purchased orders and their owners/Cases cannot be deleted while this ledger is retained.';
comment on function public.refund_v22_verified_credit_payment is
  'Reverses one account credit once, or records immutable manual review when balance is zero. Replay reports the original reversal outcome.';

commit;
