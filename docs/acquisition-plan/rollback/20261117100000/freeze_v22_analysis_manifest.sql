-- Rollback definition; preserve original ACL.
CREATE OR REPLACE FUNCTION public.freeze_v22_analysis_manifest(p_user_id uuid, p_case_id uuid, p_job_id uuid, p_manifest jsonb, p_canonical_content text, p_previous_canonical text DEFAULT NULL::text)
 RETURNS analysis_input_manifests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  previous_payload jsonb; previous_legacy uuid; previous_capability uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_JOB_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id
    and case_id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CHARGE_NOT_FOUND'; end if;
  select * into saved from public.analysis_input_manifests where job_id=p_job_id;
  if found then
    if saved.payload is distinct from p_manifest then raise exception 'CAPABILITY_INPUT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  if job.status not in ('queued','running') or charge.state <> 'reserved'
    or not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
      and l.case_id=p_case_id and l.delta=-1 and l.kind=charge.workflow_kind||'_debit') then
    raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED';
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') then
    if p_manifest->>'mode' is distinct from 'acquisition'
      or coalesce(p_manifest->>'identity_version_id','') !~ '^[a-f0-9-]{36}$'
      or coalesce(p_manifest->>'identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
      or p_manifest->>'evidence_as_of' is distinct from p_manifest->>'evaluated_at'
      or jsonb_typeof(p_manifest->'target_market') is distinct from 'object'
      or p_manifest#>>'{target_market,display_name}' is distinct from p_manifest#>>'{business,target_market}'
      or p_manifest->'target_market' is distinct from (select target_market from public.client_cases where id=p_case_id)
    then raise exception 'CAPABILITY_IDENTITY_BINDING_INVALID'; end if;
  elsif p_manifest ?| array['identity_version_id','identity_checksum','target_market','evidence_as_of'] then
    raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID';
  end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v4') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v14') then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version'='v22_analysis_input_v4' then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14'))
    or p_manifest->>'schema_version'='v22_analysis_input_v1' and p_manifest->>'ruleset_version'='v22_capability_public_v7'
    then raise exception 'CAPABILITY_RENDER_VERSION_INVALID'; end if;
  if kind not in ('acquisition','after_acquisition','first_service') then
    -- Review needs implementation ownership/qualification added in P5.
    raise exception 'CAPABILITY_MODE_NOT_ENABLED';
  end if;
  if charge.workflow_kind is distinct from (case when kind='acquisition' then 'prospect' else 'verified' end)
    or job.job_type is distinct from (case when kind='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_WORKFLOW_MISMATCH';
  end if;
  evaluation=(p_manifest->>'evaluated_at')::timestamptz;
  if evaluation is null or evaluation>now() or evaluation<now()-interval '5 minutes' then raise exception 'CAPABILITY_EVALUATION_STALE'; end if;
  select * into business from public.case_business_scope_versions where id=(p_manifest#>>'{business,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if not found or business.scope is distinct from p_manifest->'business' then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if (business.scope->>'confirmed_at')::timestamptz > evaluation then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if kind in ('acquisition','first_service') and ((p_manifest->'previous_report') is distinct from 'null'::jsonb or p_previous_canonical is not null) then
    raise exception 'CAPABILITY_INITIAL_HISTORY_FORBIDDEN';
  end if;
  if (p_manifest->'implementation') is distinct from 'null'::jsonb then raise exception 'CAPABILITY_IMPLEMENTATION_UNSUPPORTED'; end if;
  if kind='after_acquisition' then
    select report_v2_2,id into previous_payload,previous_legacy from public.reports
      where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
        and report_type='prospect' and status='paid_full' and version_number=(p_manifest#>>'{previous_report,version}')::integer;
    if not found then
      select payload,id into previous_payload,previous_capability from public.capability_report_versions
        where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
          and payload->>'report_type'='prospect' and (payload->>'version')::integer=(p_manifest#>>'{previous_report,version}')::integer;
    end if;
    if previous_payload is null or p_previous_canonical is null or previous_payload is distinct from p_previous_canonical::jsonb
      or p_manifest#>>'{previous_report,case_id}' is distinct from p_case_id::text
      or p_manifest#>>'{previous_report,report_type}' is distinct from 'prospect'
      or p_manifest#>>'{previous_report,payload_checksum}' is distinct from 'sha256:'||encode(sha256(convert_to(p_previous_canonical,'UTF8')),'hex') then
      raise exception 'CAPABILITY_HISTORY_INVALID';
    end if;
  end if;
  if jsonb_typeof(p_manifest->'snapshots') is distinct from 'array' then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  select array_agg(value->>'source_kind' order by ordinal) into kinds from jsonb_array_elements(p_manifest->'snapshots') with ordinality t(value,ordinal);
  required=case when kind='acquisition' then array['site','serp','competitor','public_gbp'] else array['site','serp','competitor','public_gbp','gsc','ga4'] end;
  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14')
          and source->>'schema_version'='site_inventory_snapshot_v2'
        then 'site_inventory_snapshot_v2' else 'site_inventory_snapshot_v1' end when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then case
        when source->>'schema_version'='customer_public_gbp_snapshot_v2'
        then 'customer_public_gbp_snapshot_v2' else 'customer_public_gbp_snapshot_v1' end
      when 'gsc' then 'gsc_sync_v1' when 'ga4' then 'ga4_sync_v1' when 'official_gbp' then 'gbp_sync_v1' end;
    if snapshot.id is null or snapshot.payload_checksum is distinct from source->>'payload_checksum'
      or snapshot.schema_version is distinct from expected_schema or source->>'schema_version' is distinct from expected_schema
      or snapshot.source_type is distinct from (case when source->>'source_kind' in ('public_gbp','official_gbp') then 'gbp' when source->>'source_kind'='rendered' then 'site' else source->>'source_kind' end)
      or source->>'case_id' is distinct from p_case_id::text or snapshot.health_status <> 'healthy'
      or source->>'health' is distinct from 'healthy' or source->>'identity_match' is distinct from 'matched'
      or snapshot.fetched_at is distinct from (source->>'fetched_at')::timestamptz
      or snapshot.expires_at is null or snapshot.expires_at is distinct from (source->>'expires_at')::timestamptz
      or snapshot.fetched_at>evaluation or snapshot.expires_at<=now()
      or snapshot.binding_id is distinct from (source->>'binding_id')::uuid then
      raise exception 'CAPABILITY_SNAPSHOT_INVALID';
    end if;
    if source->>'source_kind'='rendered' and (
      snapshot.normalized_payload->>'source_kind' is distinct from 'rendered'
      or snapshot.normalized_payload->>'root_url' is distinct from p_manifest#>>'{business,site_url}'
      or snapshot.normalized_payload->>'static_payload_checksum' is distinct from
        (select value->>'payload_checksum' from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'='site'))
      then raise exception 'CAPABILITY_RENDER_BINDING_INVALID'; end if;
    if source->>'source_kind'='public_gbp' and (
      snapshot.normalized_payload->>'identity_match_status' is distinct from 'matched'
      or snapshot.normalized_payload->>'health_status' is distinct from 'healthy') then raise exception 'CAPABILITY_GBP_INVALID'; end if;
    if source->>'source_kind' in ('gsc','ga4','official_gbp') then
      select * into binding from public.case_source_bindings where id=snapshot.binding_id and case_id=p_case_id;
      if binding.id is null or not binding.is_active or binding.identity_match_status<>'matched' or binding.health_status<>'healthy'
        or binding.source_type is distinct from snapshot.source_type
        or not exists (select 1 from public.google_connections where id=binding.connection_id and user_id=p_user_id and status='active') then
        raise exception 'CAPABILITY_AUTHORIZATION_INVALID';
      end if;
    elsif snapshot.binding_id is not null then raise exception 'CAPABILITY_PUBLIC_BINDING_INVALID'; end if;
  end loop;
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload,previous_legacy_report_id,previous_capability_report_id)
    values ((p_manifest->>'id')::uuid,p_user_id,p_case_id,p_job_id,business.id,kind,p_manifest->>'input_checksum',p_manifest,previous_legacy,previous_capability) returning * into saved;
  insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind)
    select saved.id,(value->>'snapshot_id')::uuid,value->>'source_kind' from jsonb_array_elements(p_manifest->'snapshots');
  return saved;
end;
$function$
;
