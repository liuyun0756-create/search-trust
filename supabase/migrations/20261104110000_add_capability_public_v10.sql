-- P1-00: opt-in public v10; never rewrite frozen input/report rows.
begin;
do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9')$$;
  replacement := $$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10')$$;
  if position(previous in definition)=0 then raise exception 'P100_MANIFEST_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$when p_manifest->>'ruleset_version'='v22_capability_public_v9'$$;
  replacement := $$when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10')$$;
  if position(previous in definition)=0 then raise exception 'P100_SITE_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) into definition;
  previous := $$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_service_v5') then '2.2.5'$$;
  replacement := $$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_service_v5') then '2.2.5'$$;
  if position(previous in definition)=0 then raise exception 'P100_REPORT_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9') then$$;
  replacement := $$if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10') then$$;
  if position(previous in definition)=0 then raise exception 'P100_CONTACT_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);
end;
$migration$;
commit;
