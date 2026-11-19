CREATE OR REPLACE FUNCTION public.save_v22_report_content_revision(p_user_id uuid, p_case_id uuid, p_report_id uuid, p_content jsonb)
 RETURNS report_content_revisions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare report public.capability_report_versions; saved public.report_content_revisions;
  current_revision integer; expected_ids text[]; actual_ids text[]; item jsonb; source_action jsonb;
  material jsonb; original jsonb; field text; text_value jsonb;
begin
  select * into report from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_REPORT_NOT_FOUND'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or octet_length(p_content::text)>100000
    or coalesce(p_content->>'schema_version','') not in ('v22_delivery_revision_v1','v22_delivery_revision_v2','v22_delivery_revision_v3')
    or p_content->>'report_id' is distinct from p_report_id::text or p_content->>'case_id' is distinct from p_case_id::text
    or p_content->>'user_id' is distinct from p_user_id::text or p_content->>'source_checksum' is distinct from report.payload_checksum
    or coalesce(p_content->>'status','') not in ('draft','approved')
    or jsonb_typeof(p_content->'actions') is distinct from 'array'
    or p_content-array['schema_version','report_id','user_id','case_id','expected_revision','source_checksum','status','title','summary','client_note','actions','client_action_ids','technical_omission_confirmation'] <> '{}'::jsonb then
    raise exception 'CAPABILITY_REVISION_INVALID';
  end if;
  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version'='v22_delivery_revision_v3' then
    perform public.validate_v22_candidate_selection(report.payload,p_content);
  elsif p_content ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version' in ('v22_delivery_revision_v2','v22_delivery_revision_v3') then
    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')
      or jsonb_typeof(p_content->'client_action_ids') is distinct from 'array'
      or jsonb_array_length(p_content->'client_action_ids')>3
      or exists(select 1 from jsonb_array_elements(p_content->'client_action_ids') id
        where jsonb_typeof(id) <> 'string' or not exists(
          select 1 from jsonb_array_elements(p_content->'actions') a where a->>'id'=id#>>'{}'))
      or (select count(*) from jsonb_array_elements(p_content->'client_action_ids')) <>
         (select count(distinct id) from jsonb_array_elements(p_content->'client_action_ids') id)
    then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  elsif p_content ? 'client_action_ids' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  foreach field in array array['title','summary'] loop
    if jsonb_typeof(p_content->field) is distinct from 'string' or length(btrim(p_content->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then
      raise exception 'CAPABILITY_REVISION_INVALID';
    end if;
  end loop;
  if p_content->'client_note' is distinct from 'null'::jsonb and (jsonb_typeof(p_content->'client_note') is distinct from 'string'
    or length(btrim(p_content->>'client_note')) not between 1 and 2000) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(report.payload->'actions');
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(p_content->'actions');
  if p_content->>'schema_version'<>'v22_delivery_revision_v3' and expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_content->'actions') loop
    if item-array['id','title','target','steps','completion','review','materials'] <> '{}'::jsonb then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    foreach field in array array['title','target','review'] loop
      if jsonb_typeof(item->field) is distinct from 'string' or length(btrim(item->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    end loop;
    foreach field in array array['steps','completion'] loop
      if jsonb_typeof(item->field) is distinct from 'array' or jsonb_array_length(item->field) not between 1 and 12 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      for text_value in select value from jsonb_array_elements(item->field) loop
        if jsonb_typeof(text_value) is distinct from 'string' or length(btrim(text_value#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      end loop;
    end loop;
    select value into source_action from jsonb_array_elements(case when p_content->>'schema_version'='v22_delivery_revision_v3' then report.payload->'action_candidates' else report.payload->'actions' end) where value->>'id'=item->>'id';
    if jsonb_typeof(item->'materials') is distinct from 'array' or jsonb_array_length(item->'materials')>3 then raise exception 'CAPABILITY_MATERIAL_INVALID'; end if;
    select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(coalesce(source_action->'materials','[]'));
    select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(item->'materials');
    if expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_MATERIAL_IDENTITY_INVALID'; end if;
    for material in select value from jsonb_array_elements(item->'materials') loop
      select value into original from jsonb_array_elements(source_action->'materials') where value->>'id'=material->>'id';
      -- Only prose changes. Never rewrite evidence, targets or confirmation state.
      if material-array['title','body'] is distinct from original-array['title','body'] then raise exception 'CAPABILITY_MATERIAL_BASIS_IMMUTABLE'; end if;
      foreach field in array array['title','body'] loop
        if jsonb_typeof(material->field) is distinct from 'string' or length(btrim(material->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then raise exception 'CAPABILITY_MATERIAL_INVALID'; end if;
      end loop;
    end loop;
  end loop;
  if jsonb_typeof(p_content->'expected_revision') is distinct from 'number'
    or p_content->>'expected_revision' !~ '^(0|[1-9][0-9]*)$' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(max(revision),0) into current_revision from public.report_content_revisions where report_id=p_report_id;
  if (p_content->>'expected_revision')::bigint is distinct from current_revision then raise exception 'CAPABILITY_REVISION_CONFLICT' using errcode='40001'; end if;
  insert into public.report_content_revisions(report_id,user_id,case_id,revision,status,content,approved_at)
    values(p_report_id,p_user_id,p_case_id,current_revision+1,p_content->>'status',p_content,
      case when p_content->>'status'='approved' then now() else null end) returning * into saved;
  return saved;
end;
$function$;
