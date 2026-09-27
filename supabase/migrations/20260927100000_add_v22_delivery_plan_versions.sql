-- SEO-reviewed delivery plans are separate from the immutable generated report.
begin;

create table if not exists public.report_delivery_plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  revision integer not null check (revision > 0),
  source_report_version integer not null check (source_report_version > 0),
  status text not null check (status in ('draft', 'approved')),
  plan jsonb not null check (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) = 3),
  created_at timestamptz not null default now(),
  unique (report_id, revision)
);

create index if not exists idx_report_delivery_plan_versions_latest
  on public.report_delivery_plan_versions (report_id, revision desc);

create or replace function public.save_v22_delivery_plan_version(
  p_user_id uuid,
  p_case_id uuid,
  p_report_id uuid,
  p_expected_revision integer,
  p_source_report_version integer,
  p_status text,
  p_plan jsonb
)
returns public.report_delivery_plan_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision integer;
  saved public.report_delivery_plan_versions;
begin
  if p_status not in ('draft', 'approved')
    or jsonb_typeof(p_plan) is distinct from 'array'
    or jsonb_array_length(p_plan) <> 3 then
    raise exception 'invalid delivery plan';
  end if;

  -- Serializes concurrent saves for this report. The generated JSON is never changed.
  perform 1 from public.reports r
  where r.id = p_report_id and r.user_id = p_user_id and r.case_id = p_case_id
    and r.report_v2_2 is not null
    and (r.report_v2_2 #>> '{report_version,version_number}')::integer = p_source_report_version
  for update;
  if not found then raise exception 'report does not belong to user and case'; end if;

  select coalesce(max(revision), 0) into current_revision
  from public.report_delivery_plan_versions where report_id = p_report_id;
  if current_revision <> p_expected_revision then
    raise exception 'delivery plan has changed' using errcode = '40001';
  end if;

  insert into public.report_delivery_plan_versions
    (user_id, case_id, report_id, revision, source_report_version, status, plan)
  values
    (p_user_id, p_case_id, p_report_id, current_revision + 1,
     p_source_report_version, p_status, p_plan)
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.reject_v22_delivery_plan_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'delivery plan versions are immutable';
end;
$$;

create trigger report_delivery_plan_versions_immutable
  before update on public.report_delivery_plan_versions
  for each row execute function public.reject_v22_delivery_plan_mutation();

alter table public.report_delivery_plan_versions enable row level security;
revoke all on public.report_delivery_plan_versions from anon, authenticated;
grant select, insert on public.report_delivery_plan_versions to service_role;
revoke all on function public.save_v22_delivery_plan_version(uuid, uuid, uuid, integer, integer, text, jsonb) from public;
grant execute on function public.save_v22_delivery_plan_version(uuid, uuid, uuid, integer, integer, text, jsonb) to service_role;

alter table public.report_shares
  add column if not exists delivery_plan_version_id uuid references public.report_delivery_plan_versions(id);

create or replace function public.rotate_v22_report_share(
  p_user_id uuid,
  p_case_id uuid,
  p_report_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_delivery_plan_version_id uuid
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
  perform 1 from public.reports r
  where r.id = p_report_id and r.user_id = p_user_id and r.case_id = p_case_id
    and r.report_v2_2 is not null for update;
  if not found then raise exception 'report share target does not belong to user and case'; end if;
  if p_delivery_plan_version_id is not null and not exists (
    select 1 from public.report_delivery_plan_versions v
    where v.id = p_delivery_plan_version_id and v.report_id = p_report_id
      and v.user_id = p_user_id and v.case_id = p_case_id and v.status = 'approved'
  ) then
    raise exception 'approved delivery plan version not found';
  end if;
  if p_delivery_plan_version_id is distinct from (
    select v.id from public.report_delivery_plan_versions v
    where v.report_id = p_report_id order by v.revision desc limit 1
  ) then
    raise exception 'delivery plan changed before sharing' using errcode = '40001';
  end if;
  update public.report_shares set revoked_at = coalesce(revoked_at, now())
  where report_id = p_report_id and revoked_at is null;
  insert into public.report_shares
    (user_id, case_id, report_id, token_hash, view_mode, expires_at, delivery_plan_version_id)
  values
    (p_user_id, p_case_id, p_report_id, p_token_hash, 'client', p_expires_at, p_delivery_plan_version_id)
  returning id into created_share_id;
  return created_share_id;
end;
$$;

revoke all on function public.rotate_v22_report_share(uuid, uuid, uuid, text, timestamptz, uuid) from public;
grant execute on function public.rotate_v22_report_share(uuid, uuid, uuid, text, timestamptz, uuid) to service_role;

commit;
