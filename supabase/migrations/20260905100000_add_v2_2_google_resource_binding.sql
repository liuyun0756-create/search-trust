-- V22-051. Existing production Case/connection/binding tables; no new columns.
-- Apply before the resource-selection routes. Browser roles cannot execute RPCs.
begin;

create or replace function public.select_v22_google_resource(
  p_user_id uuid, p_case_id uuid, p_connection_id uuid, p_source text,
  p_resource_id text, p_resource_name text, p_parent text, p_expected_binding_id uuid
) returns public.case_source_bindings
language plpgsql security definer set search_path = public as $$
declare
  c public.google_connections;
  active_id uuid;
  result public.case_source_bindings;
  required_scope text;
begin
  -- Lock connection before Case: revocation holds the same connection lock.
  select * into c from public.google_connections
    where id = p_connection_id and user_id = p_user_id for update;
  if not found or c.status <> 'active' then raise exception 'RESOURCE_FORBIDDEN' using errcode = '42501'; end if;
  perform 1 from public.client_cases where id = p_case_id and user_id = p_user_id and status = 'active' for update;
  if not found then raise exception 'RESOURCE_FORBIDDEN' using errcode = '42501'; end if;
  required_scope := case p_source
    when 'gsc' then 'https://www.googleapis.com/auth/webmasters.readonly'
    when 'ga4' then 'https://www.googleapis.com/auth/analytics.readonly'
    when 'gbp' then 'https://www.googleapis.com/auth/business.manage' end;
  if required_scope is null or not (c.granted_scopes @> array['openid','email','profile',required_scope]) then
    raise exception 'RESOURCE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_resource_id is null or btrim(p_resource_id) = '' or length(p_resource_id) > 2048
     or p_resource_name is null or btrim(p_resource_name) = '' or length(p_resource_name) > 2048 then
    raise exception 'INVALID_RESOURCE' using errcode = '22023';
  end if;
  select id into active_id from public.case_source_bindings where case_id = p_case_id and source_type = p_source and is_active;
  if active_id is distinct from p_expected_binding_id then raise exception 'BINDING_CHANGED' using errcode = '40001'; end if;
  -- Preserve old binding IDs for immutable snapshots and report history.
  update public.case_source_bindings set is_active = false, disconnected_at = now(), health_status = 'unavailable'
    where id = active_id;
  insert into public.case_source_bindings (
    case_id, connection_id, source_type, external_resource_id, external_resource_name,
    identity_match_status, identity_match_evidence, health_status, confirmed_by_user_id, confirmed_at
  ) values (
    p_case_id, p_connection_id, p_source, p_resource_id, p_resource_name,
    'needs_confirmation', jsonb_build_object('selection_method','user_selected','parent_resource_id',p_parent),
    'not_checked', p_user_id, now()
  ) returning * into result;
  return result;
end; $$;

create or replace function public.disconnect_v22_google_resource(p_user_id uuid, p_case_id uuid, p_binding_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.client_cases where id = p_case_id and user_id = p_user_id for update;
  if not found then raise exception 'RESOURCE_FORBIDDEN' using errcode = '42501'; end if;
  -- Target the explicit binding ID: a stale disconnect cannot remove its replacement.
  update public.case_source_bindings set is_active = false, disconnected_at = now(), health_status = 'unavailable'
    where id = p_binding_id and case_id = p_case_id and is_active;
end; $$;

create or replace function public.deactivate_v22_google_bindings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('reauth_required','revoked','deleted') then
    update public.case_source_bindings set is_active = false, disconnected_at = now(), health_status = 'unavailable'
      where connection_id = new.id and is_active;
  end if;
  return new;
end; $$;
drop trigger if exists deactivate_v22_google_bindings on public.google_connections;
create trigger deactivate_v22_google_bindings after update of status on public.google_connections
for each row execute function public.deactivate_v22_google_bindings();

revoke all on function public.select_v22_google_resource(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.disconnect_v22_google_resource(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.deactivate_v22_google_bindings() from public,anon,authenticated;
grant execute on function public.select_v22_google_resource(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.disconnect_v22_google_resource(uuid,uuid,uuid) to service_role;
commit;

-- Verify: select proname from pg_proc where proname in
-- ('select_v22_google_resource','disconnect_v22_google_resource','deactivate_v22_google_bindings');
-- Rollback (disable resource-selection routes first; keeps all binding/history data):
-- begin;
-- drop trigger if exists deactivate_v22_google_bindings on public.google_connections;
-- drop function if exists public.deactivate_v22_google_bindings();
-- drop function if exists public.disconnect_v22_google_resource(uuid,uuid,uuid);
-- drop function if exists public.select_v22_google_resource(uuid,uuid,uuid,text,text,text,text,uuid);
-- commit;
