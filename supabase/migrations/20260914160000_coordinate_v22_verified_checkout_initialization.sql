-- Coordinate Verified checkout creation across server instances and recover only stale claims.
begin;

alter table public.orders
  add column checkout_initialization_token uuid,
  add column checkout_initialization_started_at timestamptz;

-- Pre-contract rows without a frozen product can never be settled safely.
update public.orders
set status = 'failed'
where purchase_kind = 'case_verified_credit'
  and status = 'pending'
  and btrim(coalesce(provider_product_id, '')) = '';

update public.orders
set checkout_initialization_token = coalesce(checkout_initialization_token, gen_random_uuid()),
    checkout_initialization_started_at = coalesce(checkout_initialization_started_at, created_at)
where purchase_kind = 'case_verified_credit' and status = 'pending';

alter table public.orders
  add constraint orders_verified_checkout_initialization_check check (
    purchase_kind <> 'case_verified_credit' or status <> 'pending' or (
      checkout_initialization_token is not null
      and checkout_initialization_started_at is not null
      and btrim(coalesce(provider_product_id, '')) <> ''
      and (
        (checkout_session_id is null and checkout_url is null) or
        (checkout_session_id is not null and checkout_url is not null)
      )
    )
  );

create function public.claim_v22_verified_credit_checkout(
  p_user_id uuid,
  p_case_id uuid,
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
  observed_token uuid;
  observed_started_at timestamptz;
  now_at timestamptz := clock_timestamp();
  affected integer;
  retry_seconds integer;
begin
  if btrim(coalesce(p_product_id, '')) = '' or length(p_product_id) > 255 then
    raise exception 'V22_VERIFIED_CHECKOUT_PRODUCT_INVALID';
  end if;

  -- This Case lock serializes claims from every application instance. All V2.2
  -- payment paths use Case -> order, so checkout recovery preserves lock order.
  perform 1 from public.client_cases c
    where c.id = p_case_id and c.user_id = p_user_id and c.status = 'active'
    for no key update;
  if not found then raise exception 'V22_VERIFIED_CHECKOUT_CASE_INVALID'; end if;

  select * into pending_order from public.orders o
    where o.case_id = p_case_id
      and o.purchase_kind = 'case_verified_credit'
      and o.status = 'pending'
    for update;

  if pending_order.id is not null then
    if (pending_order.checkout_session_id is null) <> (pending_order.checkout_url is null)
      or pending_order.checkout_initialization_token is null
      or pending_order.checkout_initialization_started_at is null
      or btrim(coalesce(pending_order.provider_product_id, '')) = '' then
      raise exception 'V22_VERIFIED_CHECKOUT_STATE_INVALID';
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

    observed_token := pending_order.checkout_initialization_token;
    observed_started_at := pending_order.checkout_initialization_started_at;
    update public.orders o set status = 'failed'
      where o.id = pending_order.id
        and o.status = 'pending'
        and o.checkout_session_id is null
        and o.checkout_url is null
        and o.checkout_initialization_token = observed_token
        and o.checkout_initialization_started_at = observed_started_at;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'V22_VERIFIED_CHECKOUT_STALE_CAS_FAILED'; end if;
  end if;

  insert into public.orders (
    user_id, case_id, purchase_kind, amount, currency, credits_purchased, status,
    provider_product_id, checkout_initialization_token, checkout_initialization_started_at
  ) values (
    p_user_id, p_case_id, 'case_verified_credit', 1900, 'USD', 1, 'pending',
    p_product_id, gen_random_uuid(), now_at
  ) returning * into created_order;

  return query select 'create'::text, created_order.id, null::text, null::text,
    created_order.provider_product_id, created_order.checkout_initialization_token, 0;
end;
$$;

create function public.attach_v22_verified_credit_checkout(
  p_user_id uuid,
  p_case_id uuid,
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
declare
  payment_order public.orders;
  affected integer;
begin
  if p_initialization_token is null
    or btrim(coalesce(p_product_id, '')) = ''
    or btrim(coalesce(p_checkout_session_id, '')) = ''
    or length(p_checkout_session_id) > 255
    or btrim(coalesce(p_checkout_url, '')) = ''
    or p_checkout_url !~ '^https://[^[:space:]]+$' then
    raise exception 'V22_VERIFIED_CHECKOUT_ATTACH_INVALID';
  end if;

  perform 1 from public.client_cases c
    where c.id = p_case_id and c.user_id = p_user_id and c.status = 'active'
    for no key update;
  if not found then raise exception 'V22_VERIFIED_CHECKOUT_CASE_INVALID'; end if;

  select * into payment_order from public.orders o where o.id = p_order_id for update;
  if payment_order.id is null
    or payment_order.user_id is distinct from p_user_id
    or payment_order.case_id is distinct from p_case_id
    or payment_order.purchase_kind is distinct from 'case_verified_credit'
    or payment_order.status is distinct from 'pending'
    or payment_order.provider_product_id is distinct from p_product_id
    or payment_order.checkout_initialization_token is distinct from p_initialization_token then
    raise exception 'V22_VERIFIED_CHECKOUT_ATTACH_MISMATCH';
  end if;

  if payment_order.checkout_session_id is not null or payment_order.checkout_url is not null then
    if payment_order.checkout_session_id is distinct from p_checkout_session_id
      or payment_order.checkout_url is distinct from p_checkout_url then
      raise exception 'V22_VERIFIED_CHECKOUT_ATTACH_REPLAY_MISMATCH';
    end if;
    return query select payment_order.checkout_session_id::text, payment_order.checkout_url, true;
    return;
  end if;

  update public.orders o set
      checkout_session_id = p_checkout_session_id,
      checkout_url = p_checkout_url,
      provider_product_id = p_product_id
    where o.id = payment_order.id
      and o.status = 'pending'
      and o.checkout_session_id is null
      and o.checkout_url is null
      and o.provider_product_id = p_product_id
      and o.checkout_initialization_token = p_initialization_token;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'V22_VERIFIED_CHECKOUT_ATTACH_CAS_FAILED'; end if;

  return query select p_checkout_session_id, p_checkout_url, false;
end;
$$;

revoke all on function public.claim_v22_verified_credit_checkout(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.claim_v22_verified_credit_checkout(uuid,uuid,text)
  to service_role;
revoke all on function public.attach_v22_verified_credit_checkout(uuid,uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.attach_v22_verified_credit_checkout(uuid,uuid,uuid,uuid,text,text,text)
  to service_role;

comment on column public.orders.checkout_initialization_token is
  'Opaque CAS token for one cross-instance Verified checkout initialization attempt.';
comment on column public.orders.checkout_initialization_started_at is
  'Database timestamp used for the bounded 60-second stale initialization recovery window.';
comment on function public.claim_v22_verified_credit_checkout is
  'Serializes checkout claims, reports fresh initialization, and replaces only an exact stale empty claim.';
comment on function public.attach_v22_verified_credit_checkout is
  'Atomically binds one Dodo session to the exact live initialization claim; exact replay is idempotent.';

commit;
