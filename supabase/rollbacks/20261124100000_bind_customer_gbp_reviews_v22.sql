-- P1-02 phase 2. Rollback uses the matching definition and constraint checks in supabase/rollbacks.
begin;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(source)<>'b8c9ddac4303d436dfd91298067ba5ed' or md5(definition)<>'d2486fc3b18a7c2961b7b25497b4f87f' then raise exception 'P102_BASELINE_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 old := $patch$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb; proof jsonb; pinned public.case_business_identity_versions; branch_pin jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if new.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22') and not exists (
      select 1 where (public.get_v22_acquisition_preflight_branch_pin(new.user_id,new.case_id,new.job_id)->>'id') =
        new.payload#>>'{identity_inheritance,source_identity_version_id}'
      union all
      select 1 from public.case_business_identity_versions i where i.id=prep.pinned_identity_version_id
        and i.user_id=new.user_id and i.case_id=new.case_id
        and i.id::text=new.payload#>>'{identity_inheritance,source_identity_version_id}'
    ) then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    if prep.job_id is not null and (new.user_id<>prep.user_id or new.case_id<>prep.case_id
      or new.business_version_id<>prep.business_version_id or new.mode<>'acquisition') then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_acquisition_preparations where job_id=m.job_id;
    if prep.job_id is not null then
      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      branch_pin=public.get_v22_acquisition_preflight_branch_pin(prep.user_id,prep.case_id,m.job_id);
      if m.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22') and branch_pin is not null then
        perform public.validate_v22_preflight_branch_pin(branch_pin,m.payload,pub);
      elsif m.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22') then
        proof=m.payload->'identity_inheritance';
        select * into pinned from public.case_business_identity_versions
          where id=prep.pinned_identity_version_id and user_id=prep.user_id and case_id=prep.case_id;
        if pinned.id is null or proof->>'source_identity_version_id' is distinct from pinned.id::text
          or proof->>'source_identity_checksum' is distinct from pinned.identity_checksum
          or proof->>'source_revision' is distinct from pinned.revision::text
          or proof->>'confirmed_at' is distinct from pinned.identity#>>'{operating_model,confirmation_ref,confirmed_at}'
          or public.v22_review_hash(pub->'business_identity') is distinct from m.payload->>'identity_checksum'
          or (proof->>'branch'='retained' and pub#>>'{business_identity,selected_branch_ref}' is distinct from pinned.identity->>'selected_branch_ref')
          or (proof->>'operating_model'='retained') is distinct from (pub#>>'{business_identity,operating_model,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'operating_model'='retained' and
              ((pub#>'{business_identity,operating_model,confirmation_ref}')-'evidence_checksum') is distinct from
              ((pinned.identity#>'{operating_model,confirmation_ref}')-'evidence_checksum'))
          or (proof->>'visits'='retained') is distinct from (pub#>>'{business_identity,operating_location,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'visits'='retained' and
              ((pub#>'{business_identity,operating_location,confirmation_ref}')-array['address','source_identity_version_id']) is distinct from
              ((pinned.identity#>'{operating_location,confirmation_ref}')-'address'))
          or (proof->>'visits'='retained' and pub#>>'{business_identity,operating_location,confirmation_ref,source_identity_version_id}' is distinct from pinned.id::text)
        then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
      end if;
      if (case when pub#>>'{business_identity,schema_version}'='business_identity_v2' then
          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21','v22_capability_public_v22'),false)
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
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,old,$patch$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb; proof jsonb; pinned public.case_business_identity_versions; branch_pin jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if new.payload->>'ruleset_version'='v22_capability_public_v21' and not exists (
      select 1 where (public.get_v22_acquisition_preflight_branch_pin(new.user_id,new.case_id,new.job_id)->>'id') =
        new.payload#>>'{identity_inheritance,source_identity_version_id}'
      union all
      select 1 from public.case_business_identity_versions i where i.id=prep.pinned_identity_version_id
        and i.user_id=new.user_id and i.case_id=new.case_id
        and i.id::text=new.payload#>>'{identity_inheritance,source_identity_version_id}'
    ) then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    if prep.job_id is not null and (new.user_id<>prep.user_id or new.case_id<>prep.case_id
      or new.business_version_id<>prep.business_version_id or new.mode<>'acquisition') then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_acquisition_preparations where job_id=m.job_id;
    if prep.job_id is not null then
      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      branch_pin=public.get_v22_acquisition_preflight_branch_pin(prep.user_id,prep.case_id,m.job_id);
      if m.payload->>'ruleset_version'='v22_capability_public_v21' and branch_pin is not null then
        perform public.validate_v22_preflight_branch_pin(branch_pin,m.payload,pub);
      elsif m.payload->>'ruleset_version'='v22_capability_public_v21' then
        proof=m.payload->'identity_inheritance';
        select * into pinned from public.case_business_identity_versions
          where id=prep.pinned_identity_version_id and user_id=prep.user_id and case_id=prep.case_id;
        if pinned.id is null or proof->>'source_identity_version_id' is distinct from pinned.id::text
          or proof->>'source_identity_checksum' is distinct from pinned.identity_checksum
          or proof->>'source_revision' is distinct from pinned.revision::text
          or proof->>'confirmed_at' is distinct from pinned.identity#>>'{operating_model,confirmation_ref,confirmed_at}'
          or public.v22_review_hash(pub->'business_identity') is distinct from m.payload->>'identity_checksum'
          or (proof->>'branch'='retained' and pub#>>'{business_identity,selected_branch_ref}' is distinct from pinned.identity->>'selected_branch_ref')
          or (proof->>'operating_model'='retained') is distinct from (pub#>>'{business_identity,operating_model,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'operating_model'='retained' and
              ((pub#>'{business_identity,operating_model,confirmation_ref}')-'evidence_checksum') is distinct from
              ((pinned.identity#>'{operating_model,confirmation_ref}')-'evidence_checksum'))
          or (proof->>'visits'='retained') is distinct from (pub#>>'{business_identity,operating_location,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'visits'='retained' and
              ((pub#>'{business_identity,operating_location,confirmation_ref}')-array['address','source_identity_version_id']) is distinct from
              ((pinned.identity#>'{operating_location,confirmation_ref}')-'address'))
          or (proof->>'visits'='retained' and pub#>>'{business_identity,operating_location,confirmation_ref,source_identity_version_id}' is distinct from pinned.id::text)
        then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
      end if;
      if (case when pub#>>'{business_identity,schema_version}'='business_identity_v2' then
          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21'),false)
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
$patch$);
 if md5(definition)<>'4288d622a353b963ac040f5277b4230e' then raise exception 'P102_TARGET_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'6edb7a3fb074a371044bb09c7dca2506')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_check_v22_acquisition_preparation_binding';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(source)<>'5e996b873d4715831777df5be4e1399a' or md5(definition)<>'16978eaaf5bf35d8cbfc63e8924c8523' then raise exception 'P102_BASELINE_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 old := $patch$
declare report public.capability_report_versions; item jsonb; entry jsonb; source_action jsonb; dependency jsonb;
  seen text[]='{}'; layer integer=-1; current_layer integer;
begin
  select * into report from public.capability_report_versions where id=new.report_id and case_id=new.case_id and user_id=new.user_id;
  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17') then
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
end; $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_enforce_v22_delivery_prerequisites'; end if;
 definition := replace(definition,old,$patch$
declare report public.capability_report_versions; item jsonb; entry jsonb; source_action jsonb; dependency jsonb;
  seen text[]='{}'; layer integer=-1; current_layer integer;
begin
  select * into report from public.capability_report_versions where id=new.report_id and case_id=new.case_id and user_id=new.user_id;
  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') then
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
end; $patch$);
 if md5(definition)<>'a4740fc94671d835351a1ce23549e339' then raise exception 'P102_TARGET_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'38fa04c7fbfaeed6717ca885e0bbc47e')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_enforce_v22_delivery_prerequisites';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(source)<>'21b652dffff62bbc234450c19fd703cc' or md5(definition)<>'8a73e0e6b841a04d6f44e3aecea41248' then raise exception 'P102_BASELINE_MISMATCH_freeze_v22_analysis_manifest'; end if;
 old := $patch$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  a3_shape jsonb;
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
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(a3_shape->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
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
  if (a3_shape->>'schema_version'='v22_analysis_input_v10') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v20') then raise exception 'CAPABILITY_ACTION_ADVICE_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v8') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v7') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v6') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v5') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if a3_shape->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(a3_shape->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'))
    or a3_shape->>'schema_version'='v22_analysis_input_v1' and a3_shape->>'ruleset_version'='v22_capability_public_v7'
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
  if a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')
          and source->>'schema_version'='site_inventory_snapshot_v2'
        then 'site_inventory_snapshot_v2' else 'site_inventory_snapshot_v1' end when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then case
        when p_manifest->>'ruleset_version'='v22_capability_public_v22'
        then 'customer_public_gbp_snapshot_v3'
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
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_freeze_v22_analysis_manifest'; end if;
 definition := replace(definition,old,$patch$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  a3_shape jsonb;
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
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(a3_shape->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
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
  if (a3_shape->>'schema_version'='v22_analysis_input_v10') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v20') then raise exception 'CAPABILITY_ACTION_ADVICE_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v8') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v7') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v6') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v5') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if a3_shape->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(a3_shape->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'))
    or a3_shape->>'schema_version'='v22_analysis_input_v1' and a3_shape->>'ruleset_version'='v22_capability_public_v7'
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
  if a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')
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
$patch$);
 if md5(definition)<>'7f26b20183e9672aa0723062f9420291' then raise exception 'P102_TARGET_MISMATCH_freeze_v22_analysis_manifest'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'b570b42a415e852ebf420210d3f80ff6')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_freeze_v22_analysis_manifest';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(source)<>'cfd75d927271ddf2167ee3d232b24080' or md5(definition)<>'b32a1cba1877e1902463785b8f20e133' then raise exception 'P102_BASELINE_MISMATCH_get_v22_completed_plan_source'; end if;
 old := $patch$
declare r public.capability_report_versions; full_report jsonb;
begin
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null then return; end if;
  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17') then
    return query select * from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  elsif r.schema_version='2.2.3' then
    full_report=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
    if full_report is null or full_report->'report' is distinct from r.payload
      or full_report->>'payload_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
    r.payload=public.v22_review_plan_basis(r.payload);
    return next r;
  end if;
end; $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_get_v22_completed_plan_source'; end if;
 definition := replace(definition,old,$patch$
declare r public.capability_report_versions; full_report jsonb;
begin
  select * into r from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null then return; end if;
  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') then
    return query select * from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  elsif r.schema_version='2.2.3' then
    full_report=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
    if full_report is null or full_report->'report' is distinct from r.payload
      or full_report->>'payload_checksum' is distinct from r.payload_checksum then raise exception 'REVIEW_UNAVAILABLE'; end if;
    r.payload=public.v22_review_plan_basis(r.payload);
    return next r;
  end if;
end; $patch$);
 if md5(definition)<>'c3b9f2f829513e4466215cb2d3f44920' then raise exception 'P102_TARGET_MISMATCH_get_v22_completed_plan_source'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'877ea62bdcc7322363938e4f5d9b6e8d')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_get_v22_completed_plan_source';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(source)<>'73b3bbd5d26d4bc69fa597e6306b7e23' or md5(definition)<>'de05e6e93b8eca70f0fc60fb61313a9a' then raise exception 'P102_BASELINE_MISMATCH_list_v22_completed_capability_reports'; end if;
 old := $patch$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17')
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_list_v22_completed_capability_reports'; end if;
 definition := replace(definition,old,$patch$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$patch$);
 if md5(definition)<>'9b20332a342669a8d367b1c887956d21' then raise exception 'P102_TARGET_MISMATCH_list_v22_completed_capability_reports'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'e0b6181f3aee5ac5dbe721bf12247112')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_list_v22_completed_capability_reports';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(source)<>'95c5c5815ff5a6977f158feeac96c878' or md5(definition)<>'86f2ed577f195ea4ec8c490ea29c5636' then raise exception 'P102_BASELINE_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 old := $patch$
declare a3_shape jsonb; job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
  full_input jsonb; pub jsonb; src jsonb; ref jsonb; kind text; canonical text; snapshot public.data_snapshots; seen text[]='{}';
begin
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
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
    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (((a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21')
        or p_manifest->>'ruleset_version'='v22_capability_public_v22') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
    select 1 from public.capability_acquisition_preparations p where p.job_id=(p_manifest->>'job_id')::uuid and p.request ? 'target_keywords'
      and p.request#>'{target_keywords,queries}' is distinct from p_manifest->'keyword_queries') then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
    or pub#>>'{business_identity,schema_version}' is distinct from 'business_identity_v2') then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (((a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21')
        or p_manifest->>'ruleset_version'='v22_capability_public_v22') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then
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
    if kind='public_gbp' and p_manifest->>'ruleset_version'='v22_capability_public_v22' then
      perform public.validate_v22_customer_review_sample(src->'payload',p_manifest,pub#>>'{business_identity,selected_branch_ref}');
    end if;
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
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,old,$patch$
declare a3_shape jsonb; job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
  full_input jsonb; pub jsonb; src jsonb; ref jsonb; kind text; canonical text; snapshot public.data_snapshots; seen text[]='{}';
begin
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
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
    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21' and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
  full_input=p_generation_canonical::jsonb;
  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
    select 1 from public.capability_acquisition_preparations p where p.job_id=(p_manifest->>'job_id')::uuid and p.request ? 'target_keywords'
      and p.request#>'{target_keywords,queries}' is distinct from p_manifest->'keyword_queries') then raise exception 'TARGET_KEYWORDS_DISCOVERY_CONFLICT'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
    or pub#>>'{business_identity,schema_version}' is distinct from 'business_identity_v2') then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;
  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21' and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then
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
$patch$);
 if md5(definition)<>'5902b9597dd7230ea4d3e03db1670553' then raise exception 'P102_TARGET_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'4639d97f0df2dcbe623d258143cf1bea')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_prepare_v22_capability_analysis_input_core';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(source)<>'bae42543b0061e36b130280b78adeba4' or md5(definition)<>'d032a96b89e46f88b3bbab43d74d9a24' then raise exception 'P102_BASELINE_MISMATCH_save_v22_report_content_revision'; end if;
 old := $patch$
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
  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version'='v22_delivery_revision_v3' then
    perform public.validate_v22_candidate_selection(report.payload,p_content);
  elsif p_content ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version' in ('v22_delivery_revision_v2','v22_delivery_revision_v3') then
    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17')
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
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_save_v22_report_content_revision'; end if;
 definition := replace(definition,old,$patch$
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
  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version'='v22_delivery_revision_v3' then
    perform public.validate_v22_candidate_selection(report.payload,p_content);
  elsif p_content ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version' in ('v22_delivery_revision_v2','v22_delivery_revision_v3') then
    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')
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
$patch$);
 if md5(definition)<>'7e68875ac1eeec348c3e1d906312b014' then raise exception 'P102_TARGET_MISMATCH_save_v22_report_content_revision'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'38b98afa2a148d6c6cbbca7e262414ae')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_save_v22_report_content_revision';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure;
 if md5(source)<>'91aa1715a552765638ea3b410c79468a' or md5(definition)<>'4c05385cf794e527693a5bf1c68cbb85' then raise exception 'P102_BASELINE_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 old := $patch$
declare
  c public.client_cases;
  parent public.reports;
  current_report public.reports;
  existing_job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  b public.case_source_bindings;
  s public.data_snapshots;
  public_snapshot public.data_snapshots;
  public_reference jsonb;
  source text;
  selected_gsc uuid;
  selected_ga4 uuid;
  public_ids uuid[];
  resulting_balance integer;
  discovered_connection_ids uuid[];
  locked_connection_ids uuid[] := '{}'::uuid[];
  current_connection_ids uuid[];
  connection_to_lock record;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200
    or p_parent_payload_checksum is null or p_parent_payload_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;
  -- Google selection/sync locks connection -> Case -> binding. Discover without
  -- locks, then acquire every relevant connection in UUID order before the Case.
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into discovered_connection_ids
  from public.case_source_bindings binding
  join public.client_cases owned_case on owned_case.id = binding.case_id
  where binding.case_id = p_case_id and owned_case.user_id = p_user_id
    and binding.is_active and binding.source_type in ('gsc','ga4');
  for connection_to_lock in select g.id from public.google_connections g
    where g.id = any(discovered_connection_ids) and g.user_id = p_user_id
    order by g.id for update
  loop
    locked_connection_ids := array_append(locked_connection_ids, connection_to_lock.id);
  end loop;

  -- Serialize attempts only after obtaining the shared Google lock prefix.
  -- NO KEY UPDATE lets compensation's ledger FK take Case KEY SHARE while this
  -- transaction waits for the job; FOR UPDATE would form a Case/job deadlock.
  select * into c from public.client_cases
  where id = p_case_id and user_id = p_user_id and status = 'active' for no key update;
  if not found then raise exception 'V22_VERIFIED_CASE_INVALID'; end if;

  select * into existing_job from public.analysis_jobs j
  where j.id = p_job_id or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by (j.id = p_job_id) desc limit 1 for update;
  if found then
    select * into bound from public.verified_analysis_inputs i where i.job_id = existing_job.id;
    if existing_job.id is distinct from p_job_id or existing_job.case_id is distinct from p_case_id
      or existing_job.job_type <> 'verified_report' or existing_job.idempotency_key <> p_idempotency_key
      or existing_job.previous_job_id is distinct from p_previous_job_id
      or bound.job_id is null or bound.case_id <> p_case_id
      or bound.parent_report_id is distinct from p_expected_parent_report_id
      or bound.parent_payload_checksum is distinct from p_parent_payload_checksum
      or not exists (select 1 from public.analysis_attempt_charges a where a.job_id = p_job_id
        and a.case_id = p_case_id and a.user_id = p_user_id and a.source = 'account_credit') then
      raise exception 'V22_VERIFIED_IDENTITY_CONFLICT';
    end if;
    select u.audit_credits into resulting_balance from public.users u where u.id = p_user_id;
    return query select p_job_id, false, true, bound.parent_report_id, bound.gsc_snapshot_id,
      bound.ga4_snapshot_id, bound.public_gbp_snapshot_id, resulting_balance;
    return;
  end if;
  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs j where j.id = p_previous_job_id and j.case_id = p_case_id
      and j.job_type = 'verified_report' and j.status = 'failed'
  ) then raise exception 'V22_VERIFIED_PREVIOUS_JOB_INVALID'; end if;

  select * into current_report from public.reports r where r.id = c.latest_report_id for share;
  select * into parent from public.reports r
  where r.id = case when current_report.report_type = 'prospect' then current_report.id
    when current_report.report_type = 'verified_execution' then current_report.parent_report_id end for share;
  -- The trusted caller hashes a report before this transaction. Bind its exact
  -- identity to the parent selected under the Case lock before any debit/write.
  if p_expected_parent_report_id is null or parent.id is distinct from p_expected_parent_report_id then
    raise exception 'V22_VERIFIED_PARENT_CHANGED';
  end if;
  if parent.id is null or parent.user_id <> p_user_id or parent.case_id <> p_case_id
    or parent.report_type <> 'prospect' or parent.status <> 'paid_full' or parent.schema_version <> '2.2.1'
    or parent.parent_report_id is not null or jsonb_typeof(parent.report_v2_2) is distinct from 'object'
    or parent.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text
    or parent.report_v2_2 #>> '{report_version,report_id}' is distinct from parent.id::text
    or parent.report_v2_2 #>> '{report_version,report_type}' is distinct from 'prospect'
    or parent.report_v2_2 #>> '{report_version,schema_version}' is distinct from '2.2.1'
    or parent.report_v2_2 #> '{report_version,parent_report_id}' is distinct from 'null'::jsonb
    or parent.report_v2_2 #>> '{report_version,version_number}' is distinct from parent.version_number::text then
    raise exception 'V22_VERIFIED_PARENT_INVALID';
  end if;
  if cardinality(parent.snapshot_ids) is distinct from 4 or (
    select count(distinct d.source_type) from public.data_snapshots d
    where d.id = any(parent.snapshot_ids) and d.case_id = p_case_id and d.source_type in ('site','serp','competitor','gbp')
  ) <> 4 then raise exception 'V22_VERIFIED_PARENT_SNAPSHOTS_INVALID'; end if;

  select array_agg(distinct (e->>'snapshot_id')::uuid) into public_ids
  from jsonb_array_elements(parent.report_v2_2->'evidence_index') e
  where e->>'source_type' = 'gbp' and e->>'health_status' = 'healthy'
    and e #>> '{source_locator,url}' = c.business_identity->>'public_gbp_url'
    and btrim(c.business_identity->>'public_gbp_url') <> ''
    and exists (select 1 from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type' = 'gbp' and coverage->>'health_status' = 'healthy'
        and coverage->>'identity_match_status' = 'matched'
        and coverage->'snapshot_ids' @> jsonb_build_array(e->>'snapshot_id'));
  if cardinality(public_ids) is distinct from 1 or not (public_ids[1] = any(parent.snapshot_ids))
    or parent.report_v2_2 #>> '{identity,business,public_gbp_url}'
       is distinct from c.business_identity->>'public_gbp_url'
    or (select count(*) from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type'='gbp' and coverage->>'health_status'='healthy'
        and coverage->>'identity_match_status'='matched'
        and coverage->'snapshot_ids'=jsonb_build_array(public_ids[1]::text)) <> 1 then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;
  select * into public_snapshot from public.data_snapshots d
    where d.id=public_ids[1] and d.case_id=p_case_id for share;
  public_reference := public_snapshot.provider_request_context->'customer_public_gbp_reference';
  if public_snapshot.id is null or public_snapshot.source_type <> 'gbp'
    or coalesce(public_snapshot.schema_version,'') not in ('customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2','customer_public_gbp_snapshot_v3')
    or public_snapshot.health_status <> 'healthy' or public_snapshot.expires_at is null
    or public_snapshot.expires_at <= now() or public_snapshot.fetched_at > now()
    or public_snapshot.normalized_payload->>'schema_version' is distinct from public_snapshot.schema_version
    or public_snapshot.normalized_payload->>'health_status' <> 'healthy'
    or public_snapshot.normalized_payload->>'identity_match_status' <> 'matched'
    or public_snapshot.normalized_payload->>'subject_reference_checksum' !~ '^sha256:[0-9a-f]{64}$'
    or public_snapshot.provider_request_context->>'subject_reference_checksum'
       is distinct from public_snapshot.normalized_payload->>'subject_reference_checksum'
    or jsonb_typeof(public_reference) is distinct from 'object'
    or (public_reference->>'case_id')::uuid is distinct from p_case_id
    or public_reference->>'site_url' is distinct from parent.report_v2_2 #>> '{identity,business,site_url}'
    or public_reference->>'public_gbp_url' is distinct from c.business_identity->>'public_gbp_url'
    or public_reference->>'confirmation_source' is distinct from 'user'
    or public_snapshot.normalized_payload->'request_target' is distinct from jsonb_build_object(
      'public_gbp_url',public_reference->'public_gbp_url','entity_keys',public_reference->'entity_keys')
    or public_snapshot.fetched_at is distinct from (public_snapshot.normalized_payload->>'completed_at')::timestamptz
    or public_snapshot.expires_at is distinct from (public_snapshot.normalized_payload->>'expires_at')::timestamptz then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;

  perform 1 from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4')
    order by binding.id for share;
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into current_connection_ids
  from public.case_source_bindings binding
  where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4');
  -- A rebinding may finish between discovery and our Case lock. Never acquire a
  -- newly discovered connection after the Case: roll back so callers can retry.
  if current_connection_ids is distinct from discovered_connection_ids
    or current_connection_ids is distinct from locked_connection_ids then
    raise exception 'V22_VERIFIED_BINDING_CHANGED' using errcode = '40001';
  end if;
  foreach source in array array['gsc','ga4'] loop
    select * into b from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.source_type = source and binding.is_active for share;
    if b.id is null or b.identity_match_status <> 'matched' or b.confirmed_at is null
      or b.confirmed_by_user_id is distinct from p_user_id or b.health_status <> 'healthy' then
      raise exception 'V22_VERIFIED_BINDING_INVALID';
    end if;
    perform 1 from public.google_connections g
      where g.id = b.connection_id and g.user_id = p_user_id and g.status = 'active';
    if not found then raise exception 'V22_VERIFIED_CONNECTION_INVALID'; end if;
    -- Pick the latest first, then validate; never fall back to an older healthy row.
    select * into s from public.data_snapshots d where d.binding_id = b.id and d.source_type = source
      order by d.fetched_at desc, d.id desc limit 1 for share;
    if s.id is null or s.case_id <> p_case_id or s.health_status <> 'healthy'
      or s.schema_version <> source || '_sync_v1' or s.expires_at is null or s.expires_at <= now()
      or s.fetched_at > now() or s.coverage_start is null or s.coverage_end is null
      or s.raw_payload is not null
      or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id then
      raise exception 'V22_VERIFIED_SNAPSHOT_INVALID';
    end if;
    if source = 'gsc' then selected_gsc := s.id; else selected_ga4 := s.id; end if;
  end loop;
  if public_ids[1] in (selected_gsc, selected_ga4) then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  update public.users u set audit_credits = u.audit_credits - 1
    where u.id = p_user_id and u.audit_credits >= 1 returning u.audit_credits into resulting_balance;
  if resulting_balance is null then raise exception 'V22_VERIFIED_CREDIT_UNAVAILABLE'; end if;
  insert into public.analysis_jobs (
    id,case_id,job_type,status,current_stage,progress,attempt_count,idempotency_key,
    cost_counters,run_generation,deadline_at,previous_job_id
  ) values (p_job_id,p_case_id,'verified_report','queued','queued',0,0,p_idempotency_key,
    '{}'::jsonb,1,now()+interval '20 minutes',p_previous_job_id);
  insert into public.analysis_attempt_charges(user_id,case_id,job_id,source)
    values (p_user_id,p_case_id,p_job_id,'account_credit');
  insert into public.audit_credit_ledger(user_id,case_id,job_id,kind,delta,balance_after)
    values (p_user_id,p_case_id,p_job_id,'attempt_debit',-1,resulting_balance);
  -- Service-role caller hashes the complete ReportV22 using recursive sorted keys,
  -- preserved array order and JSON.stringify. Do not reserialize JSONB for hashing:
  -- PostgreSQL numeric scale is not the application's canonical byte encoding.
  insert into public.verified_analysis_inputs(job_id,case_id,parent_report_id,gsc_snapshot_id,
    ga4_snapshot_id,public_gbp_snapshot_id,parent_snapshot_ids,parent_payload,parent_payload_checksum)
    values (p_job_id,p_case_id,parent.id,selected_gsc,selected_ga4,public_ids[1],
      parent.snapshot_ids,parent.report_v2_2,p_parent_payload_checksum);
  return query select p_job_id,true,false,parent.id,selected_gsc,selected_ga4,public_ids[1],resulting_balance;
end;
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 definition := replace(definition,old,$patch$
declare
  c public.client_cases;
  parent public.reports;
  current_report public.reports;
  existing_job public.analysis_jobs;
  bound public.verified_analysis_inputs;
  b public.case_source_bindings;
  s public.data_snapshots;
  public_snapshot public.data_snapshots;
  public_reference jsonb;
  source text;
  selected_gsc uuid;
  selected_ga4 uuid;
  public_ids uuid[];
  resulting_balance integer;
  discovered_connection_ids uuid[];
  locked_connection_ids uuid[] := '{}'::uuid[];
  current_connection_ids uuid[];
  connection_to_lock record;
begin
  if p_job_id is null or btrim(coalesce(p_idempotency_key, '')) = '' or length(p_idempotency_key) > 200
    or p_parent_payload_checksum is null or p_parent_payload_checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'V22_VERIFIED_INPUT_INVALID';
  end if;
  -- Google selection/sync locks connection -> Case -> binding. Discover without
  -- locks, then acquire every relevant connection in UUID order before the Case.
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into discovered_connection_ids
  from public.case_source_bindings binding
  join public.client_cases owned_case on owned_case.id = binding.case_id
  where binding.case_id = p_case_id and owned_case.user_id = p_user_id
    and binding.is_active and binding.source_type in ('gsc','ga4');
  for connection_to_lock in select g.id from public.google_connections g
    where g.id = any(discovered_connection_ids) and g.user_id = p_user_id
    order by g.id for update
  loop
    locked_connection_ids := array_append(locked_connection_ids, connection_to_lock.id);
  end loop;

  -- Serialize attempts only after obtaining the shared Google lock prefix.
  -- NO KEY UPDATE lets compensation's ledger FK take Case KEY SHARE while this
  -- transaction waits for the job; FOR UPDATE would form a Case/job deadlock.
  select * into c from public.client_cases
  where id = p_case_id and user_id = p_user_id and status = 'active' for no key update;
  if not found then raise exception 'V22_VERIFIED_CASE_INVALID'; end if;

  select * into existing_job from public.analysis_jobs j
  where j.id = p_job_id or (j.case_id = p_case_id and j.idempotency_key = p_idempotency_key)
  order by (j.id = p_job_id) desc limit 1 for update;
  if found then
    select * into bound from public.verified_analysis_inputs i where i.job_id = existing_job.id;
    if existing_job.id is distinct from p_job_id or existing_job.case_id is distinct from p_case_id
      or existing_job.job_type <> 'verified_report' or existing_job.idempotency_key <> p_idempotency_key
      or existing_job.previous_job_id is distinct from p_previous_job_id
      or bound.job_id is null or bound.case_id <> p_case_id
      or bound.parent_report_id is distinct from p_expected_parent_report_id
      or bound.parent_payload_checksum is distinct from p_parent_payload_checksum
      or not exists (select 1 from public.analysis_attempt_charges a where a.job_id = p_job_id
        and a.case_id = p_case_id and a.user_id = p_user_id and a.source = 'account_credit') then
      raise exception 'V22_VERIFIED_IDENTITY_CONFLICT';
    end if;
    select u.audit_credits into resulting_balance from public.users u where u.id = p_user_id;
    return query select p_job_id, false, true, bound.parent_report_id, bound.gsc_snapshot_id,
      bound.ga4_snapshot_id, bound.public_gbp_snapshot_id, resulting_balance;
    return;
  end if;
  if p_previous_job_id is not null and not exists (
    select 1 from public.analysis_jobs j where j.id = p_previous_job_id and j.case_id = p_case_id
      and j.job_type = 'verified_report' and j.status = 'failed'
  ) then raise exception 'V22_VERIFIED_PREVIOUS_JOB_INVALID'; end if;

  select * into current_report from public.reports r where r.id = c.latest_report_id for share;
  select * into parent from public.reports r
  where r.id = case when current_report.report_type = 'prospect' then current_report.id
    when current_report.report_type = 'verified_execution' then current_report.parent_report_id end for share;
  -- The trusted caller hashes a report before this transaction. Bind its exact
  -- identity to the parent selected under the Case lock before any debit/write.
  if p_expected_parent_report_id is null or parent.id is distinct from p_expected_parent_report_id then
    raise exception 'V22_VERIFIED_PARENT_CHANGED';
  end if;
  if parent.id is null or parent.user_id <> p_user_id or parent.case_id <> p_case_id
    or parent.report_type <> 'prospect' or parent.status <> 'paid_full' or parent.schema_version <> '2.2.1'
    or parent.parent_report_id is not null or jsonb_typeof(parent.report_v2_2) is distinct from 'object'
    or parent.report_v2_2 #>> '{identity,case_id}' is distinct from p_case_id::text
    or parent.report_v2_2 #>> '{report_version,report_id}' is distinct from parent.id::text
    or parent.report_v2_2 #>> '{report_version,report_type}' is distinct from 'prospect'
    or parent.report_v2_2 #>> '{report_version,schema_version}' is distinct from '2.2.1'
    or parent.report_v2_2 #> '{report_version,parent_report_id}' is distinct from 'null'::jsonb
    or parent.report_v2_2 #>> '{report_version,version_number}' is distinct from parent.version_number::text then
    raise exception 'V22_VERIFIED_PARENT_INVALID';
  end if;
  if cardinality(parent.snapshot_ids) is distinct from 4 or (
    select count(distinct d.source_type) from public.data_snapshots d
    where d.id = any(parent.snapshot_ids) and d.case_id = p_case_id and d.source_type in ('site','serp','competitor','gbp')
  ) <> 4 then raise exception 'V22_VERIFIED_PARENT_SNAPSHOTS_INVALID'; end if;

  select array_agg(distinct (e->>'snapshot_id')::uuid) into public_ids
  from jsonb_array_elements(parent.report_v2_2->'evidence_index') e
  where e->>'source_type' = 'gbp' and e->>'health_status' = 'healthy'
    and e #>> '{source_locator,url}' = c.business_identity->>'public_gbp_url'
    and btrim(c.business_identity->>'public_gbp_url') <> ''
    and exists (select 1 from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type' = 'gbp' and coverage->>'health_status' = 'healthy'
        and coverage->>'identity_match_status' = 'matched'
        and coverage->'snapshot_ids' @> jsonb_build_array(e->>'snapshot_id'));
  if cardinality(public_ids) is distinct from 1 or not (public_ids[1] = any(parent.snapshot_ids))
    or parent.report_v2_2 #>> '{identity,business,public_gbp_url}'
       is distinct from c.business_identity->>'public_gbp_url'
    or (select count(*) from jsonb_array_elements(parent.report_v2_2 #> '{data_coverage,sources}') coverage
      where coverage->>'source_type'='gbp' and coverage->>'health_status'='healthy'
        and coverage->>'identity_match_status'='matched'
        and coverage->'snapshot_ids'=jsonb_build_array(public_ids[1]::text)) <> 1 then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;
  select * into public_snapshot from public.data_snapshots d
    where d.id=public_ids[1] and d.case_id=p_case_id for share;
  public_reference := public_snapshot.provider_request_context->'customer_public_gbp_reference';
  if public_snapshot.id is null or public_snapshot.source_type <> 'gbp'
    or coalesce(public_snapshot.schema_version,'') not in ('customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2')
    or public_snapshot.health_status <> 'healthy' or public_snapshot.expires_at is null
    or public_snapshot.expires_at <= now() or public_snapshot.fetched_at > now()
    or public_snapshot.normalized_payload->>'schema_version' is distinct from public_snapshot.schema_version
    or public_snapshot.normalized_payload->>'health_status' <> 'healthy'
    or public_snapshot.normalized_payload->>'identity_match_status' <> 'matched'
    or public_snapshot.normalized_payload->>'subject_reference_checksum' !~ '^sha256:[0-9a-f]{64}$'
    or public_snapshot.provider_request_context->>'subject_reference_checksum'
       is distinct from public_snapshot.normalized_payload->>'subject_reference_checksum'
    or jsonb_typeof(public_reference) is distinct from 'object'
    or (public_reference->>'case_id')::uuid is distinct from p_case_id
    or public_reference->>'site_url' is distinct from parent.report_v2_2 #>> '{identity,business,site_url}'
    or public_reference->>'public_gbp_url' is distinct from c.business_identity->>'public_gbp_url'
    or public_reference->>'confirmation_source' is distinct from 'user'
    or public_snapshot.normalized_payload->'request_target' is distinct from jsonb_build_object(
      'public_gbp_url',public_reference->'public_gbp_url','entity_keys',public_reference->'entity_keys')
    or public_snapshot.fetched_at is distinct from (public_snapshot.normalized_payload->>'completed_at')::timestamptz
    or public_snapshot.expires_at is distinct from (public_snapshot.normalized_payload->>'expires_at')::timestamptz then
    raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID';
  end if;

  perform 1 from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4')
    order by binding.id for share;
  select coalesce(array_agg(distinct binding.connection_id order by binding.connection_id)
    filter (where binding.connection_id is not null), '{}'::uuid[]) into current_connection_ids
  from public.case_source_bindings binding
  where binding.case_id = p_case_id and binding.is_active and binding.source_type in ('gsc','ga4');
  -- A rebinding may finish between discovery and our Case lock. Never acquire a
  -- newly discovered connection after the Case: roll back so callers can retry.
  if current_connection_ids is distinct from discovered_connection_ids
    or current_connection_ids is distinct from locked_connection_ids then
    raise exception 'V22_VERIFIED_BINDING_CHANGED' using errcode = '40001';
  end if;
  foreach source in array array['gsc','ga4'] loop
    select * into b from public.case_source_bindings binding
    where binding.case_id = p_case_id and binding.source_type = source and binding.is_active for share;
    if b.id is null or b.identity_match_status <> 'matched' or b.confirmed_at is null
      or b.confirmed_by_user_id is distinct from p_user_id or b.health_status <> 'healthy' then
      raise exception 'V22_VERIFIED_BINDING_INVALID';
    end if;
    perform 1 from public.google_connections g
      where g.id = b.connection_id and g.user_id = p_user_id and g.status = 'active';
    if not found then raise exception 'V22_VERIFIED_CONNECTION_INVALID'; end if;
    -- Pick the latest first, then validate; never fall back to an older healthy row.
    select * into s from public.data_snapshots d where d.binding_id = b.id and d.source_type = source
      order by d.fetched_at desc, d.id desc limit 1 for share;
    if s.id is null or s.case_id <> p_case_id or s.health_status <> 'healthy'
      or s.schema_version <> source || '_sync_v1' or s.expires_at is null or s.expires_at <= now()
      or s.fetched_at > now() or s.coverage_start is null or s.coverage_end is null
      or s.raw_payload is not null
      or s.provider_request_context->>'external_resource_id' is distinct from b.external_resource_id then
      raise exception 'V22_VERIFIED_SNAPSHOT_INVALID';
    end if;
    if source = 'gsc' then selected_gsc := s.id; else selected_ga4 := s.id; end if;
  end loop;
  if public_ids[1] in (selected_gsc, selected_ga4) then raise exception 'V22_VERIFIED_PUBLIC_GBP_INVALID'; end if;

  perform 1 from public.users u where u.id = p_user_id for update;
  update public.users u set audit_credits = u.audit_credits - 1
    where u.id = p_user_id and u.audit_credits >= 1 returning u.audit_credits into resulting_balance;
  if resulting_balance is null then raise exception 'V22_VERIFIED_CREDIT_UNAVAILABLE'; end if;
  insert into public.analysis_jobs (
    id,case_id,job_type,status,current_stage,progress,attempt_count,idempotency_key,
    cost_counters,run_generation,deadline_at,previous_job_id
  ) values (p_job_id,p_case_id,'verified_report','queued','queued',0,0,p_idempotency_key,
    '{}'::jsonb,1,now()+interval '20 minutes',p_previous_job_id);
  insert into public.analysis_attempt_charges(user_id,case_id,job_id,source)
    values (p_user_id,p_case_id,p_job_id,'account_credit');
  insert into public.audit_credit_ledger(user_id,case_id,job_id,kind,delta,balance_after)
    values (p_user_id,p_case_id,p_job_id,'attempt_debit',-1,resulting_balance);
  -- Service-role caller hashes the complete ReportV22 using recursive sorted keys,
  -- preserved array order and JSON.stringify. Do not reserialize JSONB for hashing:
  -- PostgreSQL numeric scale is not the application's canonical byte encoding.
  insert into public.verified_analysis_inputs(job_id,case_id,parent_report_id,gsc_snapshot_id,
    ga4_snapshot_id,public_gbp_snapshot_id,parent_snapshot_ids,parent_payload,parent_payload_checksum)
    values (p_job_id,p_case_id,parent.id,selected_gsc,selected_ga4,public_ids[1],
      parent.snapshot_ids,parent.report_v2_2,p_parent_payload_checksum);
  return query select p_job_id,true,false,parent.id,selected_gsc,selected_ga4,public_ids[1],resulting_balance;
end;
$patch$);
 if md5(definition)<>'58366933c7bd8fd9435f0e6d8b05cbc6' then raise exception 'P102_TARGET_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'fbb82903e09e0b47d95cfe38bff0fcc7')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(source)<>'06d3d0d1b6d85a7e9ac13f097f3a5ead' or md5(definition)<>'9fb6881aa61bec49015c6f38114b0d8f' then raise exception 'P102_BASELINE_MISMATCH_store_v22_capability_report'; end if;
 old := $patch$
declare manifest public.analysis_input_manifests; saved public.capability_report_versions; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into manifest from public.analysis_input_manifests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if not found then raise exception 'CAPABILITY_MANIFEST_NOT_FOUND'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex');
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_canonical_content)>2000000
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v22' then '2.2.17' when manifest.payload->>'ruleset_version'='v22_capability_public_v21' then '2.2.16' when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
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
  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16','2.2.17') and (
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
  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21','v22_capability_public_v22') then
    if jsonb_typeof(p_payload->'contact_checks') is distinct from 'array'
      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21','v22_capability_public_v22') then 5 else 4 end)
      or exists (select 1 from jsonb_array_elements(p_payload->'contact_checks') c where
        (coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21','v22_capability_public_v22') and c->>'field'='opening_hours'))
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
$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,old,$patch$
declare manifest public.analysis_input_manifests; saved public.capability_report_versions; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into manifest from public.analysis_input_manifests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if not found then raise exception 'CAPABILITY_MANIFEST_NOT_FOUND'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex');
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_canonical_content)>2000000
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v21' then '2.2.16' when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
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
  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') and (
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
  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') then
    if jsonb_typeof(p_payload->'contact_checks') is distinct from 'array'
      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') then 5 else 4 end)
      or exists (select 1 from jsonb_array_elements(p_payload->'contact_checks') c where
        (coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') and c->>'field'='opening_hours'))
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
$patch$);
 if md5(definition)<>'9a6b53b668e38d18dc61b38435ba0bc7' then raise exception 'P102_TARGET_MISMATCH_store_v22_capability_report'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'5cf5e7bd11e77a91dc871033a466b81b')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_store_v22_capability_report';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.v22_a3_manifest_shape(jsonb)'::regprocedure;
 if md5(source)<>'5da9618d0d5796cc9f37ba0c99e8f14b' or md5(definition)<>'4b2b6fccd5ad492ea71d2fdd41c064d7' then raise exception 'P102_BASELINE_MISMATCH_v22_a3_manifest_shape'; end if;
 old := $patch$
declare shape jsonb; proof jsonb; manifest_version text; ruleset text;
begin
 if coalesce(m->>'schema_version','') not in ('v22_analysis_input_v11','v22_analysis_input_v12') and coalesce(m->>'ruleset_version','') not in ('v22_capability_public_v21','v22_capability_public_v22') then
   if m ? 'identity_inheritance' then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
   return m;
 end if;
 proof=m->'identity_inheritance'; ruleset=proof->>'base_ruleset';
 manifest_version=case ruleset when 'v22_capability_public_v13' then 'v22_analysis_input_v3' when 'v22_capability_public_v14' then 'v22_analysis_input_v4' when 'v22_capability_public_v15' then 'v22_analysis_input_v5' when 'v22_capability_public_v16' then 'v22_analysis_input_v6' when 'v22_capability_public_v17' then 'v22_analysis_input_v7' when 'v22_capability_public_v18' then 'v22_analysis_input_v8' when 'v22_capability_public_v20' then 'v22_analysis_input_v10' end;
 if coalesce(m->>'schema_version','') not in ('v22_analysis_input_v11','v22_analysis_input_v12') or coalesce(m->>'ruleset_version','') not in ('v22_capability_public_v21','v22_capability_public_v22')
   or (m->>'schema_version'='v22_analysis_input_v12') is distinct from (m->>'ruleset_version'='v22_capability_public_v22')
   or (m->>'ruleset_version'='v22_capability_public_v22' and (
     coalesce(proof->>'branch','')<>'retained' or coalesce(ruleset,'') in ('','v22_capability_public_v13','v22_capability_public_v14')
     or not exists(select 1 from jsonb_array_elements(m->'snapshots') s
                   where s->>'source_kind'='public_gbp' and s->>'schema_version'='customer_public_gbp_snapshot_v3')))
   or m->>'mode' is distinct from 'acquisition' or m ? 'execution_type' or manifest_version is null
   or jsonb_typeof(proof) is distinct from 'object'
   or not (proof ?& array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits'])
   or proof-array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits']<>'{}'::jsonb
   or coalesce(proof->>'source_identity_version_id','') !~ '^[a-f0-9-]{36}$'
   or coalesce(proof->>'source_identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
   or jsonb_typeof(proof->'source_revision')<>'number' or coalesce(proof->>'source_revision','') !~ '^[1-9][0-9]*$'
   or coalesce(proof->>'confirmed_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
   or (proof->>'confirmed_at')::timestamptz>(m->>'evaluated_at')::timestamptz
   or coalesce(proof->>'branch','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'operating_model','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'visits','') not in ('retained','needs_confirmation','not_previously_confirmed')
   or (proof->>'branch'='needs_confirmation' and (proof->>'operating_model'='retained' or proof->>'visits'='retained'))
 then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
 return (m-'identity_inheritance') || jsonb_build_object('schema_version',manifest_version,'ruleset_version',ruleset);
end $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_manifest_shape'; end if;
 definition := replace(definition,old,$patch$
declare shape jsonb; proof jsonb; manifest_version text; ruleset text;
begin
 if m->>'schema_version' is distinct from 'v22_analysis_input_v11' and m->>'ruleset_version' is distinct from 'v22_capability_public_v21' then
   if m ? 'identity_inheritance' then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
   return m;
 end if;
 proof=m->'identity_inheritance'; ruleset=proof->>'base_ruleset';
 manifest_version=case ruleset when 'v22_capability_public_v13' then 'v22_analysis_input_v3' when 'v22_capability_public_v14' then 'v22_analysis_input_v4' when 'v22_capability_public_v15' then 'v22_analysis_input_v5' when 'v22_capability_public_v16' then 'v22_analysis_input_v6' when 'v22_capability_public_v17' then 'v22_analysis_input_v7' when 'v22_capability_public_v18' then 'v22_analysis_input_v8' when 'v22_capability_public_v20' then 'v22_analysis_input_v10' end;
 if m->>'schema_version' is distinct from 'v22_analysis_input_v11' or m->>'ruleset_version' is distinct from 'v22_capability_public_v21'
   or m->>'mode' is distinct from 'acquisition' or m ? 'execution_type' or manifest_version is null
   or jsonb_typeof(proof) is distinct from 'object'
   or not (proof ?& array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits'])
   or proof-array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits']<>'{}'::jsonb
   or coalesce(proof->>'source_identity_version_id','') !~ '^[a-f0-9-]{36}$'
   or coalesce(proof->>'source_identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
   or jsonb_typeof(proof->'source_revision')<>'number' or coalesce(proof->>'source_revision','') !~ '^[1-9][0-9]*$'
   or coalesce(proof->>'confirmed_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
   or (proof->>'confirmed_at')::timestamptz>(m->>'evaluated_at')::timestamptz
   or coalesce(proof->>'branch','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'operating_model','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'visits','') not in ('retained','needs_confirmation','not_previously_confirmed')
   or (proof->>'branch'='needs_confirmation' and (proof->>'operating_model'='retained' or proof->>'visits'='retained'))
 then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
 return (m-'identity_inheritance') || jsonb_build_object('schema_version',manifest_version,'ruleset_version',ruleset);
end $patch$);
 if md5(definition)<>'30a3d88907d1394fdf17f94ade2d1e2f' then raise exception 'P102_TARGET_MISMATCH_v22_a3_manifest_shape'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.v22_a3_manifest_shape(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'0b0e5c86c8766ff7430d5ec9caf809d3')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_v22_a3_manifest_shape';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.v22_a3_report_shape(jsonb)'::regprocedure;
 if md5(source)<>'fbf8ca15345158e603c0f86b99244f0e' or md5(definition)<>'71651369f909486795bf207f1cf7a2fe' then raise exception 'P102_BASELINE_MISMATCH_v22_a3_report_shape'; end if;
 old := $patch$
declare shape jsonb; version text;
begin
 shape=public.v22_a3_manifest_shape(p->'input_manifest');
 if (coalesce(p->>'schema_version'='2.2.16',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v21'))
    or (coalesce(p->>'schema_version'='2.2.17',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v22')) then
   raise exception 'CAPABILITY_REPORT_INVALID';
 end if;
 if coalesce(p->>'schema_version','') not in ('2.2.16','2.2.17') then return p; end if;
 version=case shape->>'ruleset_version' when 'v22_capability_public_v13' then '2.2.8' when 'v22_capability_public_v14' then '2.2.9' when 'v22_capability_public_v15' then '2.2.10' when 'v22_capability_public_v16' then '2.2.11' when 'v22_capability_public_v17' then '2.2.12' when 'v22_capability_public_v18' then '2.2.13' when 'v22_capability_public_v20' then '2.2.15' end;
 return p || jsonb_build_object('schema_version',version,'input_manifest',shape);
end $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_report_shape'; end if;
 definition := replace(definition,old,$patch$
declare shape jsonb; version text;
begin
 shape=public.v22_a3_manifest_shape(p->'input_manifest');
 if coalesce(p->>'schema_version'='2.2.16',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v21') then
   raise exception 'CAPABILITY_REPORT_INVALID';
 end if;
 if p->>'schema_version' is distinct from '2.2.16' then return p; end if;
 version=case shape->>'ruleset_version' when 'v22_capability_public_v13' then '2.2.8' when 'v22_capability_public_v14' then '2.2.9' when 'v22_capability_public_v15' then '2.2.10' when 'v22_capability_public_v16' then '2.2.11' when 'v22_capability_public_v17' then '2.2.12' when 'v22_capability_public_v18' then '2.2.13' when 'v22_capability_public_v20' then '2.2.15' end;
 return p || jsonb_build_object('schema_version',version,'input_manifest',shape);
end $patch$);
 if md5(definition)<>'fdc05e39ee9be73c617b0b2f6062640b' then raise exception 'P102_TARGET_MISMATCH_v22_a3_report_shape'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.v22_a3_report_shape(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'3a783fc8d5dbe0c59941b4974b14b3b3')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_v22_a3_report_shape';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(source)<>'48f876bc969beb47c77784dcd5c91707' or md5(definition)<>'45b51b2493d35b5f21e0f765a1b0defa' then raise exception 'P102_BASELINE_MISMATCH_validate_v22_gbp_comparison'; end if;
 old := $patch$
declare m jsonb; review_version boolean=coalesce(p->>'schema_version'='2.2.17',false); v jsonb=p->'gbp_comparison'; customer jsonb; rivals jsonb; market jsonb; run jsonb; record jsonb; call jsonb; profile_time timestamptz; customer_time timestamptz;
 row jsonb; item jsonb; original jsonb; profile jsonb; review jsonb; d jsonb; other jsonb; val jsonb;
 source_id text; customer_id text; rival_id text; field text; path text; idx integer=0; n integer; r integer; count90 integer;
 ts timestamptz; latest timestamptz; bad_dates boolean; min_at timestamptz; max_at timestamptz; i integer;
begin
  p=public.v22_a3_report_shape(p);
  m := p->'input_manifest';
 if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
  if p ? 'gbp_comparison' then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
  or v->>'schema_version' is distinct from (case when review_version then 'gbp_comparison_v2' else 'gbp_comparison_v1' end) or jsonb_typeof(v->'rows') is distinct from 'array'
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
   if review_version and idx=0 and field in ('reviews_90d','latest_review','visible_replies') then
    perform public.validate_v22_customer_review_metric(customer,customer_id,customer_time,field,item);
    continue;
   end if;
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
   if (field not in ('categories','rating','review_count') and not (review_version and field in ('reviews_90d','latest_review'))) or item->>'status' is distinct from 'observed' or item->>'sampled_at' is null
    or jsonb_array_length(d->'competitor_indices')<2 or jsonb_array_length(d->'competitor_indices')>3 or d->>'reason' is distinct from 'same_direction'
    or (select count(distinct x) from jsonb_array_elements(d->'competitor_indices') x)<>jsonb_array_length(d->'competitor_indices') then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
   min_at=(item->>'sampled_at')::timestamptz;max_at=min_at;
   for i in select value::integer from jsonb_array_elements_text(d->'competitor_indices') loop
    other=v#>array['rows',i::text,'metrics',field];
    if i<1 or i>=jsonb_array_length(v->'rows') or other->>'status' is distinct from 'observed' or other->>'sampled_at' is null
     or ((not review_version or field<>'reviews_90d') and (other->>'lower_bound' is distinct from 'false' or item->>'lower_bound' is distinct from 'false')) then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
    if field='categories' and (d->>'direction' is distinct from 'different_categories' or not exists(
      select 1 from jsonb_array_elements_text(other->'value') category where not (item->'value' ? category)
      and (select count(*) from jsonb_array_elements_text(d->'competitor_indices') ci where v#>array['rows',ci,'metrics','categories','value'] ? category)>=2))
     then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    if review_version and field='latest_review' then
     if not ((d->>'direction'='higher' and (other->>'value')::timestamptz>(item->>'value')::timestamptz)
       or (d->>'direction'='lower' and (other->>'value')::timestamptz<(item->>'value')::timestamptz)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif review_version and field='reviews_90d' then
     if not ((d->>'direction'='higher' and item->>'lower_bound'='false' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and other->>'lower_bound'='false' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif field<>'categories' and not ((d->>'direction'='higher' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    min_at=least(min_at,(other->>'sampled_at')::timestamptz);max_at=greatest(max_at,(other->>'sampled_at')::timestamptz);
   end loop;
   if max_at-min_at>interval '24 hours' then raise exception 'CAPABILITY_GBP_COMPARISON_TIME_INVALID'; end if;
  elsif d->'direction' is distinct from 'null'::jsonb or d->'competitor_indices' is distinct from '[]'::jsonb then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if;
  idx=idx+1;
 end loop;
end $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$
declare m jsonb; v jsonb=p->'gbp_comparison'; customer jsonb; rivals jsonb; market jsonb; run jsonb; record jsonb; call jsonb; profile_time timestamptz; customer_time timestamptz;
 row jsonb; item jsonb; original jsonb; profile jsonb; review jsonb; d jsonb; other jsonb; val jsonb;
 source_id text; customer_id text; rival_id text; field text; path text; idx integer=0; n integer; r integer; count90 integer;
 ts timestamptz; latest timestamptz; bad_dates boolean; min_at timestamptz; max_at timestamptz; i integer;
begin
  p=public.v22_a3_report_shape(p);
  m := p->'input_manifest';
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
end $patch$);
 if md5(definition)<>'7b0379ddc64e732f7d783f032e109469' then raise exception 'P102_TARGET_MISMATCH_validate_v22_gbp_comparison'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'0c8ef85809288363c25b47bc8ae303d5')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_validate_v22_gbp_comparison';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure;
 if md5(source)<>'9f99a3793ae9e9cb48140167e26180b9' or md5(definition)<>'b41df040ff85c38df0bb2e4c1b0175b1' then raise exception 'P102_BASELINE_MISMATCH_validate_v22_possible_reasons'; end if;
 old := $patch$
declare m jsonb; g jsonb=p->'gbp_comparison'; original_report jsonb=p;
 review_version boolean=coalesce(p->>'schema_version'='2.2.17',false); dates text; d jsonb; item jsonb; items jsonb='[]'; refs jsonb; indices jsonb;
 metric text; label text; own text; nums text; own_value text; i integer; idx integer; wanted jsonb;
begin
  p=public.v22_a3_report_shape(p);
  m := p->'input_manifest';
 if coalesce(p->>'schema_version','') not in ('2.2.12','2.2.13','2.2.15') then
  if p ? 'possible_reasons' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' else 'v22_capability_public_v17' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' else 'v22_analysis_input_v7' end) then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
 perform public.validate_v22_gbp_comparison(case when review_version then original_report else p end);
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
 if review_version and g#>>'{differences,3,direction}'='higher' and g#>>'{differences,4,direction}'='higher' then
  select to_jsonb(array_agg(x::int order by x::int)) into indices
   from jsonb_array_elements_text(g#>'{differences,3,competitor_indices}') x
   where (g#>'{differences,4,competitor_indices}') @> jsonb_build_array(x::int);
  if jsonb_array_length(indices)>=2 then
   refs=jsonb_build_array('/gbp_comparison/differences/3','/gbp_comparison/differences/4');
   foreach metric in array array['reviews_90d','latest_review'] loop
    refs=refs||(g#>array['rows','0','metrics',metric,'source_refs']);
    for i in select value::int from jsonb_array_elements_text(indices) loop
     refs=refs||(g#>array['rows',i::text,'metrics',metric,'source_refs']);
    end loop;
   end loop;
   nums='';dates='';
   for i in select value::int from jsonb_array_elements_text(indices) loop
    nums=concat_ws(', ',nullif(nums,''),(case when g#>>array['rows',i::text,'metrics','reviews_90d','lower_bound']='true' then 'at least ' else '' end)
       ||trim_scale((g#>>array['rows',i::text,'metrics','reviews_90d','value'])::numeric)::text);
    dates=concat_ws(', ',nullif(dates,''),left(g#>>array['rows',i::text,'metrics','latest_review','value'],10));
   end loop;
   item=jsonb_build_object('metric','recent_review_activity','classification','inference','basis_refs',refs,'competitor_indices',indices,'customer_text',
     'Sample competitors had '||nums||' reviews in their 90-day windows and sample latest dates of '||dates||'. Your profile had '
     ||trim_scale((g#>>'{rows,0,metrics,reviews_90d,value}')::numeric)::text||' reviews in its sampled 90-day window and a sample latest date of '
     ||left(g#>>'{rows,0,metrics,latest_review,value}',10)||'. This difference may be one contributing factor. These observations do not establish ranking causation.');
   items=items||jsonb_build_array(item);
  end if;
 end if;
 wanted=jsonb_build_object('schema_version',case when review_version then 'possible_reasons_v2' else 'possible_reasons_v1' end,'status',case when jsonb_array_length(items)>0 then 'assessed' else 'not_assessed' end,'items',items);
 if p->'possible_reasons' is distinct from wanted then raise exception 'CAPABILITY_REASONS_BINDING_INVALID';end if;
end $patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_possible_reasons'; end if;
 definition := replace(definition,old,$patch$
declare m jsonb; g jsonb=p->'gbp_comparison'; d jsonb; item jsonb; items jsonb='[]'; refs jsonb; indices jsonb;
 metric text; label text; own text; nums text; own_value text; i integer; idx integer; wanted jsonb;
begin
  p=public.v22_a3_report_shape(p);
  m := p->'input_manifest';
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
end $patch$);
 if md5(definition)<>'3291d74a000c8ff0139faf0c10cc54fe' then raise exception 'P102_TARGET_MISMATCH_validate_v22_possible_reasons'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'e5ed327182dbab4779f652dff4cd4d2c')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_validate_v22_possible_reasons';end if;
end $migration$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from '257b4727e1067bed05e15cf2e530b14e' then
  raise exception 'P102_BASELINE_MISMATCH_capability_report_input_variant';end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from '7343c61ba462f5ead01919722848e889' then
  raise exception 'P102_BASELINE_MISMATCH_capability_report_versions_schema_version_check';end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text])));
end $constraint$;

drop function public.validate_v22_customer_review_sample(jsonb,jsonb,text);
drop function public.validate_v22_customer_review_metric(jsonb,text,timestamptz,text,jsonb);
commit;
