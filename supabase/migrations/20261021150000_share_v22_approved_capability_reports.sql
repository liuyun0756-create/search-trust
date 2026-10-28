begin;
create table public.capability_report_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  report_id uuid not null references public.capability_report_versions(id) on delete cascade,
  revision_id uuid not null references public.report_content_revisions(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  revoked_at timestamptz,
  check(expires_at>created_at)
);
alter table public.capability_report_shares enable row level security;
revoke all on public.capability_report_shares from public,anon,authenticated,service_role;
create index capability_shares_owner_report on public.capability_report_shares(user_id,case_id,report_id,created_at);

create function public.create_v22_capability_share(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_revision_id uuid,p_token_hash text)
returns public.capability_report_shares language plpgsql security definer set search_path=public as $$
declare latest public.report_content_revisions; saved public.capability_report_shares;
begin
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found or not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id)) then raise exception 'CAPABILITY_REPORT_NOT_FOUND'; end if;
  select * into latest from public.report_content_revisions where report_id=p_report_id and user_id=p_user_id and case_id=p_case_id order by revision desc limit 1;
  if latest.id is distinct from p_revision_id or latest.status is distinct from 'approved' then
    raise exception 'CAPABILITY_APPROVAL_CHANGED' using errcode='40001';
  end if;
  if (select count(*) from public.capability_report_shares where report_id=p_report_id and revoked_at is null and expires_at>now())>=20 then
    raise exception 'CAPABILITY_SHARE_LIMIT';
  end if;
  insert into public.capability_report_shares(user_id,case_id,report_id,revision_id,token_hash)
    values(p_user_id,p_case_id,p_report_id,p_revision_id,p_token_hash) returning * into saved;
  return saved;
end;
$$;
create function public.list_v22_capability_shares(p_user_id uuid,p_case_id uuid,p_report_id uuid)
returns table(id uuid,revision_id uuid,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz)
language sql stable security definer set search_path=public as $$
  select s.id,s.revision_id,s.created_at,s.expires_at,s.revoked_at from public.capability_report_shares s
  where s.user_id=p_user_id and s.case_id=p_case_id and s.report_id=p_report_id
    and exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id))
  order by s.created_at desc,s.id;
$$;
create function public.revoke_v22_capability_share(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_share_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.capability_report_shares set revoked_at=coalesce(revoked_at,now())
    where id=p_share_id and user_id=p_user_id and case_id=p_case_id and report_id=p_report_id;
  return found;
end;
$$;
create function public.resolve_v22_capability_share(p_token_hash text)
returns setof public.capability_report_shares language sql stable security definer set search_path=public as $$
  select s.* from public.capability_report_shares s
  join public.report_content_revisions v on v.id=s.revision_id and v.report_id=s.report_id and v.case_id=s.case_id and v.user_id=s.user_id and v.status='approved'
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>now()
    and exists(select 1 from public.get_v22_completed_capability_report(s.user_id,s.case_id,s.report_id));
$$;
create function public.guard_v22_capability_share() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then
    if pg_trigger_depth()>1 then return old; end if;
    raise exception 'CAPABILITY_SHARE_IMMUTABLE';
  end if;
  if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at')
    or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
    or new.revoked_at is null then raise exception 'CAPABILITY_SHARE_IMMUTABLE'; end if;
  return new;
end;
$$;
create trigger immutable_capability_share before update or delete on public.capability_report_shares
  for each row execute function public.guard_v22_capability_share();

revoke all on function public.create_v22_capability_share(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.list_v22_capability_shares(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.revoke_v22_capability_share(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.resolve_v22_capability_share(text) from public,anon,authenticated;
grant execute on function public.create_v22_capability_share(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.list_v22_capability_shares(uuid,uuid,uuid) to service_role;
grant execute on function public.revoke_v22_capability_share(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.resolve_v22_capability_share(text) to service_role;
commit;
