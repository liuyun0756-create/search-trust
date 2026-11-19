CREATE OR REPLACE FUNCTION public.store_v22_capability_report(p_user_id uuid, p_case_id uuid, p_job_id uuid, p_payload jsonb, p_canonical_content text, p_run_generation integer DEFAULT 1)
 RETURNS capability_report_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare manifest public.analysis_input_manifests; saved public.capability_report_versions; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into manifest from public.analysis_input_manifests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if not found then raise exception 'CAPABILITY_MANIFEST_NOT_FOUND'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex');
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_canonical_content)>2000000
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
    when manifest.payload->>'ruleset_version'='v22_capability_public_v12' then '2.2.7'
    when manifest.payload->>'ruleset_version'='v22_capability_public_v11' then '2.2.6'
    when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_service_v5') then '2.2.5'
    when manifest.payload->>'schema_version'='v22_analysis_input_v2' then '2.2.4' else '2.2.2' end)
    or p_payload->>'id' is distinct from p_job_id::text or p_payload->'input_manifest' is distinct from manifest.payload
    or p_payload->>'report_type' is distinct from (case when manifest.mode='acquisition' then 'prospect' else 'verified_execution' end)
    or p_payload->>'settlement_policy' is distinct from 'one_credit_per_completed_analysis'
    or coalesce(p_payload->>'action_state','') not in ('actions_supported','insufficient_basis')
    or jsonb_typeof(p_payload->'actions') is distinct from 'array' or jsonb_array_length(p_payload->'actions')>3
    or ((jsonb_array_length(p_payload->'actions')>0) is distinct from (p_payload->>'action_state'='actions_supported')) then
    raise exception 'CAPABILITY_REPORT_INVALID';
  end if;
  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') and (
    jsonb_typeof(p_payload->'findings') is distinct from 'array'
    or jsonb_array_length(p_payload->'findings') not between 1 and 50
    or exists (select 1 from jsonb_array_elements(p_payload->'findings') f where
      coalesce(f->>'kind','') not in ('fact','inference','recommendation')
      or coalesce(f->>'status','') not in ('confirmed','not_detected','not_checked','not_assessed')
      or f->>'kind'<>'fact' and f->>'status'<>'not_assessed'
      or jsonb_typeof(f->'coverage') is distinct from 'array'
      or jsonb_array_length(f->'coverage') not between 1 and 8
      or exists (select 1 from jsonb_array_elements(f->'coverage') c where
        coalesce(c->>'source','') not in ('site','gbp','serp','competitor','citation','gsc','ga4','rendered')
        or jsonb_typeof(c->'checked') is distinct from 'boolean')
      or (select count(*) from jsonb_array_elements(f->'coverage'))<>(select count(distinct c->>'source') from jsonb_array_elements(f->'coverage') c))
    ) then raise exception 'CAPABILITY_FINDING_LABELS_INVALID'; end if;
  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then
    if jsonb_typeof(p_payload->'contact_checks') is distinct from 'array'
      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then 5 else 4 end)
      or exists (select 1 from jsonb_array_elements(p_payload->'contact_checks') c where
        (coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') and c->>'field'='opening_hours'))
        or coalesce(c->>'status','') not in ('confirmed','not_detected','not_checked','not_assessed')
        or coalesce(c->>'result','') not in ('match','partial_match','mismatch','none')
        or coalesce(c->>'basis','') not in ('structured','text_pattern','rendered')
        or jsonb_typeof(c->'compared_components') is distinct from 'array'
        or jsonb_typeof(c->'omitted_components') is distinct from 'array'
        or jsonb_typeof(c->'evidence_ids') is distinct from 'array'
        or exists(select 1 from jsonb_array_elements_text(c->'evidence_ids') id
          where not exists(select 1 from jsonb_array_elements(p_payload->'evidence') e where e->>'id'=id)))
      or (select count(*) from jsonb_array_elements(p_payload->'contact_checks')) <>
         (select count(distinct c->>'field') from jsonb_array_elements(p_payload->'contact_checks') c)
    then raise exception 'CAPABILITY_CONTACT_CHECKS_INVALID'; end if;
  elsif p_payload ? 'contact_checks' then raise exception 'CAPABILITY_CONTACT_CHECKS_INVALID'; end if;
  select * into saved from public.capability_report_versions where id=p_job_id;
  if found then
    if saved.payload is distinct from p_payload then raise exception 'CAPABILITY_REPORT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  perform 1 from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not exists (select 1 from public.analysis_jobs j join public.workflow_charges c on c.analysis_job_id=j.id
    where j.id=p_job_id and j.case_id=p_case_id and j.status in ('queued','running') and j.run_generation=p_run_generation
      and c.user_id=p_user_id and c.case_id=p_case_id and c.state='reserved') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  perform public.validate_v22_keyword_visibility(p_payload);
  perform public.validate_v22_gbp_comparison(p_payload);
  perform public.validate_v22_landing_comparison(p_payload);
  perform public.validate_v22_possible_reasons(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(p_job_id,manifest.id,p_user_id,p_case_id,p_payload->>'schema_version',checksum,p_payload) returning * into saved;
  return saved;
end;
$function$;
