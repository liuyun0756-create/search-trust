-- Rollback definition; preserve original ACL.
CREATE OR REPLACE FUNCTION public.hydrate_v22_capability_generation_input(p_manifest jsonb, p_recipe jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare body jsonb; pub jsonb; source jsonb; ref jsonb; row public.data_snapshots;
  sources jsonb='[]'; private_sources jsonb='[]'; seen text[]='{}'; kind text; part jsonb;
begin
  if p_recipe->>'schema_version' is distinct from (case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 'v22_generation_recipe_v2' else 'v22_generation_recipe_v1' end)
    or p_recipe-array['schema_version','request']<>'{}'::jsonb or jsonb_typeof(p_recipe->'request') is distinct from 'object'
    or octet_length(p_recipe::text)>250000 then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  body=p_recipe->'request';
  pub=case when p_manifest->>'mode'='acquisition' then body else body->'public_input' end;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array'
    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
  for source in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=source->>'kind';
    if kind is null or kind not in ('site','serp','competitor','public_gbp','rendered') or kind=any(seen)
      or source ? 'payload' or (source->'shared_snapshot') ? 'snapshot' then raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    select * into row from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(p_manifest->>'case_id')::uuid;
    if row.id is null or row.payload_checksum is distinct from ref->>'payload_checksum'
      or source#>>'{binding,snapshot_id}' is distinct from ref->>'snapshot_id'
      or source#>>'{binding,case_id}' is distinct from p_manifest->>'case_id'
      or source#>>'{binding,payload_checksum}' is distinct from ref->>'payload_checksum'
      or source#>>'{binding,schema_version}' is distinct from ref->>'schema_version'
      or source#>>'{binding,source_type}' is distinct from (case when kind='public_gbp' then 'gbp' when kind='rendered' then 'site' else kind end)
      or source#>>'{binding,health_status}' is distinct from 'healthy'
      or source#>>'{binding,identity_match_status}' is distinct from 'matched'
      or (source#>>'{binding,fetched_at}')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz
      or (source#>>'{binding,expires_at}')::timestamptz is distinct from (ref->>'expires_at')::timestamptz then
      raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID';
    end if;
    source=source||jsonb_build_object('payload',row.normalized_payload);
    if kind='serp' and source->'shared_snapshot' is not null and source->'shared_snapshot'<>'null'::jsonb then
      source=jsonb_set(source,'{shared_snapshot,snapshot}',row.normalized_payload);
    end if;
    sources=sources||jsonb_build_array(source);
  end loop;
  pub=jsonb_set(pub,'{evidence_input,sources}',sources);
  if p_manifest->>'mode'='acquisition' then return pub; end if;
  if jsonb_typeof(body#>'{first_party_input,snapshots}') is distinct from 'array'
    or jsonb_array_length(body#>'{first_party_input,snapshots}')<>(jsonb_array_length(p_manifest->'snapshots')-4) then
    raise exception 'CAPABILITY_RECIPE_PRIVATE_PAYLOAD_FORBIDDEN'; end if;
  seen='{}';
  for part in select value from jsonb_array_elements(body#>'{first_party_input,snapshots}') loop
    if part ? 'normalized_payload' or part ? 'raw_payload' or part->>'snapshot_id'=any(seen) then raise exception 'CAPABILITY_RECIPE_PRIVATE_PAYLOAD_FORBIDDEN'; end if;
    seen=array_append(seen,part->>'snapshot_id');
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'snapshot_id'=part->>'snapshot_id'
      and value->>'source_kind' in ('gsc','ga4','official_gbp');
    select * into row from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(p_manifest->>'case_id')::uuid;
    if row.id is null or row.payload_checksum is distinct from ref->>'payload_checksum'
      or part->>'case_id' is distinct from p_manifest->>'case_id' or part->>'binding_id' is distinct from ref->>'binding_id'
      or part->>'source_type' is distinct from row.source_type or part->>'schema_version' is distinct from row.schema_version
      or part->>'payload_checksum' is distinct from row.payload_checksum or part->>'health_status' is distinct from row.health_status
      or part->>'identity_match_status' is distinct from 'matched' or part->'health_reasons' is distinct from row.health_reasons
      or part->>'external_resource_id' is distinct from row.provider_request_context->>'external_resource_id'
      or (part->>'coverage_start')::date is distinct from row.coverage_start or (part->>'coverage_end')::date is distinct from row.coverage_end
      or (part->>'fetched_at')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz
      or (part->>'expires_at')::timestamptz is distinct from (ref->>'expires_at')::timestamptz
      or (ref->>'source_kind'='official_gbp' and (row.raw_payload is null or row.raw_content_deleted_at is not null)) then
      raise exception 'CAPABILITY_RECIPE_SOURCE_INVALID'; end if;
    part=part||jsonb_build_object('normalized_payload',row.normalized_payload,
      'raw_payload',case when ref->>'source_kind'='official_gbp' then row.raw_payload else 'null'::jsonb end);
    private_sources=private_sources||jsonb_build_array(part);
  end loop;
  body=jsonb_set(body,'{public_input}',pub);
  return jsonb_set(body,'{first_party_input,snapshots}',private_sources);
end;
$function$
;
