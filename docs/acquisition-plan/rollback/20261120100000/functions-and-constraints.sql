-- Restore only before v21 data is frozen. Retain additive pin data.
alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));

alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text])));

CREATE OR REPLACE FUNCTION public.begin_v22_acquisition_preparation(p_user_id uuid, p_case_id uuid, p_job_id uuid, p_idempotency_key text, p_business_version_id uuid, p_request_canonical text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare job public.analysis_jobs; business public.case_business_scope_versions;
  charge public.workflow_charges; saved public.capability_acquisition_preparations;
  body jsonb; req jsonb; checksum text; dispatch jsonb=null;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if job.id is null or job.idempotency_key is distinct from p_idempotency_key
    or job.job_type<>'prospect_report' or job.status not in ('queued','running','succeeded')
    or job.report_id is not null then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  select * into business from public.case_business_scope_versions where id=p_business_version_id
    and user_id=p_user_id and case_id=p_case_id;
  if business.id is null or p_request_canonical is null or octet_length(p_request_canonical)>150000 then
    raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'analyze_request';
  if coalesce(body->>'schema_version','') not in ('v22_analysis_request_envelope_v1','v22_analysis_request_envelope_v2')
    or (body->>'schema_version'='v22_analysis_request_envelope_v2') is distinct from (body ? 'target_keywords')
    or body-(array['schema_version','analyze_request','competitor_discovery']||case when body->>'schema_version'='v22_analysis_request_envelope_v2' then array['target_keywords'] else array[]::text[] end)<>'{}'::jsonb
    or jsonb_typeof(body->'competitor_discovery') is distinct from 'object'
    or req->>'case_id' is distinct from p_case_id::text or req->>'report_type' is distinct from 'prospect'
    or req->'first_party_snapshots' is distinct from '[]'::jsonb
    or req#>>'{business_identity,site_url}' is distinct from business.scope->>'site_url'
    or req->>'primary_service' is distinct from business.scope->>'primary_service'
    or req#>>'{target_market,display_name}' is distinct from business.scope->>'target_market'
    or jsonb_typeof(req->'competitors') is distinct from 'array'
    or jsonb_array_length(req->'competitors') not between 1 and 3 then raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  if (select jsonb_agg(value->>'website_url' order by value->>'website_url') from jsonb_array_elements(req->'competitors'))
    is distinct from (select jsonb_agg(value order by value) from jsonb_array_elements(business.scope->'competitor_sites')) then
    raise exception 'CAPABILITY_PREPARATION_INVALID'; end if;
  if body->>'schema_version'='v22_analysis_request_envelope_v2' then
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id and user_id=p_user_id and case_id=p_case_id and workflow_kind='prospect';
    if charge.id is null then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
    perform public.assert_v22_discovery_target_keywords(p_user_id,p_case_id,charge.id,(body#>>'{competitor_discovery,discovery_id}')::uuid,body);
  end if;
  checksum='sha256:'||encode(sha256(convert_to(p_request_canonical,'UTF8')),'hex');
  select * into saved from public.capability_acquisition_preparations where job_id=p_job_id;
  if saved.job_id is not null then
    if saved.user_id<>p_user_id or saved.case_id<>p_case_id or saved.business_version_id<>p_business_version_id
      or saved.request is distinct from body or saved.request_checksum is distinct from checksum then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT' using errcode='40001'; end if;
  else
    -- Never adopt a task that has already run on the legacy path.
    if job.status<>'queued' or job.attempt_count<>0 or job.capability_report_id is not null
      or exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
      raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  end if;
  if job.status<>'succeeded' then
    if job.deadline_at<=now() then raise exception 'CAPABILITY_PREPARATION_EXPIRED'; end if;
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id and user_id=p_user_id and case_id=p_case_id for update;
    if charge.id is null or charge.workflow_kind<>'prospect' or charge.state<>'reserved'
      or not exists(select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
        and l.case_id=p_case_id and l.delta=-1 and l.kind='prospect_debit') then
      raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED'; end if;
  end if;
  if saved.job_id is null then
    insert into public.capability_acquisition_preparations(job_id,user_id,case_id,business_version_id,request,request_checksum)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,body,checksum);
  end if;
  if exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then
    dispatch=public.get_v22_capability_dispatch(p_user_id,p_case_id,p_job_id,p_idempotency_key);
  elsif job.status='succeeded' then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  return jsonb_build_object('schema_version','v22_acquisition_preparation_v1','user_id',p_user_id,'case_id',p_case_id,
    'job_id',p_job_id,'idempotency_key',p_idempotency_key,'business',business.scope,'request_checksum',checksum,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'run_generation',job.run_generation,
    'cost_counters',job.cost_counters,'dispatch',dispatch);
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_v22_acquisition_preparation_binding()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if prep.job_id is not null and (new.user_id<>prep.user_id or new.case_id<>prep.case_id
      or new.business_version_id<>prep.business_version_id or new.mode<>'acquisition') then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_acquisition_preparations where job_id=m.job_id;
    if prep.job_id is not null then
      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      if (case when pub#>>'{business_identity,schema_version}'='business_identity_v2' then
          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'),false)
          or pub#>'{business_identity,business_name}' is distinct from req#>'{business_identity,business_name}'
          or pub#>'{business_identity,site_url}' is distinct from req#>'{business_identity,site_url}'
          or pub#>'{business_identity,normalized_domain}' is distinct from req#>'{business_identity,normalized_domain}'
          or pub#>'{business_identity,public_gbp_url}' is distinct from req#>'{business_identity,public_gbp_url}'
          or pub#>'{business_identity,country_code}' is distinct from req#>'{business_identity,primary_location,country_code}'
        else pub->'business_identity' is distinct from req->'business_identity' end)
        or pub#>'{evidence_input,context,queries}' is distinct from req->'queries'
        or pub#>'{evidence_input,context,target_market}' is distinct from req->'target_market'
        or pub#>'{evidence_input,context,competitors}' is distinct from req->'competitors' then
        raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_v22_delivery_prerequisites()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare report public.capability_report_versions; item jsonb; entry jsonb; source_action jsonb; dependency jsonb;
  seen text[]='{}'; layer integer=-1; current_layer integer;
begin
  select * into report from public.capability_report_versions where id=new.report_id and case_id=new.case_id and user_id=new.user_id;
  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
    perform public.validate_v22_candidate_selection(report.payload,new.content);
    return new;
  end if;
  if report.payload#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v2' then return new; end if;
  for item in select value from jsonb_array_elements(new.content->'actions') loop
    select value into entry from jsonb_array_elements(report.payload#>'{prioritization,candidates}')
      where value#>>'{input,action_id}'=item->>'id';
    select value into source_action from jsonb_array_elements(report.payload->'actions') where value->>'id'=item->>'id';
    current_layer=case entry->>'prerequisite' when 'access_indexing' then 0 when 'measurement' then 1 when 'none' then 2 else null end;
    if current_layer is null or current_layer<layer or source_action is null then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    for dependency in select value from jsonb_array_elements(source_action->'dependencies') loop
      if not((dependency#>>'{}')=any(seen)) then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
    end loop;
    seen=array_append(seen,item->>'id');layer=current_layer;
  end loop;
  return new;
end; $function$;

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
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
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
  if (p_manifest->>'schema_version'='v22_analysis_input_v10') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v20') then raise exception 'CAPABILITY_ACTION_ADVICE_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v8') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v7') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'))
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
  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')
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
$function$;

CREATE OR REPLACE FUNCTION public.get_v22_completed_plan_source(p_user_id uuid, p_case_id uuid, p_report_id uuid)
 RETURNS SETOF capability_report_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.capability_report_versions; full_report jsonb;
begin
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null then return; end if;
  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
    return query select * from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  elsif r.schema_version='2.2.3' then
    full_report=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
    if full_report is null or full_report->'report' is distinct from r.payload
      or full_report->>'payload_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
    r.payload=public.v22_review_plan_basis(r.payload);
    return next r;
  end if;
end; $function$;

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
    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.list_v22_completed_capability_reports(p_user_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, case_id uuid, business_name text, site_url text, market text, service text, report_type text, version integer, generated_at timestamp with time zone, delivery_revision integer, delivery_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$function$;

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
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
    select 1 from public.capability_acquisition_preparations p where p.job_id=(p_manifest->>'job_id')::uuid and p.request ? 'target_keywords'
      and p.request#>'{target_keywords,queries}' is distinct from p_manifest->'keyword_queries') then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
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
$function$;

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
    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') or r->>'report_type' is distinct from 'prospect'
    or r->>'settlement_policy' is distinct from 'no_charge_public_reassessment'
    or r->>'id' is distinct from m->>'job_id' or r->>'id'=p_report_id::text
    or (r->>'version')::integer is distinct from (base.payload->>'version')::integer+1
    or m->>'execution_type' is distinct from 'public_reassessment'
    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when r->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when r->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.15') is distinct from (r->>'schema_version'='2.2.15')
    or (base.schema_version='2.2.13') is distinct from (r->>'schema_version'='2.2.13')
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
  perform public.validate_v22_local_entity_coverage(r);
  perform public.validate_v22_action_advice(r);
  perform public.validate_v22_candidate_pool(r);
  insert into public.capability_reassessment_requests(id,user_id,case_id,base_report_id,preview,preview_checksum,expected_identity_revision,expected_delivery_revision)
    values(p_request_id,p_user_id,p_case_id,p_report_id,p_preview,'sha256:'||encode(sha256(convert_to(p_canonical,'UTF8')),'hex'),ir,dr);
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $function$;

CREATE OR REPLACE FUNCTION public.save_v22_report_content_revision(p_user_id uuid, p_case_id uuid, p_report_id uuid, p_content jsonb)
 RETURNS report_content_revisions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare report public.capability_report_versions; saved public.report_content_revisions;
  current_revision integer; expected_ids text[]; actual_ids text[]; item jsonb; source_action jsonb;
  material jsonb; original jsonb; field text; text_value jsonb;
begin
  select * into report from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_REPORT_NOT_FOUND'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or octet_length(p_content::text)>100000
    or coalesce(p_content->>'schema_version','') not in ('v22_delivery_revision_v1','v22_delivery_revision_v2','v22_delivery_revision_v3')
    or p_content->>'report_id' is distinct from p_report_id::text or p_content->>'case_id' is distinct from p_case_id::text
    or p_content->>'user_id' is distinct from p_user_id::text or p_content->>'source_checksum' is distinct from report.payload_checksum
    or coalesce(p_content->>'status','') not in ('draft','approved')
    or jsonb_typeof(p_content->'actions') is distinct from 'array'
    or p_content-array['schema_version','report_id','user_id','case_id','expected_revision','source_checksum','status','title','summary','client_note','actions','client_action_ids','technical_omission_confirmation'] <> '{}'::jsonb then
    raise exception 'CAPABILITY_REVISION_INVALID';
  end if;
  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version'='v22_delivery_revision_v3' then
    perform public.validate_v22_candidate_selection(report.payload,p_content);
  elsif p_content ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version' in ('v22_delivery_revision_v2','v22_delivery_revision_v3') then
    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
      or jsonb_typeof(p_content->'client_action_ids') is distinct from 'array'
      or jsonb_array_length(p_content->'client_action_ids')>3
      or exists(select 1 from jsonb_array_elements(p_content->'client_action_ids') id
        where jsonb_typeof(id) <> 'string' or not exists(
          select 1 from jsonb_array_elements(p_content->'actions') a where a->>'id'=id#>>'{}'))
      or (select count(*) from jsonb_array_elements(p_content->'client_action_ids')) <>
         (select count(distinct id) from jsonb_array_elements(p_content->'client_action_ids') id)
    then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  elsif p_content ? 'client_action_ids' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  foreach field in array array['title','summary'] loop
    if jsonb_typeof(p_content->field) is distinct from 'string' or length(btrim(p_content->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then
      raise exception 'CAPABILITY_REVISION_INVALID';
    end if;
  end loop;
  if p_content->'client_note' is distinct from 'null'::jsonb and (jsonb_typeof(p_content->'client_note') is distinct from 'string'
    or length(btrim(p_content->>'client_note')) not between 1 and 2000) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(report.payload->'actions');
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(p_content->'actions');
  if p_content->>'schema_version'<>'v22_delivery_revision_v3' and expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_content->'actions') loop
    if item-array['id','title','target','steps','completion','review','materials'] <> '{}'::jsonb then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    foreach field in array array['title','target','review'] loop
      if jsonb_typeof(item->field) is distinct from 'string' or length(btrim(item->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    end loop;
    foreach field in array array['steps','completion'] loop
      if jsonb_typeof(item->field) is distinct from 'array' or jsonb_array_length(item->field) not between 1 and 12 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      for text_value in select value from jsonb_array_elements(item->field) loop
        if jsonb_typeof(text_value) is distinct from 'string' or length(btrim(text_value#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      end loop;
    end loop;
    select value into source_action from jsonb_array_elements(case when p_content->>'schema_version'='v22_delivery_revision_v3' then report.payload->'action_candidates' else report.payload->'actions' end) where value->>'id'=item->>'id';
    if jsonb_typeof(item->'materials') is distinct from 'array' or jsonb_array_length(item->'materials')>3 then raise exception 'CAPABILITY_MATERIAL_INVALID'; end if;
    select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(coalesce(source_action->'materials','[]'));
    select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(item->'materials');
    if expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_MATERIAL_IDENTITY_INVALID'; end if;
    for material in select value from jsonb_array_elements(item->'materials') loop
      select value into original from jsonb_array_elements(source_action->'materials') where value->>'id'=material->>'id';
      -- Only prose changes. Never rewrite evidence, targets or confirmation state.
      if material-array['title','body'] is distinct from original-array['title','body'] then raise exception 'CAPABILITY_MATERIAL_BASIS_IMMUTABLE'; end if;
      foreach field in array array['title','body'] loop
        if jsonb_typeof(material->field) is distinct from 'string' or length(btrim(material->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then raise exception 'CAPABILITY_MATERIAL_INVALID'; end if;
      end loop;
    end loop;
  end loop;
  if jsonb_typeof(p_content->'expected_revision') is distinct from 'number'
    or p_content->>'expected_revision' !~ '^(0|[1-9][0-9]*)$' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(max(revision),0) into current_revision from public.report_content_revisions where report_id=p_report_id;
  if (p_content->>'expected_revision')::bigint is distinct from current_revision then raise exception 'CAPABILITY_REVISION_CONFLICT' using errcode='40001'; end if;
  insert into public.report_content_revisions(report_id,user_id,case_id,revision,status,content,approved_at)
    values(p_report_id,p_user_id,p_case_id,current_revision+1,p_content->>'status',p_content,
      case when p_content->>'status'='approved' then now() else null end) returning * into saved;
  return saved;
end;
$function$;

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
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
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
  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') and (
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
  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then
    if jsonb_typeof(p_payload->'contact_checks') is distinct from 'array'
      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then 5 else 4 end)
      or exists (select 1 from jsonb_array_elements(p_payload->'contact_checks') c where
        (coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and c->>'field'='opening_hours'))
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
  perform public.validate_v22_local_entity_coverage(p_payload);
  perform public.validate_v22_action_advice(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(p_job_id,manifest.id,p_user_id,p_case_id,p_payload->>'schema_version',checksum,p_payload) returning * into saved;
  return saved;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_v22_action_advice(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  entry jsonb;
  candidate jsonb;
  position_in_pool bigint;
  selected_position bigint;
  reference jsonb;
  example jsonb;
  expected text;
  advice_keys text[] := array['action_id','problem','evidence_ids','why_important','fix','where',
    'priority','effort','confidence','verification','reference','example','rejection_reason'];
begin
  if p->>'schema_version' is distinct from '2.2.15' then
    if p ? 'action_advice' then raise exception 'CAPABILITY_ACTION_ADVICE_INVALID'; end if;
    return;
  end if;
  if p#>>'{input_manifest,ruleset_version}' is distinct from 'v22_capability_public_v20'
    or p#>>'{input_manifest,schema_version}' is distinct from 'v22_analysis_input_v10'
    or jsonb_typeof(p->'action_advice') is distinct from 'array'
    or jsonb_typeof(p->'action_candidates') is distinct from 'array'
    or jsonb_array_length(p->'action_advice') <> jsonb_array_length(p->'action_candidates')
    or jsonb_array_length(p->'action_advice') > 1000 then raise exception 'CAPABILITY_ACTION_ADVICE_INVALID'; end if;
  for entry, position_in_pool in
    select value, ordinality from jsonb_array_elements(p->'action_advice') with ordinality
  loop
    candidate := p->'action_candidates'->(position_in_pool::integer-1);
    select ordinality into selected_position from jsonb_array_elements(p->'actions') with ordinality
      where value->>'id'=candidate->>'id';
    if jsonb_typeof(entry) is distinct from 'object' or not entry ?& advice_keys
      or entry - advice_keys <> '{}'::jsonb or entry->>'action_id' is distinct from candidate->>'id'
      or entry->'priority' is distinct from coalesce(to_jsonb(selected_position),'null'::jsonb)
      or entry->'where' is distinct from candidate->'target'
      or entry->'verification' is distinct from candidate->'completion'
      or jsonb_typeof(entry->'evidence_ids') is distinct from 'array'
      or jsonb_array_length(entry->'evidence_ids') not between 1 and 50
      or exists(select 1 from jsonb_array_elements_text(entry->'evidence_ids') ref
        where not exists (select 1 from jsonb_array_elements(p->'findings') f
          where candidate->'finding_ids' ? (f->>'id') and f->'evidence_ids' ? ref))
      or num_nonnulls(entry->>'reference',entry->>'example',entry->>'rejection_reason') <> 1
    then raise exception 'CAPABILITY_ACTION_ADVICE_INVALID'; end if;
    reference := entry->'reference';
    if reference <> 'null'::jsonb then
      if not exists(select 1 from jsonb_each(p#>'{landing_page_comparison,rows,0,metrics}') as metric
        cross join lateral jsonb_array_elements(metric.value->'evidence') proof
        where proof->>'location'='body' and proof->>'quote'=reference->>'text'
          and proof->>'snapshot_id'=reference->>'snapshot_id' and proof->>'path'=reference->>'path'
          and proof->>'url'=reference->>'url'
      ) then raise exception 'CAPABILITY_ACTION_ADVICE_INVALID'; end if;
    end if;
    example := entry->'example';
    if example <> 'null'::jsonb then
      expected := case example->>'template'
        when 'contact' then 'Get in touch about ' || (p#>>'{input_manifest,business,primary_service}') || '.'
        when 'discuss' then 'Contact us to discuss ' || (p#>>'{input_manifest,business,primary_service}') || '.'
        else null end;
      if expected is null or selected_position is null or example->>'text' is distinct from expected
        or example->>'version' is distinct from 'action_example_policy_v1'
        or example->'evidence_ids' is distinct from entry->'evidence_ids'
      then raise exception 'CAPABILITY_ACTION_ADVICE_INVALID'; end if;
    end if;
  end loop;
end
$function$;

CREATE OR REPLACE FUNCTION public.validate_v22_candidate_pool(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare a jsonb; e jsonb; m jsonb; ids jsonb; tech jsonb; field text; val jsonb; seen text[]='{}'; selected_seen text[]='{}';
begin
 if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
   if p ? 'action_candidates' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   return;
 end if;
 if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
   or p#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v3'
   or jsonb_typeof(p->'action_candidates') is distinct from 'array'
   or jsonb_array_length(p->'action_candidates')>1000
   or jsonb_typeof(p#>'{prioritization,candidates}') is distinct from 'array'
   or jsonb_array_length(p#>'{prioritization,candidates}')<>jsonb_array_length(p->'action_candidates')
 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
 select coalesce(jsonb_agg(x->'id' order by n),'[]') into ids from jsonb_array_elements(p->'action_candidates') with ordinality t(x,n);
 if ids is distinct from p#>'{prioritization,candidate_order}' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
 for a in select value from jsonb_array_elements(p->'action_candidates') loop
   if jsonb_typeof(a->'id') is distinct from 'string' or a->>'id'=any(seen)
     or jsonb_typeof(a->'dependencies') is distinct from 'array'
     or jsonb_typeof(a->'finding_ids') is distinct from 'array' or jsonb_array_length(a->'finding_ids')=0
     or jsonb_typeof(a->'materials') is distinct from 'array'
     or exists(select 1 from jsonb_array_elements_text(a->'dependencies') d where not(d=any(seen)))
     or exists(select 1 from jsonb_array_elements_text(a->'finding_ids') id where not exists(select 1 from jsonb_array_elements(p->'findings') f where f->>'id'=id))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   if a-array['id','title','target','finding_ids','steps','completion','review','dependencies','materials']<>'{}'::jsonb
     or jsonb_array_length(a->'dependencies')>2 or jsonb_array_length(a->'finding_ids')>20 or jsonb_array_length(a->'materials')>3
     or (select count(distinct x) from jsonb_array_elements(a->'finding_ids') x)<>jsonb_array_length(a->'finding_ids')
     or (select count(distinct x) from jsonb_array_elements(a->'dependencies') x)<>jsonb_array_length(a->'dependencies')
     or (select count(distinct x->>'id') from jsonb_array_elements(a->'materials') x)<>jsonb_array_length(a->'materials')
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   foreach field in array array['id','title','target','review'] loop
     if jsonb_typeof(a->field) is distinct from 'string' or length(btrim(a->>field)) not between 1 and (case when field in ('id','title') then 200 else 2000 end)
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   end loop;
   foreach field in array array['steps','completion'] loop
     if jsonb_typeof(a->field) is distinct from 'array' or jsonb_array_length(a->field) not between 1 and 12
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     for val in select value from jsonb_array_elements(a->field) loop
       if jsonb_typeof(val) is distinct from 'string' or length(btrim(val#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
   end loop;
   select value into e from jsonb_array_elements(p#>'{prioritization,candidates}') where value#>>'{input,action_id}'=a->>'id';
   if e is null or (select count(*) from jsonb_array_elements(p#>'{prioritization,candidates}') x where x#>>'{input,action_id}'=a->>'id')<>1
     or e#>'{input,finding_ids}' is distinct from (select jsonb_agg(x order by x) from jsonb_array_elements(a->'finding_ids') x)
     or e#>'{input,dependencies}' is distinct from (select coalesce(jsonb_agg(x order by x),'[]') from jsonb_array_elements(a->'dependencies') x)
     or e#>'{input,target}' is distinct from a->'target'
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   select coalesce(jsonb_agg(f->'id' order by f->>'id'),'[]') into tech from jsonb_array_elements(p->'findings') f
     where a->'finding_ids' @> jsonb_build_array(f->'id') and f->>'rule_id' in ('v22_public.site_http_error','v22_public.site_explicit_noindex')
       and f->>'kind'='fact' and f->>'status'='confirmed' and f->>'confidence' in ('medium','high') and f->>'interpretation'='supported'
       and jsonb_typeof(f->'evidence_ids')='array' and jsonb_array_length(f->'evidence_ids')>0;
   if e->'technical_finding_ids' is distinct from tech
     or (e->>'prerequisite'='access_indexing') is distinct from (jsonb_array_length(tech)>0)
     or e->'default_visible' is distinct from to_jsonb(exists(select 1 from jsonb_array_elements(p->'findings') f
       where a->'finding_ids' @> jsonb_build_array(f->'id') and f->>'status'='confirmed' and f->>'confidence' in ('medium','high')))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   for m in select value from jsonb_array_elements(a->'materials') loop
     if m-array['id','kind','title','target','body','readiness','confirmation_items','evidence_ids']<>'{}'::jsonb
       or coalesce(m->>'kind','') not in ('title_brief','service_brief','profile_correction','technical_check','measurement_check')
       or coalesce(m->>'readiness','') not in ('instructions','requires_confirmation','ready_to_use')
       or jsonb_typeof(m->'confirmation_items') is distinct from 'array' or jsonb_array_length(m->'confirmation_items')>12
       or (m->>'readiness'='ready_to_use' and jsonb_array_length(m->'confirmation_items')<>0)
       or (m->>'readiness'='requires_confirmation' and jsonb_array_length(m->'confirmation_items')=0)
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     foreach field in array array['id','title','target','body'] loop
       if jsonb_typeof(m->field) is distinct from 'string' or length(btrim(m->>field)) not between 1 and (case when field in ('id','title') then 200 else 2000 end)
       then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
     for val in select value from jsonb_array_elements(m->'confirmation_items') loop
       if jsonb_typeof(val) is distinct from 'string' or length(btrim(val#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
     if jsonb_typeof(m->'evidence_ids') is distinct from 'array' or jsonb_array_length(m->'evidence_ids') not between 1 and 20
       or (select count(distinct x) from jsonb_array_elements(m->'evidence_ids') x)<>jsonb_array_length(m->'evidence_ids') or exists(
       select 1 from jsonb_array_elements_text(m->'evidence_ids') id where not exists(
         select 1 from jsonb_array_elements(p->'findings') f where a->'finding_ids' @> jsonb_build_array(f->'id') and f->'evidence_ids' @> to_jsonb(array[id])))
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   end loop;
   seen=array_append(seen,a->>'id');
 end loop;
 for a in select value from jsonb_array_elements(p->'actions') loop
   if not exists(select 1 from jsonb_array_elements(p->'action_candidates') x where x=a)
     or a->>'id'=any(selected_seen) or exists(select 1 from jsonb_array_elements_text(a->'dependencies') d where not(d=any(selected_seen)))
     or not exists(select 1 from jsonb_array_elements(p#>'{prioritization,candidates}') x where x#>>'{input,action_id}'=a->>'id' and x->'default_visible'='true'::jsonb and x->'selected_order'=to_jsonb(cardinality(selected_seen)+1))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   selected_seen=array_append(selected_seen,a->>'id');
 end loop;
 if to_jsonb(selected_seen) is distinct from p#>'{prioritization,action_order}' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.validate_v22_candidate_selection(p jsonb, c jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare a jsonb; original jsonb; ids jsonb; visible jsonb; tech jsonb; expected jsonb; seen text[]='{}'; shown text[]='{}';
begin
 if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
 if jsonb_typeof(c->'actions') is distinct from 'array' or jsonb_array_length(c->'actions')<>jsonb_array_length(p->'actions')
   or jsonb_array_length(c->'actions')>3 or jsonb_typeof(c->'client_action_ids') is distinct from 'array'
 then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
 for a in select value from jsonb_array_elements(c->'actions') loop
   select value into original from jsonb_array_elements(p->'action_candidates') x where x->>'id'=a->>'id';
   if original is null or a->>'id'=any(seen) or exists(select 1 from jsonb_array_elements_text(original->'dependencies') d where not(d=any(seen)))
   then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
   seen=array_append(seen,a->>'id');
   if c->'client_action_ids' @> jsonb_build_array(a->'id') then
     if exists(select 1 from jsonb_array_elements_text(original->'dependencies') d where not(d=any(shown))) then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
     shown=array_append(shown,a->>'id');
   end if;
 end loop;
 if c->'client_action_ids' is distinct from to_jsonb(shown) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
 select coalesce(jsonb_agg(x#>'{input,action_id}' order by x#>>'{input,action_id}'),'[]') into tech
   from jsonb_array_elements(p#>'{prioritization,candidates}') x where jsonb_array_length(x->'technical_finding_ids')>0;
 if jsonb_array_length(tech)>0 and not exists(select 1 from jsonb_array_elements_text(tech) id where id=any(shown)) then
   expected=jsonb_build_object('confirmed',true,'omitted_action_ids',tech,'selected_action_ids',to_jsonb(seen),'client_action_ids',to_jsonb(shown));
   if c->'technical_omission_confirmation' is distinct from expected then raise exception 'CAPABILITY_TECHNICAL_CONFIRMATION_REQUIRED'; end if;
 elsif c ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_TECHNICAL_CONFIRMATION_INVALID'; end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.validate_v22_gbp_comparison(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb=p->'input_manifest'; v jsonb=p->'gbp_comparison'; customer jsonb; rivals jsonb; market jsonb; run jsonb; record jsonb; call jsonb; profile_time timestamptz; customer_time timestamptz;
 row jsonb; item jsonb; original jsonb; profile jsonb; review jsonb; d jsonb; other jsonb; val jsonb;
 source_id text; customer_id text; rival_id text; field text; path text; idx integer=0; n integer; r integer; count90 integer;
 ts timestamptz; latest timestamptz; bad_dates boolean; min_at timestamptz; max_at timestamptz; i integer;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
  if p ? 'gbp_comparison' then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
  or v->>'schema_version' is distinct from 'gbp_comparison_v1' or jsonb_typeof(v->'rows') is distinct from 'array'
  or jsonb_array_length(v->'rows') not between 1 and 4 or jsonb_typeof(v->'differences') is distinct from 'array'
  or jsonb_array_length(v->'differences')<>6 or v-array['schema_version','rows','differences']<>'{}'::jsonb
 then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
 select s.normalized_payload,s.id::text into customer,customer_id from public.data_snapshots s
 join jsonb_array_elements(m->'snapshots') ref on s.id=(ref->>'snapshot_id')::uuid
 where ref->>'source_kind'='public_gbp' and s.case_id=(m->>'case_id')::uuid and s.payload_checksum=ref->>'payload_checksum';
 select s.normalized_payload,s.id::text into rivals,rival_id from public.data_snapshots s
 join jsonb_array_elements(m->'snapshots') ref on s.id=(ref->>'snapshot_id')::uuid
 where ref->>'source_kind'='competitor' and s.case_id=(m->>'case_id')::uuid and s.payload_checksum=ref->>'payload_checksum';
 select s.normalized_payload into market from public.data_snapshots s join jsonb_array_elements(m->'snapshots') ref on s.id=(ref->>'snapshot_id')::uuid where ref->>'source_kind'='serp';
 select (ref->>'fetched_at')::timestamptz into customer_time from jsonb_array_elements(m->'snapshots') ref where ref->>'source_kind'='public_gbp';
 if customer is null or rivals is null or jsonb_array_length(v->'rows')<>1+jsonb_array_length(rivals->'competitors') then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
 for row in select value from jsonb_array_elements(v->'rows') loop
  if row->>'subject' is distinct from (case when idx=0 then 'customer' else 'competitor' end)
   or jsonb_typeof(row->'metrics') is distinct from 'object' or row-array['subject','name','metrics']<>'{}'::jsonb
   or (row->'metrics')-array['categories','rating','review_count','reviews_90d','latest_review','visible_replies']<>'{}'::jsonb
   or (select count(*) from jsonb_object_keys(row->'metrics'))<>6 then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
  original=case when idx=0 then customer else rivals#>array['competitors',(idx-1)::text] end;
  profile=original->'public_gbp';
  if idx>0 and row->>'name' is distinct from original#>>'{competitor,business_name}' then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
  if idx=0 and row->>'name' is distinct from m#>>'{business,business_name}' then
   -- BusinessScope does not carry a name in every historical source. Bind via recipe instead.
   if row->>'name' is distinct from (select recipe#>>'{request,business_identity,business_name}' from public.capability_generation_recipes where manifest_id=(m->>'id')::uuid) then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
  end if;
  profile_time=null;
  if idx>0 then
   if profile->>'request_record_id' is not null then profile_time=(profile->>'collected_at')::timestamptz;
   else
    <<source_time>>
    for run in select value from jsonb_array_elements(market->'query_runs') loop
     for record in select value from jsonb_array_elements(run->'results') loop
      if exists(select 1 from unnest(array['provider_cid','provider_data_id','provider_place_id']) k where record->>k is not null and record->k=profile->k)
       and record->'rating'=profile->'rating' and record->'review_count'=profile->'review_count' and record->'categories'=profile->'categories' then
       call=case when record->>'result_type'='maps' then run->'maps_call' else run->'google_call' end;
       if call->>'status'='succeeded' and call->>'checkpoint_hit'='false' then profile_time=(call->>'completed_at')::timestamptz; exit source_time; end if;
      end if;
     end loop;
    end loop;
   end if;
   select count(*),count(*) filter(where length(btrim(coalesce(x->>'owner_response_text','')))>0),
      min((x->>'collected_at')::timestamptz),max((x->>'iso_date')::timestamptz),
      coalesce(bool_or(x->>'iso_date' is null or (x->>'iso_date')::timestamptz>(x->>'collected_at')::timestamptz),false)
     into n,r,ts,latest,bad_dates from (
       select distinct on (coalesce(x->>'provider_review_id',x->>'review_record_id')) x
       from jsonb_array_elements(original->'reviews') with ordinality t(x,num)
       order by coalesce(x->>'provider_review_id',x->>'review_record_id'),num desc
     ) reviews;
   select count(*) into count90 from (
    select distinct on (coalesce(x->>'provider_review_id',x->>'review_record_id')) x
    from jsonb_array_elements(original->'reviews') with ordinality t(x,num)
    order by coalesce(x->>'provider_review_id',x->>'review_record_id'),num desc
   ) reviews where (x->>'iso_date')::timestamptz between ts-interval '90 days' and ts;
  end if;
  foreach field in array array['categories','rating','review_count','reviews_90d','latest_review','visible_replies'] loop
   item=row#>array['metrics',field];
   if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'status','') not in ('observed','not_checked','not_applicable')
    or jsonb_typeof(item->'source_refs') is distinct from 'array'
    or item-array['status','value','lower_bound','numerator','denominator','reason','sampled_at','source_refs']<>'{}'::jsonb
   then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
   if idx=0 and field in ('reviews_90d','latest_review','visible_replies') then
    if item->>'status' is distinct from 'not_checked' or item->>'reason' is distinct from 'customer_reviews_not_collected'
     or item->'source_refs' is distinct from '[]'::jsonb then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
   else
    path=case when idx=0 then customer_id||':/payload/record/fields/'||field else rival_id||':/payload/competitors/'||(idx-1)::text||case when field in ('categories','rating','review_count') then '/public_gbp/'||field else '/reviews' end end;
    if item->'source_refs' is distinct from jsonb_build_array(path) then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
   end if;
   if item->>'status'='observed' then
    if idx>0 and (profile is null or lower((regexp_match(profile->>'website_url','^https?://(?:www\.)?([^/:?#@]+)'))[1]) is distinct from lower((regexp_match(original#>>'{competitor,website_url}','^https?://(?:www\.)?([^/:?#@]+)'))[1])
       or (field in ('categories','rating','review_count') and original->>'public_gbp_status'='unavailable')
       or (field in ('reviews_90d','latest_review','visible_replies') and n>0 and original->>'reviews_status'='unavailable')) then raise exception 'CAPABILITY_GBP_COMPARISON_IDENTITY_INVALID'; end if;
    if item->'value' is null or item->'value'='null'::jsonb then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
    if field in ('categories','rating','review_count') then
     if (item->>'sampled_at')::timestamptz is distinct from (case when idx=0 then customer_time else profile_time end) then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
     val=case when idx=0 then customer#>array['record','fields',field,'value'] else profile->field end;
     if item->'value' is distinct from val or (idx=0 and customer#>>array['record','fields',field,'state'] is distinct from 'observed') then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif field='reviews_90d' then
     if n>0 and (item->>'sampled_at')::timestamptz is distinct from ts then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
     if item->'value' is distinct from to_jsonb(case when n=0 and (profile->>'review_count')::integer=0 then 0 else count90 end)
      or (n>0 and (bad_dates or item->>'lower_bound' is distinct from 'true')) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif field='latest_review' then
     if (item->>'sampled_at')::timestamptz is distinct from ts then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
     if bad_dates or n=0 or (item->>'value')::timestamptz is distinct from latest then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif field='visible_replies' then
     if (item->>'sampled_at')::timestamptz is distinct from ts then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
     if n=0 or (item->>'numerator')::integer is distinct from r or (item->>'denominator')::integer is distinct from n
      or abs((item->>'value')::double precision-r::double precision/n)>1e-12 then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    end if;
   elsif item->'value' is distinct from 'null'::jsonb or item->>'lower_bound' is distinct from 'false'
     or item->'numerator' is distinct from 'null'::jsonb or item->'denominator' is distinct from 'null'::jsonb then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID';
   end if;
  end loop;
  idx=idx+1;
 end loop;
 idx=0;
 foreach field in array array['categories','rating','review_count','reviews_90d','latest_review','visible_replies'] loop
  d=v#>array['differences',idx::text];item=v#>array['rows','0','metrics',field];
  if d->>'metric' is distinct from field or coalesce(d->>'status','') not in ('observed','not_checked') or jsonb_typeof(d->'competitor_indices') is distinct from 'array' then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
  if d->>'status'='observed' then
   if field not in ('categories','rating','review_count') or item->>'status' is distinct from 'observed' or item->>'sampled_at' is null
    or jsonb_array_length(d->'competitor_indices')<2 or jsonb_array_length(d->'competitor_indices')>3 or d->>'reason' is distinct from 'same_direction'
    or (select count(distinct x) from jsonb_array_elements(d->'competitor_indices') x)<>jsonb_array_length(d->'competitor_indices') then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
   min_at=(item->>'sampled_at')::timestamptz;max_at=min_at;
   for i in select value::integer from jsonb_array_elements_text(d->'competitor_indices') loop
    other=v#>array['rows',i::text,'metrics',field];
    if i<1 or i>=jsonb_array_length(v->'rows') or other->>'status' is distinct from 'observed' or other->>'sampled_at' is null
     or other->>'lower_bound' is distinct from 'false' or item->>'lower_bound' is distinct from 'false' then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
    if field='categories' and (d->>'direction' is distinct from 'different_categories' or not exists(
      select 1 from jsonb_array_elements_text(other->'value') category where not (item->'value' ? category)
      and (select count(*) from jsonb_array_elements_text(d->'competitor_indices') ci where v#>array['rows',ci,'metrics','categories','value'] ? category)>=2))
     then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    if field<>'categories' and not ((d->>'direction'='higher' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    min_at=least(min_at,(other->>'sampled_at')::timestamptz);max_at=greatest(max_at,(other->>'sampled_at')::timestamptz);
   end loop;
   if max_at-min_at>interval '24 hours' then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
  elsif d->'direction' is distinct from 'null'::jsonb or d->'competitor_indices' is distinct from '[]'::jsonb then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
  idx=idx+1;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.validate_v22_keyword_visibility(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb=p->'keyword_visibility'; m jsonb=p->'input_manifest'; source public.data_snapshots;
 ref jsonb; row jsonb; item jsonb; record jsonb; run jsonb; a jsonb; channel text; field text; rid text; ep text;
 idx integer=0; k integer; h integer; grade text; ids integer; domain text;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
  if p ? 'keyword_visibility' then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
  or jsonb_typeof(v) is distinct from 'object' or v->>'schema_version' is distinct from 'keyword_visibility_v1'
  or v->>'window' is distinct from 'first_page' or jsonb_typeof(v->'rows') is distinct from 'array'
  or jsonb_array_length(v->'rows') not between 3 and 5
  or v-array['schema_version','window','rows','local_pack','organic','sample']<>'{}'::jsonb
 then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
 select value into ref from jsonb_array_elements(m->'snapshots') where value->>'source_kind'='serp';
 select * into source from public.data_snapshots where id=(ref->>'snapshot_id')::uuid and case_id=(m->>'case_id')::uuid;
 if source.id is null or v#>>'{sample,snapshot_id}' is distinct from source.id::text
  or v#>>'{sample,payload_checksum}' is distinct from source.payload_checksum
  or (select jsonb_agg(r->'query' order by n) from jsonb_array_elements(v->'rows') with ordinality t(r,n)) is distinct from m->'keyword_queries'
  or source.normalized_payload->'queries' is distinct from m->'keyword_queries'
 then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;
 domain=lower((regexp_match(m#>>'{business,site_url}','^https?://(?:www\.)?([^/:?#@]+)'))[1]);
 for row in select value from jsonb_array_elements(v->'rows') loop
  run=source.normalized_payload#>array['query_runs',idx::text];
  if row->>'query' is distinct from run->>'query' then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;
  foreach channel in array array['local_pack','organic','maps'] loop
   item=row->channel;
   if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'status','') not in ('observed','not_detected','not_checked')
    or jsonb_typeof(item->'record_ids') is distinct from 'array' or jsonb_typeof(item->'evidence_paths') is distinct from 'array'
    or jsonb_array_length(item->'record_ids')>20 or jsonb_array_length(item->'evidence_paths')>100
    or (item->>'checked_count')::integer is distinct from (select count(*)::integer from jsonb_array_elements(run->'results') r where r->>'result_type'=channel)
   then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
   if item->>'status'='observed' then
    if coalesce(item->>'position','') !~ '^[1-9][0-9]{0,4}$' or (item->>'position')::integer>10000
     or coalesce(item->>'rank_source','') not in ('provider_position','response_order')
     or item->>'reason' is distinct from 'observed' or jsonb_array_length(item->'record_ids')=0
    then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
    for rid in select jsonb_array_elements_text(item->'record_ids') loop
     select value into record from jsonb_array_elements(run->'results') where value->>'record_id'=rid;
     if record is null or record->>'result_type' is distinct from channel or record->'position' is distinct from item->'position'
      or record->'rank_source' is distinct from item->'rank_source'
      or (channel='organic' and record->>'normalized_domain' is distinct from domain)
     then raise exception 'CAPABILITY_KEYWORDS_POSITION_INVALID'; end if;
    end loop;
   elsif item->'position' is distinct from 'null'::jsonb or item->'rank_source' is distinct from 'null'::jsonb
    or jsonb_array_length(item->'record_ids')<>0
    or (item->>'status'='not_detected') is distinct from (item->>'reason'='first_page_absent') then
    raise exception 'CAPABILITY_KEYWORDS_INVALID';
   end if;
   if item->>'status'<>'not_checked' and run#>>array[case when channel='maps' then 'maps_call' else 'google_call' end,'status'] is distinct from 'succeeded'
    then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
   for ep in select jsonb_array_elements_text(item->'evidence_paths') loop
    if ep !~ '^/payload/query_runs/[0-9]+/(maps_call/status|google_call/status|results/[0-9]+/(result_type|url|provider_cid|position|rank_source))$'
     or source.normalized_payload#>string_to_array(substring(ep from 10),'/') is null
    then raise exception 'CAPABILITY_KEYWORDS_EVIDENCE_INVALID'; end if;
   end loop;
  end loop;
  idx=idx+1;
 end loop;
 foreach channel in array array['local_pack','organic'] loop
  a=v->channel;
  select count(*) filter(where r#>>array[channel,'status']<>'not_checked'),count(*) filter(where r#>>array[channel,'status']='observed')
   into k,h from jsonb_array_elements(v->'rows') r;
  grade=case when k<2 then 'not_assessed' when 3*h>=2*k then 'strong' when 3*h>=k then 'medium' else 'weak' end;
  if a->>'kind' is distinct from 'inference' or a->>'assessment' is distinct from grade
   or (a->>'checked_keywords')::integer is distinct from k or (a->>'observed_keywords')::integer is distinct from h
   or (a->>'total_keywords')::integer is distinct from idx
   or (k<2 and a->'ratio' is distinct from 'null'::jsonb)
   or (k>=2 and (a->>'ratio')::double precision is distinct from h::double precision/k)
  then raise exception 'CAPABILITY_KEYWORDS_ASSESSMENT_INVALID'; end if;
 end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_v22_landing_comparison(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb=p->'input_manifest'; module jsonb=p->'landing_page_comparison'; row jsonb; metric jsonb; e jsonb; source jsonb; inv jsonb; deep jsonb;
 c jsonb; other jsonb; expected jsonb; indices jsonb; counts jsonb; fields text[]=array['local_entities','case_study','portfolio','credentials','service_price','discount','project_budget'];
 types text[]=array['home','service_index','service_detail','service_area','location','about','contact','team','review_testimonial','case_study_portfolio','faq','blog_index','blog_post','product_category','product_detail','legal','other'];
 eligible boolean; sid uuid; i integer=0; n integer; idx integer; field text; path text; quote text; original text; reason text; min_at timestamptz; max_at timestamptz;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12','2.2.13','2.2.15') then
  if p ? 'landing_page_comparison' then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
  or module->>'schema_version' is distinct from 'landing_page_comparison_v1' or module->>'extraction_version' is distinct from 'landing_content_rules_v1'
  or module->>'city_limit' is distinct from 'Only the confirmed target city is checked; other cities, neighbourhoods and landmarks are not assessed.'
  or module->'target_city' is distinct from coalesce(m->'target_market'->'city','null'::jsonb)
  or jsonb_typeof(module->'rows') is distinct from 'array' or jsonb_array_length(module->'rows') not between 1 and 4
  or jsonb_typeof(module->'comparisons') is distinct from 'array' or jsonb_array_length(module->'comparisons')<>8 then raise exception 'CAPABILITY_LANDING_INVALID'; end if;
 for row in select value from jsonb_array_elements(module->'rows') loop
  select (s->>'snapshot_id')::uuid into sid from jsonb_array_elements(m->'snapshots') s where s->>'source_kind'=case when i=0 then 'site' else 'competitor' end;
  path=case when i=0 then '/payload' else '/payload/competitors/'||(i-1)||'/site_inventory' end;
  if row->>'subject' is distinct from (case when i=0 then 'customer' else 'competitor' end)
   or row->'snapshot_id' is distinct from coalesce(to_jsonb(sid::text),'null'::jsonb) or row->>'inventory_path' is distinct from path
   or row->>'coverage' is distinct from 'bounded_sample' then raise exception 'CAPABILITY_LANDING_BINDING_INVALID'; end if;
  select normalized_payload into source from public.data_snapshots where id=sid and case_id=(m->>'case_id')::uuid;
  inv=case when i=0 then source else source#>array['competitors',(i-1)::text,'site_inventory'] end;
  eligible=i=0 or (inv is not null and source#>>array['competitors',(i-1)::text,'site_status']<>'unavailable'
   and exists(select 1 from jsonb_array_elements(m->'snapshots') s where s->>'source_kind'='competitor' and s->>'identity_match'='matched')
   and regexp_replace(lower(substring(inv->>'root_url' from '^https?://([^/:]+)')),'^www\.','')
    =regexp_replace(lower(substring(source#>>array['competitors',(i-1)::text,'competitor','website_url'] from '^https?://([^/:]+)')),'^www\.',''));
  eligible=coalesce(eligible,false);
  n=0; counts='{}'::jsonb;
  foreach field in array types loop
   select count(*) into idx from jsonb_array_elements(coalesce(inv->'pages','[]')) x where x->>'page_type'=field and x->>'check_status'='checked'
    and (x->>'status_code')::integer between 200 and 299 and split_part(lower(x->>'content_type'),';',1) in ('text/html','application/xhtml+xml') and not coalesce((x->>'structural_truncated')::boolean,false);
   counts=counts||jsonb_build_object(field,idx);n=n+idx;
  end loop;
  -- An unresolved/missing competitor inventory is never an eligible sample.
  if not eligible then counts=(select jsonb_object_agg(k,0) from unnest(types) k);n=0;end if;
  if row->'page_type_counts' is distinct from counts or row->'eligible_html_count' is distinct from to_jsonb(n) then raise exception 'CAPABILITY_LANDING_COUNTS_INVALID'; end if;
  select count(*) into n from jsonb_array_elements(coalesce(inv->'selected_pages','[]')) x where x->>'deep_analyzed'='true'
   and (x#>>'{deep_snapshot,status_code}')::integer between 200 and 299 and split_part(lower(x#>>'{deep_snapshot,content_type}'),';',1) in ('text/html','application/xhtml+xml');
  if not eligible then n=0;end if;
  if row->'deep_page_count' is distinct from to_jsonb(n) then raise exception 'CAPABILITY_LANDING_COUNTS_INVALID'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(row->'metrics') k) is distinct from (select array_agg(k order by k) from unnest(fields) k) then raise exception 'CAPABILITY_LANDING_INVALID'; end if;
  foreach field in array fields loop
   metric=row->'metrics'->field;
   if metric->>'status'='not_checked' then
    if metric->>'reason' not in ('not_observed_in_saved_sample','no_usable_pages','source_unavailable','identity_unresolved','target_city_unavailable') or metric->'count' is distinct from 'null'::jsonb or metric->'lower_bound' is distinct from 'false'::jsonb or metric->'evidence' is distinct from '[]'::jsonb then raise exception 'CAPABILITY_LANDING_UNKNOWN_INVALID';end if;
   elsif metric->>'status'='observed' then
    if not eligible or metric->>'reason' is distinct from 'saved_positive' or metric->'lower_bound' is distinct from 'true'::jsonb or jsonb_typeof(metric->'evidence') is distinct from 'array'
     or (metric->>'count')::integer<>jsonb_array_length(metric->'evidence') or jsonb_array_length(metric->'evidence') not between 1 and 100
     or (field='local_entities' and metric->>'count'<>'1') then raise exception 'CAPABILITY_LANDING_COUNTS_INVALID';end if;
    for e in select value from jsonb_array_elements(metric->'evidence') loop
     if e->>'snapshot_id' is distinct from sid::text or e->>'path' !~ ('^'||path||'/selected_pages/[0-9]+/deep_snapshot/(text|title|h1)$') then raise exception 'CAPABILITY_LANDING_BINDING_INVALID';end if;
     idx=split_part(substring(e->>'path' from length(path)+2),'/',2)::integer;
     deep=inv#>array['selected_pages',idx::text,'deep_snapshot'];
     original=deep->>substring(e->>'path' from '[^/]+$');quote=e->>'quote';
     if deep is null or e->>'url' is distinct from deep->>'url' or (e->>'sampled_at')::timestamptz is distinct from (deep->>'collected_at')::timestamptz
      or quote is null or length(quote) not between 1 and 300
      or position(lower(regexp_replace(quote,'\s+',' ','g')) in lower(regexp_replace(coalesce(original,''),'\s+',' ','g')))=0
      or (field='local_entities' and (module->>'target_city' is null or position(lower(module->>'target_city') in lower(quote))=0)) then raise exception 'CAPABILITY_LANDING_EVIDENCE_INVALID';end if;
    end loop;
   else raise exception 'CAPABILITY_LANDING_INVALID';end if;
  end loop;
  i=i+1;
 end loop;
 i=0;
 for c in select value from jsonb_array_elements(module->'comparisons') loop
  field=case when i=0 then 'page_type_counts' else fields[i] end;
  expected='[]';indices='[]';reason='bounded_counts';n=0;
  if i>0 then
   metric=module#>array['rows','0','metrics',field];reason='customer_unchecked';
   if metric->>'status'='observed' then
    reason='insufficient_comparators';expected=metric->'evidence';idx=0;
    for other in select value from jsonb_array_elements(module->'rows') loop
     if idx>0 and other#>>array['metrics',field,'status']='observed' then expected=expected||(other#>array['metrics',field,'evidence']);indices=indices||to_jsonb(idx);n=n+1;end if;
     idx=idx+1;
    end loop;
    if n>=2 then
     select min((x->>'sampled_at')::timestamptz),max((x->>'sampled_at')::timestamptz) into min_at,max_at from jsonb_array_elements(expected) x;
     reason=case when max_at-min_at>interval '24 hours' then 'comparison_time_gap' else 'no_supported_difference' end;
    end if;
   end if;
  end if;
  if c->>'classification' is distinct from 'inference' or c->>'metric' is distinct from field or c->>'status' is distinct from 'not_checked'
   or c->>'reason' is distinct from reason or c->'evidence' is distinct from expected or c->'competitor_indices' is distinct from indices then raise exception 'CAPABILITY_LANDING_COMPARISON_INVALID';end if;
  i=i+1;
 end loop;
end
$function$;

CREATE OR REPLACE FUNCTION public.validate_v22_local_entity_coverage(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 m jsonb := p->'input_manifest';
 c jsonb := p->'local_entity_coverage';
 e jsonb;
 site_id text;
 inventory jsonb;
 selected jsonb;
 deep jsonb;
 saved_field text;
 heading_count integer := 0;
 archive_count integer := 0;
 footer_count integer := 0;
 item_count integer;
 complete boolean;
 city text;
 expected_status text;
 expected_reason text;
 position_name text;
 previous_url text;
 previous_position text;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.13','2.2.15') then
  if p ? 'local_entity_coverage' then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  return;
 end if;
 if m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' else 'v22_analysis_input_v8' end)
    or m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' else 'v22_capability_public_v18' end) then
  raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID';
 end if;
 city := m#>>'{target_market,city}';
 if jsonb_typeof(c) is distinct from 'object'
    or c->>'schema_version' is distinct from 'local_entity_coverage_v1'
    or c->>'target_city' is distinct from city or not (c ? 'target_city')
    or c->>'city_limit' is distinct from 'Only the confirmed target city is checked; other cities, neighbourhoods and landmarks are not assessed.'
    or jsonb_typeof(c->'complete') is distinct from 'boolean'
    or jsonb_typeof(c->'archive_headings_only') is distinct from 'boolean'
    or jsonb_typeof(c->'evidence') is distinct from 'array'
    or (c - array['schema_version','target_city','city_limit','status','reason','complete','archive_headings_only','evidence']) <> '{}'::jsonb then
  raise exception 'CAPABILITY_LOCAL_ENTITY_INVALID';
 end if;
 item_count := jsonb_array_length(c->'evidence');
 complete := (c->>'complete')::boolean;
 if item_count > 200 or (city is null and (complete or item_count > 0)) then
  raise exception 'CAPABILITY_LOCAL_ENTITY_INVALID';
 end if;
 select x->>'snapshot_id' into site_id from jsonb_array_elements(m->'snapshots') x where x->>'source_kind'='site';
 if complete or item_count>0 then
  select normalized_payload into inventory from public.data_snapshots
  where id=site_id::uuid and case_id=(m->>'case_id')::uuid;
  if inventory is null then raise exception 'CAPABILITY_LOCAL_ENTITY_EVIDENCE_INVALID';end if;
 end if;
 if complete and (jsonb_array_length(coalesce(inventory->'selected_pages','[]'))=0
    or exists(select 1 from jsonb_array_elements(inventory->'selected_pages') x
     where x->'deep_analyzed' is distinct from 'true'::jsonb
      or coalesce((x#>>'{deep_snapshot,status_code}')::integer,0) not between 200 and 299
      or coalesce(octet_length(x#>>'{deep_snapshot,html}'),0) not between 1 and 1000000
      or coalesce(x#>>'{deep_snapshot,text}','')=''
      or trim(split_part(lower(coalesce(x#>>'{deep_snapshot,content_type}','')),';',1)) not in ('text/html','application/xhtml+xml'))) then
  raise exception 'CAPABILITY_LOCAL_ENTITY_INCOMPLETE';
 end if;
 for e in select value from jsonb_array_elements(c->'evidence') loop
  position_name := e->>'location';
  if position_name is null or position_name not in ('title','h1','body','footer')
     or coalesce(e->>'path','') !~ '^/payload/selected_pages/[0-9]+/deep_snapshot/(title|h1|text)$'
     or regexp_replace(e->>'path', '^.*/', '') <> (case when position_name in ('title','h1') then position_name else 'text' end)
     or site_id is null or e->>'snapshot_id' is distinct from site_id
     or coalesce(e->>'url','') !~ '^https?://[^/@[:space:]]+(/|$)'
     or char_length(e->>'url') > 2083
     or coalesce(char_length(e->>'quote'),0) not between 1 and 300
     or coalesce(char_length(e->>'sampled_at'),0) not between 1 and 64
     or (e - array['snapshot_id','path','url','quote','location','sampled_at']) <> '{}'::jsonb
     or (e->>'url' collate "C", position_name collate "C") <= (previous_url collate "C", previous_position collate "C") then
   raise exception 'CAPABILITY_LOCAL_ENTITY_EVIDENCE_INVALID';
  end if;
  selected := inventory#>array['selected_pages',split_part(e->>'path','/',4)];
  deep := selected->'deep_snapshot';
  saved_field := deep->>regexp_replace(e->>'path','^.*/','');
  if selected->'deep_analyzed' is distinct from 'true'::jsonb
     or coalesce((deep->>'status_code')::integer,0) not between 200 and 299
     or trim(split_part(lower(coalesce(deep->>'content_type','')),';',1)) not in ('text/html','application/xhtml+xml')
     or e->>'url' is distinct from deep->>'url'
     or (e->>'sampled_at')::timestamptz is distinct from (deep->>'collected_at')::timestamptz
     or position(lower(regexp_replace(e->>'quote','\s+',' ','g')) in lower(regexp_replace(coalesce(saved_field,''),'\s+',' ','g')))=0 then
   raise exception 'CAPABILITY_LOCAL_ENTITY_EVIDENCE_INVALID';
  end if;
  previous_url := e->>'url';
  previous_position := position_name;
  if position_name in ('title','h1') then
   heading_count := heading_count + 1;
   if split_part(split_part(regexp_replace(e->>'url','^https?://[^/]+',''),'?',1),'#',1) ~* '/(tag|tags|category|categories)(/|$)' then
    archive_count := archive_count + 1;
   end if;
  elsif position_name='footer' then footer_count := footer_count + 1;
  end if;
 end loop;
 expected_status := case when heading_count>0 then 'present' when item_count>0 then 'weak_position'
                         when complete then 'not_detected' else 'not_checked' end;
 expected_reason := case when item_count>0 then 'saved_positive' when complete then 'not_observed_in_saved_sample'
                         when city is null then 'target_city_unavailable' else 'incomplete_sample' end;
 if c->>'status' is distinct from expected_status or c->>'reason' is distinct from expected_reason
    or footer_count>1 or (c->>'archive_headings_only')::boolean is distinct from (heading_count>0 and heading_count=archive_count) then
  raise exception 'CAPABILITY_LOCAL_ENTITY_INVALID';
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.validate_v22_possible_reasons(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb=p->'input_manifest'; g jsonb=p->'gbp_comparison'; d jsonb; item jsonb; items jsonb='[]'; refs jsonb; indices jsonb;
 metric text; label text; own text; nums text; own_value text; i integer; idx integer; wanted jsonb;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.12','2.2.13','2.2.15') then
  if p ? 'possible_reasons' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' else 'v22_capability_public_v17' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' else 'v22_analysis_input_v7' end) then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
 perform public.validate_v22_gbp_comparison(p);
 perform public.validate_v22_landing_comparison(p);
 foreach metric in array array['rating','review_count'] loop
  select value,(ordinality-1)::integer into d,idx from jsonb_array_elements(g->'differences') with ordinality where value->>'metric'=metric;
  if d->>'status'<>'observed' or d->>'direction'<>'higher' then continue;end if;
  indices=d->'competitor_indices';refs=jsonb_build_array('/gbp_comparison/differences/'||idx)||(g#>array['rows','0','metrics',metric,'source_refs']);
  if jsonb_array_length(g#>array['rows','0','metrics',metric,'source_refs'])=0 then continue;end if;
  nums='';
  for i in select value::integer from jsonb_array_elements_text(indices) loop
   if jsonb_array_length(g#>array['rows',i::text,'metrics',metric,'source_refs'])=0 then nums=null;exit;end if;
   nums=nums||case when nums='' then '' else ', ' end||trim_scale((g#>>array['rows',i::text,'metrics',metric,'value'])::numeric)::text;
   refs=refs||(g#>array['rows',i::text,'metrics',metric,'source_refs']);
  end loop;
  if nums is null then continue;end if;
  own_value=trim_scale((g#>>array['rows','0','metrics',metric,'value'])::numeric)::text;
  label=case when metric='rating' then 'ratings' else 'review totals' end;own=case when metric='rating' then 'rating' else 'review total' end;
  item=jsonb_build_object('metric',metric,'classification','inference','basis_refs',refs,'competitor_indices',indices,'customer_text',
    'Sample competitor '||label||': '||nums||'; your '||own||': '||own_value||'. This difference may be one contributing factor. These observations do not establish ranking causation.');
  items=items||jsonb_build_array(item);
 end loop;
 wanted=jsonb_build_object('schema_version','possible_reasons_v1','status',case when jsonb_array_length(items)>0 then 'assessed' else 'not_assessed' end,'items',items);
 if p->'possible_reasons' is distinct from wanted then raise exception 'CAPABILITY_REASONS_BINDING_INVALID';end if;
end $function$;
