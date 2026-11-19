CREATE OR REPLACE FUNCTION public.prepare_v22_public_reassessment(p_user_id uuid, p_case_id uuid, p_report_id uuid, p_request_id uuid, p_preview jsonb, p_canonical text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare base public.capability_report_versions; m jsonb; r jsonb; old public.capability_reassessment_requests;
  ir integer; dr integer; source jsonb; hydrated jsonb; expected jsonb; visit boolean; location jsonb; confirmation jsonb; saved_address text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Share the delivery writer's report lock before reading its latest revision.
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into base from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  if base.id is null or base.payload->>'report_type'<>'prospect' then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into old from public.capability_reassessment_requests where id=p_request_id;
  if found then
    if old.user_id<>p_user_id or old.case_id<>p_case_id or old.base_report_id<>p_report_id or old.preview is distinct from p_preview then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
    return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
  end if;
  select coalesce(max(revision),0) into ir from public.case_business_identity_versions where case_id=p_case_id;
  select coalesce(max(revision),0) into dr from public.report_content_revisions where report_id=p_report_id;
  if (p_preview->>'expected_identity_revision')::integer is distinct from ir or (p_preview->>'expected_delivery_revision')::integer is distinct from dr then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
  if (p_preview#>'{selection,customers_can_visit}' is not null
      and jsonb_typeof(p_preview#>'{selection,customers_can_visit}') is distinct from 'boolean')
    or coalesce(p_preview#>>'{selection,reason}','') ~ '^[[:space:]]*$' then raise exception 'IDENTITY_INVALID'; end if;
  visit=coalesce((p_preview#>>'{selection,customers_can_visit}')::boolean,false);
  location=p_preview#>'{identity,operating_location}';confirmation=location->'confirmation_ref';
  if visit then
    if coalesce(p_preview#>>'{selection,operating_model}','') not in ('storefront','hybrid')
      or location->>'role' is distinct from 'customer_facing' or location->>'state' is distinct from 'seo_confirmed'
      or confirmation->>'confirmed_by' is distinct from p_user_id::text
      or confirmation->>'confirmed_at' is distinct from p_preview#>>'{report,input_manifest,evaluated_at}'
      or confirmation->>'confirmed_at' is distinct from p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_at}'
      or confirmation->>'selected_branch_ref' is distinct from split_part(p_preview#>>'{selection,branch_ref}',':',2)
      or confirmation->>'selected_branch_ref' is distinct from p_preview#>>'{identity,selected_branch_ref}'
      or confirmation->>'source_ref' is distinct from 'identity-review:'||p_request_id::text then raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID'; end if;
  elsif location->>'role' is distinct from 'unknown' or location ? 'confirmation_ref' or location->>'state'='seo_confirmed' then
    raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID';
  end if;
  r=p_preview->'report';m=r->'input_manifest';
  if p_preview is distinct from p_canonical::jsonb or octet_length(p_canonical)>3000000
    or public.v22_review_hash(r) is distinct from p_preview->>'report_checksum'
    or public.v22_review_hash(m-'input_checksum') is distinct from m->>'input_checksum'
    or public.v22_review_hash(p_preview->'identity') is distinct from m->>'identity_checksum'
    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') or r->>'report_type' is distinct from 'prospect'
    or r->>'settlement_policy' is distinct from 'no_charge_public_reassessment'
    or r->>'id' is distinct from m->>'job_id' or r->>'id'=p_report_id::text
    or (r->>'version')::integer is distinct from (base.payload->>'version')::integer+1
    or m->>'execution_type' is distinct from 'public_reassessment'
    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.12') is distinct from (r->>'schema_version'='2.2.12')
    or (base.schema_version='2.2.11') is distinct from (r->>'schema_version'='2.2.11')
    or (base.schema_version='2.2.10') is distinct from (r->>'schema_version'='2.2.10')
    or (base.schema_version='2.2.9') is distinct from (r->>'schema_version'='2.2.9')
    or m->>'mode' is distinct from 'acquisition' or m->>'case_id' is distinct from p_case_id::text or m->>'user_id' is distinct from p_user_id::text
    or m#>>'{base_report_ref,report_id}' is distinct from p_report_id::text
    or m#>>'{base_report_ref,payload_checksum}' is distinct from base.payload_checksum
    or m->'snapshots' is distinct from base.payload#>'{input_manifest,snapshots}'
    or m->'business' is distinct from base.payload#>'{input_manifest,business}'
    or m->>'evidence_as_of' is distinct from coalesce(base.payload#>>'{input_manifest,evidence_as_of}',base.payload#>>'{input_manifest,evaluated_at}')
    or (m->>'evaluated_at')::timestamptz < (base.payload->>'generated_at')::timestamptz
    or (m->>'evaluated_at')::timestamptz > now()+interval '5 minutes'
    or p_preview#>>'{identity,schema_version}' is distinct from 'business_identity_v2'
    or p_preview#>>'{identity,operating_model,value}' is distinct from p_preview#>>'{selection,operating_model}'
    or p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_by}' is distinct from p_user_id::text
    or p_preview#>>'{identity,operating_model,confirmation_ref,source_ref}' is distinct from 'identity-review:'||p_request_id::text
    or jsonb_array_length(r->'actions')>3 then raise exception 'IDENTITY_INVALID'; end if;
  expected=(select public.hydrate_v22_capability_generation_input(base.payload->'input_manifest',g.recipe)
    from public.capability_generation_recipes g where g.manifest_id=base.manifest_id);
  hydrated=public.hydrate_v22_capability_generation_input(m,p_preview->'recipe');
  if expected is null or hydrated->'evidence_input' is distinct from expected->'evidence_input'
    or public.v22_review_hash(hydrated) is distinct from m->>'generation_input_checksum'
    or hydrated->'business_identity' is distinct from p_preview->'identity'
    or not exists(select 1 from jsonb_array_elements(expected#>'{evidence_input,context,customer_public_gbp,entity_keys}') k
      where (k->>'kind')||':'||(k->>'value')=p_preview#>>'{selection,branch_ref}') then raise exception 'IDENTITY_SOURCE_CONFLICT'; end if;
  if visit then
    select s#>>'{payload,record,fields,address,value}' into saved_address
      from jsonb_array_elements(expected#>'{evidence_input,sources}') s
      where s->>'kind'='public_gbp' and s#>>'{payload,record,fields,address,state}'='observed';
    if saved_address is null or location#>>'{location,address}' is distinct from saved_address
      or confirmation->>'address' is distinct from saved_address then raise exception 'IDENTITY_VISIT_ADDRESS_INVALID'; end if;
  end if;
  perform public.validate_v22_keyword_visibility(r);
  perform public.validate_v22_gbp_comparison(r);
  perform public.validate_v22_landing_comparison(r);
  perform public.validate_v22_possible_reasons(r);
  perform public.validate_v22_candidate_pool(r);
  insert into public.capability_reassessment_requests(id,user_id,case_id,base_report_id,preview,preview_checksum,expected_identity_revision,expected_delivery_revision)
    values(p_request_id,p_user_id,p_case_id,p_report_id,p_preview,'sha256:'||encode(sha256(convert_to(p_canonical,'UTF8')),'hex'),ir,dr);
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $function$;
