-- V22-052. Apply before frontend deployment. Reuses binding evidence/audit columns.
begin;

create or replace function public.select_v22_matched_google_resource(
  p_user_id uuid, p_case_id uuid, p_connection_id uuid, p_source text,
  p_resource_id text, p_resource_name text, p_parent text, p_expected_binding_id uuid,
  p_case_updated_at timestamptz, p_assessment jsonb, p_confirmation_method text
) returns public.case_source_bindings
language plpgsql security definer set search_path = public as $$
declare
  case_revision timestamptz;
  result public.case_source_bindings;
begin
  -- Same order as resource selection and token revocation: connection, Case, binding.
  perform 1 from public.google_connections where id=p_connection_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'RESOURCE_FORBIDDEN' using errcode='42501'; end if;
  select updated_at into case_revision from public.client_cases
    where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'RESOURCE_FORBIDDEN' using errcode='42501'; end if;
  if p_case_updated_at is null or case_revision is distinct from p_case_updated_at then
    raise exception 'IDENTITY_CHANGED' using errcode='P0052';
  end if;
  -- Only the server evaluator can supply this payload. Browser roles have no RPC grant.
  if p_assessment is null or jsonb_typeof(p_assessment) is distinct from 'object'
    or (p_assessment->>'version') is distinct from 'v22-052.1'
    or jsonb_typeof(p_assessment->'reasons') is distinct from 'array' then
    raise exception 'INVALID_IDENTITY_ASSESSMENT' using errcode='22023';
  end if;
  if not coalesce(
    (p_confirmation_method='automatic' and p_assessment->>'status'='matched' and p_assessment->>'confidence'='high')
    or (p_confirmation_method='user_confirmed' and p_assessment->>'status'='needs_confirmation' and p_assessment->>'confidence' in ('medium','low')),
    false
  ) then raise exception 'INVALID_IDENTITY_CONFIRMATION' using errcode='22023'; end if;

  select * into result from public.select_v22_google_resource(
    p_user_id,p_case_id,p_connection_id,p_source,p_resource_id,p_resource_name,p_parent,p_expected_binding_id);
  update public.case_source_bindings set identity_match_status='matched',
    identity_match_evidence=jsonb_build_object(
      'version',p_assessment->>'version','assessment_status',p_assessment->>'status',
      'confidence',p_assessment->>'confidence','reasons',p_assessment->'reasons',
      'confirmation_method',p_confirmation_method,'evaluated_at',now(),
      'case_updated_at',case_revision,'parent_resource_id',p_parent),
    confirmed_by_user_id=p_user_id,confirmed_at=now()
    where id=result.id returning * into result;
  return result;
end; $$;

create or replace function public.invalidate_v22_google_identity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if row(new.site_url,new.normalized_domain,new.business_name,new.business_identity,new.operating_model,new.target_market)
    is distinct from row(old.site_url,old.normalized_domain,old.business_name,old.business_identity,old.operating_model,old.target_market) then
    update public.case_source_bindings set identity_match_status='needs_confirmation',
      identity_match_evidence=jsonb_build_object('version','v22-052.1','invalidation_reason','case_identity_changed','invalidated_at',now(),
        'previous_assessment',identity_match_evidence - 'previous_assessment',
        'previous_confirmation',jsonb_build_object('user_id',confirmed_by_user_id,'confirmed_at',confirmed_at)),
      confirmed_by_user_id=null,confirmed_at=null
      where case_id=new.id and is_active and (identity_match_status <> 'needs_confirmation' or confirmed_at is not null);
  end if;
  return new;
end; $$;
create trigger invalidate_v22_google_identity after update of site_url,normalized_domain,business_name,business_identity,operating_model,target_market
on public.client_cases for each row execute function public.invalidate_v22_google_identity();

revoke all on function public.select_v22_matched_google_resource(uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,jsonb,text) from public,anon,authenticated;
revoke all on function public.invalidate_v22_google_identity() from public,anon,authenticated;
grant execute on function public.select_v22_matched_google_resource(uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,jsonb,text) to service_role;
commit;

-- Verify: select proname from pg_proc where proname='select_v22_matched_google_resource';
-- Rollback: disable matching routes first; preserves all binding/history rows.
-- begin;
-- drop trigger if exists invalidate_v22_google_identity on public.client_cases;
-- drop function if exists public.invalidate_v22_google_identity();
-- drop function if exists public.select_v22_matched_google_resource(uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,jsonb,text);
-- commit;
