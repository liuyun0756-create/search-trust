-- P1-00b: v11-only hours and contact inventory; no frozen row rewrites.
begin;
alter table public.capability_report_versions
 drop constraint capability_report_versions_schema_version_check,
 drop constraint capability_report_input_variant,
 add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4','2.2.5','2.2.6')),
 add constraint capability_report_input_variant check(
   (schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6') and manifest_id is not null and review_input_job_id is null)
   or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));
do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10')$$;
  replacement := $$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11')$$;
  if position(previous in definition)=0 then raise exception 'P100B_MANIFEST_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$when 'site' then case$$;
  replacement := $$when 'site' then case
        when p_manifest->>'ruleset_version'='v22_capability_public_v11' and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'$$;
  if position(previous in definition)=0 then raise exception 'P100B_SITE_V3_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$('v22_capability_public_v9','v22_capability_public_v10')$$;
  replacement := $$('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11')$$;
  if position(previous in definition)=0 then raise exception 'P100B_SITE_V2_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) into definition;
  previous := $$case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8'$$;
  replacement := $$case when manifest.payload->>'ruleset_version'='v22_capability_public_v11' then '2.2.6'
    when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8'$$;
  if position(previous in definition)=0 then raise exception 'P100B_REPORT_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$p_payload->>'schema_version'='2.2.5'$$;
  replacement := $$p_payload->>'schema_version' in ('2.2.5','2.2.6')$$;
  if position(previous in definition)=0 then raise exception 'P100B_LABELS_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10') then$$;
  replacement := $$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11') then$$;
  if position(previous in definition)=0 then raise exception 'P100B_CONTACT_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$jsonb_array_length(p_payload->'contact_checks')>4$$;
  replacement := $$jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version'='v22_capability_public_v11' then 5 else 4 end)$$;
  if position(previous in definition)=0 then raise exception 'P100B_CONTACT_LENGTH_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$coalesce(c->>'field','') not in ('phone','address','business_name','service_area')$$;
  replacement := $$(coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
          and not (manifest.payload->>'ruleset_version'='v22_capability_public_v11' and c->>'field'='opening_hours'))$$;
  if position(previous in definition)=0 then raise exception 'P100B_CONTACT_FIELDS_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.list_v22_completed_capability_reports(uuid)'::regprocedure) into definition;
  previous := $$('2.2.2','2.2.4','2.2.5')$$;
  replacement := $$('2.2.2','2.2.4','2.2.5','2.2.6')$$;
  if position(previous in definition)=0 then raise exception 'P100B_LIST_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) into definition;
  previous := $$report.payload->>'schema_version' is distinct from '2.2.5'$$;
  replacement := $$coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6')$$;
  if position(previous in definition)=0 then raise exception 'P100B_DELIVERY_MISSING'; end if;
  execute replace(definition,previous,replacement);
end;
$migration$;
commit;
