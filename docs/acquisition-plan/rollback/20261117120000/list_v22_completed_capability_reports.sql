-- Original production definition; restore original ACL.
CREATE OR REPLACE FUNCTION public.list_v22_completed_capability_reports(p_user_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, case_id uuid, business_name text, site_url text, market text, service text, report_type text, version integer, generated_at timestamp with time zone, delivery_revision integer, delivery_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$function$
;
