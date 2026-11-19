-- P1-09. Rollback definitions in docs/acquisition-plan/rollback/20261119110000/.

begin;

create function public.validate_v22_action_advice(p jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $advice$
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
$advice$;
revoke all on function public.validate_v22_action_advice(jsonb) from public, anon, authenticated;
grant execute on function public.validate_v22_action_advice(jsonb) to service_role;


do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from '7eb920b4d7448c45286283b21e9e0de3' then raise exception 'V20_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from '5efe2a5e37e3df2ff8095ad70f739e97' then raise exception 'V20_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text])));
end $constraint$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition) <> '66839ee6958656fee884649824f97f93' or (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure) <> '69e04a08e050f379d093b978cce1ea59' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';
 end if;
 previous := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18'),false)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'),false)
$new$);
 if md5(definition) <> 'eb3a93fa608c8547641bc6d9b8d14fd8' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '6ccda16035beaa2295294312946f000b')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition) <> '048defbf583ff11205fd2929b9cff579' or (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure) <> 'a8ac53b46740b5aea057eccf84b57574' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';
 end if;
 previous := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 if md5(definition) <> 'd3b6d324634673ff72c44f08433fc793' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'ea5bbd5bb2d13703f6c24347b96190ff')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition) <> '95249e4df132810f4a41394c80ca127b' or (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) <> '6a6a4f69a71ba2eac10424f3b69c6397' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';
 end if;
 previous := $old$
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
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') then
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
  if (p_manifest->>'schema_version'='v22_analysis_input_v8') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v7') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18'))
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
  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18')
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
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$
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
$new$);
 if md5(definition) <> '02006f638ef65f53f8116ae90a926729' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'f7765af77b2f63627f05c22197aa7770')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition) <> '4999e57ce90bfa2f16f18110792a1011' or (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) <> '172f228fee8b2ab9755662b185c0b882' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';
 end if;
 previous := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 if md5(definition) <> '00e51f429b6e19380df377d1dae155a4' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'b18f8c8b763e4da941a397fdb5b2aa88')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition) <> 'be855b1c7b054de2ebd67d498ab154c7' or (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) <> '2817cb748ab207890ff068739bb1db6e' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';
 end if;
 previous := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition) <> '458c732a46ccbf1671c2a16633d2e855' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'c570a9440f929a9f1b0b484479be7d2f')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition) <> '70e37eba9f81816a3c4c4645e9715662' or (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure) <> '470f2a10a8cc32ae0a0cc5b9e6b8f2be' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';
 end if;
 previous := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
$new$);
 if md5(definition) <> 'aeb06d5e15fc006bb2af5785c66d6e2d' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '6950b9316ce591e0865a5d6e41aaa3f4')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition) <> 'b53b65aa05a9d18e78de571f88873c7f' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure) <> 'e881b99c1b2faf962c9ac335a2a5ceb8' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';
 end if;
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and exists(
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
$new$);
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 if md5(definition) <> '36152bfd22b17033e07db1a27861f9a4' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'f2adf04713918cfd7c76c9d22bca1bab')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition) <> 'b71dfb77c3f11bb6b12d3432c778ec14' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure) <> 'ac8ddc791a6ade70ddc08e9cc021cd18' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';
 end if;
 previous := $old$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') or r->>'report_type' is distinct from 'prospect'
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') or r->>'report_type' is distinct from 'prospect'
$new$);
 previous := $old$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when r->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when r->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.15') is distinct from (r->>'schema_version'='2.2.15')
$new$);
 previous := $old$  perform public.validate_v22_local_entity_coverage(r);
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_local_entity_coverage(r);
  perform public.validate_v22_action_advice(r);
$new$);
 if md5(definition) <> 'f48e7da63cd581065a2c87fb817219e3' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'da9350d5fa8819cafaca21936aaaca75')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition) <> 'a250d9decfbadf0667854413ffab55a3' or (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) <> '3c8eb295206779d7016e1731c313c9fe' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';
 end if;
 previous := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 previous := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
$new$);
 if md5(definition) <> '1883f9c53bac6b0e37900e4796556453' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '5a91a7178eb64e426432b3e02b27ac9c')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition) <> '20702f4b4f8691635a27cf3b63130b8a' or (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) <> '0ce899788f1a050b789c5f8fefe04093' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_STORE_V22_CAPABILITY_REPORT';
 end if;
 previous := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
 previous := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') and (
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') and (
$new$);
 previous := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then
