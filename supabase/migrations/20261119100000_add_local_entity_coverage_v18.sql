-- P1-08/P1-11. Rollback definitions in docs/acquisition-plan/rollback/20261119100000/.

begin;

create function public.validate_v22_local_entity_coverage(p jsonb)
returns void language plpgsql stable security definer set search_path=public as $function$
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
 if p->>'schema_version' is distinct from '2.2.13' then
  if p ? 'local_entity_coverage' then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  return;
 end if;
 if m->>'schema_version' is distinct from 'v22_analysis_input_v8'
    or m->>'ruleset_version' is distinct from 'v22_capability_public_v18' then
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
revoke all on function public.validate_v22_local_entity_coverage(jsonb) from public, anon, authenticated;
grant execute on function public.validate_v22_local_entity_coverage(jsonb) to service_role;


do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from '04810fb2d5dce79b4bfc05e74aa4ef57' then raise exception 'V18_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from 'f314b080cb0fe267bea184793e1cc44e' then raise exception 'V18_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text])));
end $constraint$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition) <> '16b0195903b4cf7a4bf6a36529a461b1' or (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure) <> '94f6db2d90bcc184fe2586402562d0e4' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';
 end if;
 previous := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17'),false)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18'),false)
$new$);
 if md5(definition) <> '66839ee6958656fee884649824f97f93' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '69e04a08e050f379d093b978cce1ea59')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition) <> 'dd620cf7839668e9aae39fdf9d6ef934' or (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure) <> '8217d86a33aec3818f6d69196f749f57' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';
 end if;
 previous := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$new$);
 if md5(definition) <> '048defbf583ff11205fd2929b9cff579' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'a8ac53b46740b5aea057eccf84b57574')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition) <> '1249a1b6d253ef87d1f90cd4d42317a4' or (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) <> 'aea839f7a64f87ec6a1937b3b63d3f9b' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';
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
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') then
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
  if (p_manifest->>'schema_version'='v22_analysis_input_v7') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17'))
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
  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')
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
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
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
$new$);
 if md5(definition) <> '95249e4df132810f4a41394c80ca127b' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '6a6a4f69a71ba2eac10424f3b69c6397')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition) <> 'e30c224207c51630217d2d8e4f8f5eb4' or (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) <> 'c09bd3471e4bcbefefea534c08c55194' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';
 end if;
 previous := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$new$);
 if md5(definition) <> '4999e57ce90bfa2f16f18110792a1011' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '172f228fee8b2ab9755662b185c0b882')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition) <> '56f011dd10dc4b3657f0ed4df87ce163' or (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) <> '1bf2c8d2a0dd32250464910012a928a3' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';
 end if;
 previous := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition) <> 'be855b1c7b054de2ebd67d498ab154c7' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '2817cb748ab207890ff068739bb1db6e')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition) <> 'e6ae76122e2171f9fbfbf3dcbe6b7a69' or (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure) <> 'fc4003bf3c87d576de97007b06a9f035' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';
 end if;
 previous := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')
$new$);
 if md5(definition) <> '70e37eba9f81816a3c4c4645e9715662' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '470f2a10a8cc32ae0a0cc5b9e6b8f2be')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition) <> 'fe6963ba8d8fc41569746598eff877d2' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure) <> '80b235b0d296088e35240262f22c32e6' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';
 end if;
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and exists(
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and exists(
$new$);
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 if md5(definition) <> 'b53b65aa05a9d18e78de571f88873c7f' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'e881b99c1b2faf962c9ac335a2a5ceb8')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition) <> '9f8d3fa2a8af9085e7aed6273e091334' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure) <> '73cad0ad378c3e569e1dee98815216c0' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';
 end if;
 previous := $old$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') or r->>'report_type' is distinct from 'prospect'
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') or r->>'report_type' is distinct from 'prospect'
$new$);
 previous := $old$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.13') is distinct from (r->>'schema_version'='2.2.13')
$new$);
 previous := $old$  perform public.validate_v22_possible_reasons(r);
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_possible_reasons(r);
  perform public.validate_v22_local_entity_coverage(r);
$new$);
 if md5(definition) <> 'b71dfb77c3f11bb6b12d3432c778ec14' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'ac8ddc791a6ade70ddc08e9cc021cd18')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition) <> 'fd5797dbcc2d330ed8ef665d4da85a3b' or (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) <> 'a28afebbf5673d340dd4739ff0d950ff' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';
 end if;
 previous := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 previous := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13')
