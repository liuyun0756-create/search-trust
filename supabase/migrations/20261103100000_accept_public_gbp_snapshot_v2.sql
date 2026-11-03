-- P0-05: accept the extended place snapshot without rewriting frozen V1 rows.
-- Patch the latest hardened bodies; preserve entity binding, credits, delivery,
-- ownership and generation fencing from subsequent migrations.
begin;

do $migration$
declare
  definition text;
  previous text;
  replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $$when 'public_gbp' then 'customer_public_gbp_snapshot_v1'$$;
  replacement := $$when 'public_gbp' then case
        when source->>'schema_version'='customer_public_gbp_snapshot_v2'
        then 'customer_public_gbp_snapshot_v2' else 'customer_public_gbp_snapshot_v1' end$$;
  if position(previous in definition)=0 then raise exception 'P005_MANIFEST_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb)'::regprocedure) into definition;
  previous := $$p_public_gbp_payload->>'schema_version' <> 'customer_public_gbp_snapshot_v1'$$;
  replacement := $$coalesce(p_public_gbp_payload->>'schema_version','') not in ('customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2')$$;
  if position(previous in definition)=0 then raise exception 'P005_PERSISTENCE_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure) into definition;
  previous := $$public_snapshot.schema_version <> 'customer_public_gbp_snapshot_v1'$$;
  replacement := $$coalesce(public_snapshot.schema_version,'') not in ('customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2')$$;
  if position(previous in definition)=0 then raise exception 'P005_VERIFIED_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$public_snapshot.normalized_payload->>'schema_version' <> 'customer_public_gbp_snapshot_v1'$$;
  replacement := $$public_snapshot.normalized_payload->>'schema_version' is distinct from public_snapshot.schema_version$$;
  if position(previous in definition)=0 then raise exception 'P005_VERIFIED_PAYLOAD_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);
end;
$migration$;

commit;
