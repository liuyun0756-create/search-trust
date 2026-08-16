-- SearchTrust baseline schema.
-- This migration intentionally creates structure only; legacy user data is not migrated.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id varchar(255) not null unique,
  email varchar(255) not null,
  name varchar(255),
  audit_credits integer not null default 5 check (audit_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_clerk_id on public.users (clerk_user_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_id varchar(100) not null unique,
  external_report_id varchar(255),
  user_id uuid not null references public.users(id) on delete cascade,
  page_url text not null,
  page_type varchar(100),
  gbp_url text not null,
  gbp_connected boolean,
  task_id varchar(255),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'free_preview', 'paid_full', 'failed')),
  access_type varchar(20) not null
    check (access_type in ('free_trial', 'paid_credit', 'unlocked')),
  completed_at timestamptz,
  trust_status text,
  ranking_potential text,
  risk_level text,
  generated_at text,
  module_1_overview jsonb,
  module_2_page_level jsonb,
  module_3_key_problems jsonb,
  module_4_eight_layers jsonb,
  module_5_optimization jsonb,
  error_code text,
  error_message text,
  user_message text,
  retryable boolean,
  validation_errors text[],
  warnings text[],
  failure_reason text,
  created_at timestamptz not null default now()
);

create index idx_reports_user_id on public.reports (user_id);
create index idx_reports_created_at on public.reports (created_at desc);
create index idx_reports_task_id on public.reports (task_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  payment_id varchar(255) unique,
  order_id varchar(255) unique,
  amount integer not null check (amount >= 0),
  currency varchar(10) default 'USD',
  credits_purchased integer not null default 1 check (credits_purchased > 0),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint orders_payment_reference_check
    check (payment_id is not null or order_id is not null)
);

create index idx_orders_user_id on public.orders (user_id);

-- Clerk is the identity provider, so browser clients never query these tables directly.
-- RLS provides a second line of defense; the server-only service role bypasses RLS.
alter table public.users enable row level security;
alter table public.reports enable row level security;
alter table public.orders enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.reports to service_role;
grant select, insert, update, delete on table public.orders to service_role;

revoke all on table public.users from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
