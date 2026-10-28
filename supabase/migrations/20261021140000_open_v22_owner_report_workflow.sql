-- Owner report workspace and reviewed revisions. No entry switch or charge.
begin;

create function public.list_v22_completed_capability_reports(p_user_id uuid)
returns table(id uuid, user_id uuid, case_id uuid, business_name text, site_url text,
  market text, service text, report_type text, version integer, generated_at timestamptz,
  delivery_revision integer, delivery_status text)
language sql stable security definer set search_path=public as $$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',
    r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',
    r.payload->>'report_type',(r.payload->>'version')::integer,(r.payload->>'generated_at')::timestamptz,
    coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral (select revision,status from public.report_content_revisions
    where report_id=r.id and user_id=r.user_id and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$$;

create function public.save_v22_completed_report_revision(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_content jsonb)
returns public.report_content_revisions
language plpgsql security definer set search_path=public as $$
declare saved public.report_content_revisions;
begin
  -- Completion is immutable. The core locks the report for optimistic revision checks.
  if not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id)) then
    raise exception 'CAPABILITY_REPORT_NOT_FOUND';
  end if;
  select * into saved from public.save_v22_report_content_revision(p_user_id,p_case_id,p_report_id,p_content);
  return saved;
end;
$$;

revoke all on function public.list_v22_completed_capability_reports(uuid) from public,anon,authenticated;
revoke all on function public.save_v22_completed_report_revision(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.list_v22_completed_capability_reports(uuid) to service_role;
grant execute on function public.save_v22_completed_report_revision(uuid,uuid,uuid,jsonb) to service_role;
-- Server callers cannot bypass completed entitlement through the old primitive.
revoke execute on function public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb) from service_role;
commit;
