-- P0-07: versioned delivery choices only; frozen reports/evidence stay untouched.
begin;
do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) into definition;
  previous := $$p_content->>'schema_version' is distinct from 'v22_delivery_revision_v1'$$;
  if position(previous in definition)=0 then raise exception 'P007_VERSION_GATE_MISSING'; end if;
  definition := replace(definition,previous,$$coalesce(p_content->>'schema_version','') not in ('v22_delivery_revision_v1','v22_delivery_revision_v2')$$);
  previous := $$'summary','client_note','actions']$$;
  if position(previous in definition)=0 then raise exception 'P007_FIELDS_GATE_MISSING'; end if;
  definition := replace(definition,previous,$$'summary','client_note','actions','client_action_ids']$$);
  previous := $$foreach field in array array['title','summary'] loop$$;
  replacement := $$if p_content->>'schema_version'='v22_delivery_revision_v2' then
    if report.payload->>'schema_version' is distinct from '2.2.5'
      or jsonb_typeof(p_content->'client_action_ids') is distinct from 'array'
      or jsonb_array_length(p_content->'client_action_ids')>3
      or exists(select 1 from jsonb_array_elements(p_content->'client_action_ids') id
        where jsonb_typeof(id) <> 'string' or not exists(
          select 1 from jsonb_array_elements(p_content->'actions') a where a->>'id'=id#>>'{}'))
      or (select count(*) from jsonb_array_elements(p_content->'client_action_ids')) <>
         (select count(distinct id) from jsonb_array_elements(p_content->'client_action_ids') id)
    then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  elsif p_content ? 'client_action_ids' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  foreach field in array array['title','summary'] loop$$;
  if position(previous in definition)=0 then raise exception 'P007_VISIBILITY_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);
end;
$migration$;
commit;