$new$);
 if md5(definition) <> 'a250d9decfbadf0667854413ffab55a3' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '3c8eb295206779d7016e1731c313c9fe')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition) <> 'ace90ab9eb8bb62f5dd101018efb9466' or (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) <> '183043584ad30ff742cf69b1b7105de6' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_STORE_V22_CAPABILITY_REPORT';
 end if;
 previous := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
 previous := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') and (
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') and (
$new$);
 previous := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') then
$new$);
 previous := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then 5 else 4 end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') then 5 else 4 end)
$new$);
 previous := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') and c->>'field'='opening_hours'))
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18') and c->>'field'='opening_hours'))
$new$);
 previous := $old$  perform public.validate_v22_possible_reasons(p_payload);
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_possible_reasons(p_payload);
  perform public.validate_v22_local_entity_coverage(p_payload);
$new$);
 if md5(definition) <> '20702f4b4f8691635a27cf3b63130b8a' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_STORE_V22_CAPABILITY_REPORT'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '0ce899788f1a050b789c5f8fefe04093')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_STORE_V22_CAPABILITY_REPORT';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition) <> '4ee50b0d19a7fa7eb2823b30fd9ff3af' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure) <> 'e05427f1ce2e192b00a629886d6d1683' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$new$);
 previous := $old$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$new$);
 if md5(definition) <> '193f6ed3393588cf8f24e4d0cb2d01ba' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_CANDIDATE_POOL'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '86d3af83fdb9ae75710029d6ed9b2c76')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition) <> '60f4a48d046d81f03ea29a96709e53a9' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure) <> 'c68eaa40c723123356d8fbd59f9101ad' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';
 end if;
 previous := $old$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 if md5(definition) <> 'a56409eb0d56927911ea52d9dcacc5ab' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '2cc38134e2eac87e0a8cb7a4ab1aed12')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(definition) <> '003e675d8d1d233150377a0a9cb3d3c8' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure) <> 'b5cbb6c7ac7fcc0387982c1c71f3ba6f' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12','2.2.13') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$new$);
 if md5(definition) <> 'd79c0865791160217f5eb12c414e2a4a' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_GBP_COMPARISON'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '26317a2fb8571ecbf5689018e881f49f')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition) <> '6d7e39a4884dafccaf68bba09d878d35' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure) <> '2507c855859e6551074db3758ac884a0' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$new$);
 if md5(definition) <> '49bf2f673b33adbb6b8846aa992b0b73' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> '63449c99e91833b4fefc2cc3507fd912')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure;
 if md5(definition) <> '651cd9e51806813e1e0cc818502bf517' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure) <> 'f4ef9bfc8fed3af18278a9809dd7e824' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_LANDING_COMPARISON';
 end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12') then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12','2.2.13') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
$new$);
 if md5(definition) <> '9f40f85e1b1a017fe130296e0fa1a9de' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_LANDING_COMPARISON'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'ed017fb5e894566114e6b8dd5d056893')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_LANDING_COMPARISON';
 end if;
end $migration$;

do $migration$
declare definition text; previous text; original_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,original_acl from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure;
 if md5(definition) <> '18b76ff1d04379ec38bd3dc1e41309ae' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure) <> '3b0d2f9a45d1fa3308d7cf98d71028b2' then
  raise exception 'V18_FUNCTION_BASELINE_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS';
 end if;
 previous := $old$ if p->>'schema_version' is distinct from '2.2.12' then
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.12','2.2.13') then
$new$);
 previous := $old$ if m->>'ruleset_version' is distinct from 'v22_capability_public_v17' or m->>'schema_version' is distinct from 'v22_analysis_input_v7' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
$old$;
 if position(previous in definition)=0 then raise exception 'V18_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' else 'v22_capability_public_v17' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' else 'v22_analysis_input_v7' end) then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
$new$);
 if md5(definition) <> '16955995827a4f1090a5ab454811d64f' then raise exception 'V18_FUNCTION_TARGET_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS'; end if;
 execute definition;
 if exists (select 1 from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure and (proacl is distinct from original_acl or md5(prosrc) <> 'a998df6f12d953e859db25061298a68b')) then
  raise exception 'V18_FUNCTION_ACL_OR_SOURCE_MISMATCH_VALIDATE_V22_POSSIBLE_REASONS';
 end if;
end $migration$;

commit;
