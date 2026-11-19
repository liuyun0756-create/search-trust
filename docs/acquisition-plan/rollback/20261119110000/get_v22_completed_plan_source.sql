CREATE OR REPLACE FUNCTION public.get_v22_completed_plan_source(p_user_id uuid, p_case_id uuid, p_report_id uuid)
 RETURNS SETOF capability_report_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.capability_report_versions; full_report jsonb;
begin
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null then return; end if;
  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
    return query select * from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  elsif r.schema_version='2.2.3' then
    full_report=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
    if full_report is null or full_report->'report' is distinct from r.payload
      or full_report->>'payload_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
    r.payload=public.v22_review_plan_basis(r.payload);
    return next r;
  end if;
end; $function$;
