-- Evaluate content validators against the mapped manifest. Keep the original
-- v21 envelope, provenance and checksum at the freeze and persistence boundaries.
-- Rollback: restore the five pre-migration pg_get_functiondef definitions.
begin;

do $migration$
declare
  expected record;
  signature regprocedure;
  definition text;
  original_acl aclitem[];
  original_source text;
  project constant text := '  p=public.v22_a3_report_shape(p);';
begin
  for expected in select * from (values
    ('validate_v22_gbp_comparison','11f8dd4be0107003131ab6ed0d5fdab4','b9c361b0d526b73dfbfd098e61c62932','0c8ef85809288363c25b47bc8ae303d5','7b0379ddc64e732f7d783f032e109469',$decl$m jsonb=p->'input_manifest';$decl$),
    ('validate_v22_keyword_visibility','8b82367e401fc438f70670762621339c','c23c2f29f51b3c299141312f1ac5c5ab','57d513bf0c132a85a42bc105182c443e','8d0b4a2dbe932cffd3bd395839defba0',$decl$m jsonb=p->'input_manifest';$decl$),
    ('validate_v22_landing_comparison','32512981319e07687544e7931f9b4608','1e2ca8f0022b58a86aa0ebdf7c52d092','0828f6b0d8637bf6f785012ddf795812','6ac0235407ad14324925acb5fea4eea4',$decl$m jsonb=p->'input_manifest';$decl$),
    ('validate_v22_local_entity_coverage','6cd989fe2c4292c9a6315b173ac6dd2d','e692962ff2599e936d00b5602c847c5f','119c85e711ded8844612c7924ea380a2','763efbf88e9bebe568802354ec17dd3f',$decl$m jsonb := p->'input_manifest';$decl$),
    ('validate_v22_possible_reasons','8e1972d9941adf78324acf5e134ece9d','42d7a9e494e803a43b8f85293fcd3b72','e5ed327182dbab4779f652dff4cd4d2c','3291d74a000c8ff0139faf0c10cc54fe',$decl$m jsonb=p->'input_manifest';$decl$)
  ) as v(name,old_source,old_definition,new_source,new_definition,declaration) loop
    signature := to_regprocedure('public.' || expected.name || '(jsonb)');
    select pg_get_functiondef(oid), md5(prosrc), proacl
      into definition, original_source, original_acl from pg_proc where oid=signature;
    if original_source is distinct from expected.old_source or md5(definition) is distinct from expected.old_definition then
      raise exception 'A3_VALIDATOR_BASELINE_MISMATCH_%', expected.name;
    end if;
    if position(expected.declaration in definition)=0 or position(project in definition)=0 then
      raise exception 'A3_VALIDATOR_TARGET_MISSING_%', expected.name;
    end if;

    definition := replace(definition,expected.declaration,'m jsonb;');
    definition := replace(definition,project,project || E'\n  m := p->''input_manifest'';');
    if md5(definition) is distinct from expected.new_definition then
      raise exception 'A3_VALIDATOR_TARGET_MISMATCH_%', expected.name;
    end if;
    execute definition;
    if exists (select 1 from pg_proc where oid=signature and
      (md5(prosrc) is distinct from expected.new_source or proacl is distinct from original_acl)) then
      raise exception 'A3_VALIDATOR_SOURCE_OR_ACL_MISMATCH_%', expected.name;
    end if;
  end loop;
end $migration$;

commit;
