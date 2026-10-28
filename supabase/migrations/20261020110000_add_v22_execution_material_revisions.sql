-- Additive, local-tested P2 material editing. No worker/intake/charging switch.
begin;

-- Freeze non-snapshot inputs as well: identity selection, queries and limits.
-- Do not scan historical prototype rows; all new manifests need this binding.
alter table public.analysis_input_manifests add constraint capability_generation_input_identity
  check (jsonb_typeof(payload->'generation_input_checksum') is not distinct from 'string'
    and coalesce(payload->>'generation_input_checksum' ~ '^sha256:[a-f0-9]{64}$',false)) not valid;

create or replace function public.save_v22_report_content_revision(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_content jsonb)
returns public.report_content_revisions
language plpgsql security definer set search_path=public as $$
declare report public.capability_report_versions; saved public.report_content_revisions;
  current_revision integer; expected_ids text[]; actual_ids text[]; item jsonb; source_action jsonb;
  material jsonb; original jsonb; field text; text_value jsonb;
begin
  select * into report from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_REPORT_NOT_FOUND'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or octet_length(p_content::text)>100000
    or p_content->>'schema_version' is distinct from 'v22_delivery_revision_v1'
    or p_content->>'report_id' is distinct from p_report_id::text or p_content->>'case_id' is distinct from p_case_id::text
    or p_content->>'user_id' is distinct from p_user_id::text or p_content->>'source_checksum' is distinct from report.payload_checksum
    or coalesce(p_content->>'status','') not in ('draft','approved')
    or jsonb_typeof(p_content->'actions') is distinct from 'array'
    or p_content-array['schema_version','report_id','user_id','case_id','expected_revision','source_checksum','status','title','summary','client_note','actions'] <> '{}'::jsonb then
    raise exception 'CAPABILITY_REVISION_INVALID';
  end if;
  foreach field in array array['title','summary'] loop
    if jsonb_typeof(p_content->field) is distinct from 'string' or length(btrim(p_content->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then
      raise exception 'CAPABILITY_REVISION_INVALID';
    end if;
  end loop;
  if p_content->'client_note' is distinct from 'null'::jsonb and (jsonb_typeof(p_content->'client_note') is distinct from 'string'
    or length(btrim(p_content->>'client_note')) not between 1 and 2000) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(report.payload->'actions');
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(p_content->'actions');
  if expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
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
    select value into source_action from jsonb_array_elements(report.payload->'actions') where value->>'id'=item->>'id';
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
$$;

revoke all on function public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb) to service_role;
commit;
