-- Original production definition; restore original ACL.
CREATE OR REPLACE FUNCTION public.prepare_v22_capability_analysis_input_core(p_user_id uuid, p_case_id uuid, p_job_id uuid, p_manifest jsonb, p_manifest_canonical text, p_recipe jsonb, p_generation_canonical text, p_public_source_canonicals jsonb, p_previous_canonical text, p_run_generation integer)
 RETURNS TABLE(manifest_id uuid, input_checksum text, generation_input_checksum text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
  full_input jsonb; pub jsonb; src jsonb; ref jsonb; kind text; canonical text; snapshot public.data_snapshots; seen text[]='{}';
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if job.id is null or p_run_generation is null or job.run_generation is distinct from p_run_generation
    or job.status not in ('queued','running') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  if p_manifest->>'job_id' is distinct from p_job_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'user_id' is distinct from p_user_id::text or octet_length(p_generation_canonical)>20000000
    or p_generation_canonical is null or p_manifest->>'generation_input_checksum' is distinct from
      'sha256:'||encode(sha256(convert_to(p_generation_canonical,'UTF8')),'hex')
    or jsonb_typeof(p_public_source_canonicals) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and exists(
    select 1 from public.capability_acquisition_preparations p where p.job_id=(p_manifest->>'job_id')::uuid and p.request ? 'target_keywords'
      and p.request#>'{target_keywords,queries}' is distinct from p_manifest->'keyword_queries') then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
    or pub#>>'{business_identity,schema_version}' is distinct from 'business_identity_v2') then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then
    raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  for src in select value from jsonb_array_elements(pub#>'{evidence_input,sources}') loop
    kind=src->>'kind'; canonical=p_public_source_canonicals->>kind;
    if kind is null or kind not in ('site','serp','competitor','public_gbp','rendered') or kind=any(seen) or canonical is null
      or src->'payload' is distinct from canonical::jsonb then raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    seen=array_append(seen,kind);
    select value into ref from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'=kind;
    if ref is null or ref->>'payload_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(canonical,'UTF8')),'hex')
      or src#>>'{payload,schema_version}' is distinct from ref->>'schema_version'
      or (src#>>'{payload,completed_at}')::timestamptz is distinct from (ref->>'fetched_at')::timestamptz then
      raise exception 'CAPABILITY_SOURCE_INVALID'; end if;
    insert into public.data_snapshots(id,case_id,source_type,schema_version,fetched_at,expires_at,
      sync_trigger,health_status,health_reasons,normalized_payload,payload_checksum,provider_request_context)
    values((ref->>'snapshot_id')::uuid,p_case_id,case when kind='public_gbp' then 'gbp' when kind='rendered' then 'site' else kind end,ref->>'schema_version',
      (ref->>'fetched_at')::timestamptz,(ref->>'expires_at')::timestamptz,'report_generation','healthy',
      coalesce(src#>'{payload,limitations}','[]'::jsonb),src->'payload',ref->>'payload_checksum',
      case when kind='public_gbp' then jsonb_build_object('job_id',p_job_id,
        'customer_public_gbp_reference',pub#>'{evidence_input,context,customer_public_gbp}',
        'subject_reference_checksum',src#>>'{payload,subject_reference_checksum}') else jsonb_build_object('job_id',p_job_id) end)
    on conflict(id) do nothing;
    select * into snapshot from public.data_snapshots where id=(ref->>'snapshot_id')::uuid;
    if snapshot.case_id is distinct from p_case_id or snapshot.payload_checksum is distinct from ref->>'payload_checksum'
      or snapshot.normalized_payload is distinct from src->'payload' then raise exception 'CAPABILITY_SOURCE_CONFLICT'; end if;
  end loop;
  select * into saved from public.freeze_v22_analysis_manifest(p_user_id,p_case_id,p_job_id,p_manifest,p_manifest_canonical,p_previous_canonical);
  if public.hydrate_v22_capability_generation_input(saved.payload,p_recipe) is distinct from full_input then
    raise exception 'CAPABILITY_RECIPE_INPUT_MISMATCH'; end if;
  insert into public.capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe)
    values(saved.id,p_user_id,p_case_id,p_manifest->>'generation_input_checksum',p_recipe) on conflict on constraint capability_generation_recipes_pkey do nothing;
  select * into previous from public.capability_generation_recipes where capability_generation_recipes.manifest_id=saved.id;
  if previous.user_id is distinct from p_user_id or previous.case_id is distinct from p_case_id
    or previous.generation_input_checksum is distinct from p_manifest->>'generation_input_checksum'
    or previous.recipe is distinct from p_recipe then raise exception 'CAPABILITY_RECIPE_CONFLICT' using errcode='40001'; end if;
  return query select saved.id,saved.input_checksum,previous.generation_input_checksum;
end;
$function$
;
