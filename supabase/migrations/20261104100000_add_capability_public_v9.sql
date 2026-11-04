-- P0-10: accept v9 resource-limited inputs without rewriting frozen rows.
-- Apply after 20261103120000_add_capability_action_visibility.sql.
begin;

do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $$coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8')$$;
  replacement := $$coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9')$$;
  if position(previous in definition)=0 then raise exception 'P010_MANIFEST_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);

  previous := $$when 'site' then 'site_inventory_snapshot_v1'$$;
  replacement := $$when 'site' then case
        when p_manifest->>'ruleset_version'='v22_capability_public_v9'
          and source->>'schema_version'='site_inventory_snapshot_v2'
        then 'site_inventory_snapshot_v2' else 'site_inventory_snapshot_v1' end$$;
  if position(previous in definition)=0 then raise exception 'P010_SITE_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) into definition;
  previous := $$case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_service_v5') then '2.2.5'$$;
  replacement := $$case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_service_v5') then '2.2.5'$$;
  if position(previous in definition)=0 then raise exception 'P010_REPORT_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);

  previous := $$if manifest.payload->>'ruleset_version'='v22_capability_public_v8' then$$;
  replacement := $$if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9') then$$;
  if position(previous in definition)=0 then raise exception 'P010_CONTACT_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);
end;
$migration$;

commit;