$new$);
 previous := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') then 5 else 4 end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then 5 else 4 end)
$new$);
 previous := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') and c->>'field'='opening_hours'))
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and c->>'field'='opening_hours'))
$new$);
 previous := $old$  perform public.validate_v22_local_entity_coverage(p_payload);
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_local_entity_coverage(p_payload);
  perform public.validate_v22_action_advice(p_payload);
$new$);
 if md5(definition) <> '73477a140d0406edccafec15b18e4bff' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_STORE_V22_CAPABILITY_REPORT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'd572f0259d97e4387b3571445989bd5e')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_STORE_V22_CAPABILITY_REPORT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition) <> '193f6ed3393588cf8f24e4d0cb2d01ba' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure) <> '86d3af83fdb9ae75710029d6ed9b2c76' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 previous := $old$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$new$);
 if md5(definition) <> 'db5c2f952cd122383e926826f50a9711' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_CANDIDATE_POOL'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'c3c09663d8b75ad17f8c35fe972b1215')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition) <> 'a56409eb0d56927911ea52d9dcacc5ab' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure) <> '2cc38134e2eac87e0a8cb7a4ab1aed12' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';
 end if;
 previous := $old$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 if md5(definition) <> 'd7ee8d78b2c4c4b88518bab3c128921f' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '1c357bf64c945e897b0f85ad5c4a4761')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(definition) <> 'd79c0865791160217f5eb12c414e2a4a' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure) <> '26317a2fb8571ecbf5689018e881f49f' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$new$);
 if md5(definition) <> '9d9711583b39ddeebf6198cb81ad742a' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_GBP_COMPARISON'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'e183e708caa775a59fe745a5ee9266ec')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition) <> '49bf2f673b33adbb6b8846aa992b0b73' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure) <> '63449c99e91833b4fefc2cc3507fd912' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$new$);
 if md5(definition) <> '409689159eecb869681c52f7f419fb69' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '9002c0028e876da46324e5d3718d175c')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure;
 if md5(definition) <> '9f40f85e1b1a017fe130296e0fa1a9de' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure) <> 'ed017fb5e894566114e6b8dd5d056893' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_LANDING_COMPARISON';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12','2.2.13','2.2.15') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
$new$);
 if md5(definition) <> '7984aed02eead420d22a8dfa0434fa0c' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_LANDING_COMPARISON'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '867130da045a7b67bf2a6a2d1a68835c')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_LANDING_COMPARISON';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure;
 if md5(definition) <> 'b6296db1b4aac8425b00cc3b7fde71a4' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure) <> 'f7c2311e8d2909fa41e0c5308a88db7d' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_LOCAL_ENTITY_COVERAGE';
 end if;
 previous := $old$ if p->>'schema_version' is distinct from '2.2.13' then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.13','2.2.15') then
$new$);
 previous := $old$ if m->>'schema_version' is distinct from 'v22_analysis_input_v8'
    or m->>'ruleset_version' is distinct from 'v22_capability_public_v18' then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' else 'v22_analysis_input_v8' end)
    or m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' else 'v22_capability_public_v18' end) then
$new$);
 if md5(definition) <> '819599f3a7e0815605865060a51f2956' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_LOCAL_ENTITY_COVERAGE'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '5da5ca2a6ea78c3dbdee4c6d0973e2c8')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_LOCAL_ENTITY_COVERAGE';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure;
 if md5(definition) <> '16955995827a4f1090a5ab454811d64f' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure) <> 'a998df6f12d953e859db25061298a68b' then
  raise exception 'V20_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.12','2.2.13') then
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.12','2.2.13','2.2.15') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' else 'v22_capability_public_v17' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' else 'v22_analysis_input_v7' end) then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V20_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' else 'v22_capability_public_v17' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' else 'v22_analysis_input_v7' end) then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
$new$);
 if md5(definition) <> '25b02d2e6fca3f545e6cda062a9d172b' then raise exception 'V20_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'faa69f555c2ba7a3b35f755dd766d5b3')) then
  raise exception 'V20_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS';
 end if;
end $migration$;

commit;
