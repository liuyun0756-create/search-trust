CREATE OR REPLACE FUNCTION public.enforce_v22_delivery_prerequisites()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare report public.capability_report_versions; item jsonb; entry jsonb; source_action jsonb; dependency jsonb;
  seen text[]='{}'; layer integer=-1; current_layer integer;
begin
  select * into report from public.capability_report_versions where id=new.report_id and case_id=new.case_id and user_id=new.user_id;
  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
    perform public.validate_v22_candidate_selection(report.payload,new.content);
    return new;
  end if;
  if report.payload#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v2' then return new; end if;
  for item in select value from jsonb_array_elements(new.content->'actions') loop
    select value into entry from jsonb_array_elements(report.payload#>'{prioritization,candidates}')
      where value#>>'{input,action_id}'=item->>'id';
    select value into source_action from jsonb_array_elements(report.payload->'actions') where value->>'id'=item->>'id';
    current_layer=case entry->>'prerequisite' when 'access_indexing' then 0 when 'measurement' then 1 when 'none' then 2 else null end;
    if current_layer is null or current_layer<layer or source_action is null then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    for dependency in select value from jsonb_array_elements(source_action->'dependencies') loop
      if not((dependency#>>'{}')=any(seen)) then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    end loop;
    seen=array_append(seen,item->>'id');layer=current_layer;
  end loop;
  return new;
end; $function$;
