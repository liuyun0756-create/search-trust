-- P1-01: bind the authorized legacy identity after the v13/v14 input conversion.
-- The supplied baseline is md5(prosrc); the complete production definition is
-- also pinned. No prepared intent, frozen input, checksum, ACL or other binding
-- is rewritten. Rollback: restore the captured pre-migration function definition.
begin;
do $migration$
declare definition text; source text; previous text;
begin
  select pg_get_functiondef(oid),prosrc into strict definition,source
    from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
  if md5(source) is distinct from 'a6ac16e7027cf155d3189df52c68dd9d'
    or md5(definition) is distinct from 'b66446b1fdeac16f668e29f16358bc0c' then
    raise exception 'P101_PREPARATION_BINDING_BASELINE_MISMATCH';
  end if;
  previous := $old$if pub->'business_identity' is distinct from req->'business_identity'$old$;
  if position(previous in definition)=0 then raise exception 'P101_PREPARATION_IDENTITY_TARGET_MISSING'; end if;
  execute replace(definition,previous,$new$if (case when pub#>>'{business_identity,schema_version}'='business_identity_v2' then
          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14'),false)
          or pub#>'{business_identity,business_name}' is distinct from req#>'{business_identity,business_name}'
          or pub#>'{business_identity,site_url}' is distinct from req#>'{business_identity,site_url}'
          or pub#>'{business_identity,normalized_domain}' is distinct from req#>'{business_identity,normalized_domain}'
          or pub#>'{business_identity,public_gbp_url}' is distinct from req#>'{business_identity,public_gbp_url}'
          or pub#>'{business_identity,country_code}' is distinct from req#>'{business_identity,primary_location,country_code}'
        else pub->'business_identity' is distinct from req->'business_identity' end)$new$);
end;
$migration$;
commit;
