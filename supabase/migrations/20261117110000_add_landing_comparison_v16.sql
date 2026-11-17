-- P1-03: v16 / report 2.2.11 / manifest v6. Saved input only; no collector changes.
-- Rollback originals: docs/acquisition-plan/rollback/20261117110000/.
begin;
do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from 'bc53bc1da64d71a570f997346e186bc3' then raise exception 'P1_03_CONSTRAINT_BASELINE_MISMATCH';end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;
do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from 'f016d532d3dd1ce9d4048707d2fabeb4' then raise exception 'P1_03_CONSTRAINT_BASELINE_MISMATCH';end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text])));
end $constraint$;
create function public.validate_v22_landing_comparison(p jsonb)
returns void language plpgsql stable security definer set search_path=public as $function$
declare m jsonb=p->'input_manifest'; module jsonb=p->'landing_page_comparison'; row jsonb; metric jsonb; e jsonb; source jsonb; inv jsonb; deep jsonb;
 c jsonb; other jsonb; expected jsonb; indices jsonb; counts jsonb; fields text[]=array['local_entities','case_study','portfolio','credentials','service_price','discount','project_budget'];
 types text[]=array['home','service_index','service_detail','service_area','location','about','contact','team','review_testimonial','case_study_portfolio','faq','blog_index','blog_post','product_category','product_detail','legal','other'];
 eligible boolean; sid uuid; i integer=0; n integer; idx integer; field text; path text; quote text; original text; reason text; min_at timestamptz; max_at timestamptz;
begin
 if p->>'schema_version' is distinct from '2.2.11' then
  if p ? 'landing_page_comparison' then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  return;
 end if;
 if m->>'ruleset_version' is distinct from 'v22_capability_public_v16' or m->>'schema_version' is distinct from 'v22_analysis_input_v6'
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
revoke all on function public.validate_v22_landing_comparison(jsonb) from public,anon,authenticated;
grant execute on function public.validate_v22_landing_comparison(jsonb) to service_role;

do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition)<>'8e2c1097d74eb68c7c86563b5fe440db' or (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure)<>'e9315a4a4c06cc00569681a6cf2dd283' then raise exception 'P1_03_BASELINE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';end if;
 previous := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15'),false)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16'),false)
$new$);
 if md5(definition)<>'b839256d729fb9363a4a95a371730360' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition)<>'8abf69017464bddb15e9481033e5b23c' or (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure)<>'e09f79abeab43b55c671bd20a65ef3b5' then raise exception 'P1_03_BASELINE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';end if;
 previous := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$new$);
 if md5(definition)<>'9acfb11c9a28d8618d54fc42ba7ebf5d' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition)<>'8adee228259bd82739602048eee08c41' or (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure)<>'1c6ef8fa542be4552b5ea7f1c433056c' then raise exception 'P1_03_BASELINE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';end if;
 previous := $old$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')
$new$);
previous := $old$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') then
$new$);
previous := $old$  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
$new$);
previous := $old$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') then
$new$);
previous := $old$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16'))
$new$);
previous := $old$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$new$);
previous := $old$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')
$new$);
 if md5(definition)<>'4cbd2de054c4dd6d405cf8378243b60c' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition)<>'facffdc84ca01bc62721df1f03aca6fe' or (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure)<>'cbf6acf07c93decf3154ab1489830d13' then raise exception 'P1_03_BASELINE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';end if;
 previous := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$new$);
 if md5(definition)<>'b908616f3dceed95196e55c70d35d44c' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'267902612ec5bc49781c2975abe1ec0c' or (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure)<>'013449c82fc024e7a4bcf344c2aa2089' then raise exception 'P1_03_BASELINE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';end if;
 previous := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition)<>'1596fedf9bb859daf4208ad59c3a7bf4' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition)<>'650e7701e5a063eae4a30fe530bc4595' or (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure)<>'efc23ee83506cc08966587829f23c5dc' then raise exception 'P1_03_BASELINE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';end if;
 previous := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')
$new$);
 if md5(definition)<>'af12506f75d41d057cbd4feb6ad61ad5' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'4e4809115e074fbbcebb041b89e380ef' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure)<>'0badb058cef6d9bd482a6b6b44d050ff' then raise exception 'P1_03_BASELINE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';end if;
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') and exists(
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and exists(
$new$);
previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 if md5(definition)<>'85649f0975965b7821cdc52f80634961' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition)<>'1291df5849a6747f5b0ace2e9b590a76' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure)<>'625ed8e79fde7106e5bc91ee0a5dd05e' then raise exception 'P1_03_BASELINE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';end if;
 previous := $old$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10') or r->>'report_type' is distinct from 'prospect'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11') or r->>'report_type' is distinct from 'prospect'
$new$);
previous := $old$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.11') is distinct from (r->>'schema_version'='2.2.11')
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(r);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_landing_comparison(r);
  perform public.validate_v22_candidate_pool(r);
$new$);
 if md5(definition)<>'8cbcc5c30529ebaa8d645a83ec94e3d1' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition)<>'a8538242a211ccbac77ee2b30ca23efa' or (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure)<>'6c99901b076533f2a59759052935ea98' then raise exception 'P1_03_BASELINE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';end if;
 previous := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
previous := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')
$new$);
 if md5(definition)<>'f6e69e3f629689d9d09cdedd9cc74043' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'7f769b1b7ba4e1b00d00259be4b25d74' or (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure)<>'6a4a7cb70c67133f55846727a14e5e1f' then raise exception 'P1_03_BASELINE_MISMATCH_STORE_V22_CAPABILITY_REPORT';end if;
 previous := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
previous := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10') and (
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') and (
$new$);
previous := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') then
$new$);
previous := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') then 5 else 4 end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') then 5 else 4 end)
$new$);
previous := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') and c->>'field'='opening_hours'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') and c->>'field'='opening_hours'))
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(p_payload);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_landing_comparison(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);
$new$);
 if md5(definition)<>'4cffe1e43e174631f321c76e43794c8d' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition)<>'cce080ca352f02acfe94454aab5699c8' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure)<>'a740d501a0cf2ba3749398aefbb9ab8c' then raise exception 'P1_03_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$new$);
previous := $old$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$new$);
 if md5(definition)<>'598fa78a1ef0a26cfccada936d1757f1' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'13dbb871a701c4ccd51297689ed493f3' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure)<>'2886250f5949c73e09fdc5314f496a3a' then raise exception 'P1_03_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';end if;
 previous := $old$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 if md5(definition)<>'5d3af06a2ede0bd4d2c914665d6a4981' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(definition)<>'67dffa109806ddccec7e6ec817213f0d' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure)<>'b5c00a9efc9e895da9dc4401a23ec7e6' then raise exception 'P1_03_BASELINE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';end if;
 previous := $old$ if p->>'schema_version' is distinct from '2.2.10' then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from 'v22_capability_public_v15' or m->>'schema_version' is distinct from 'v22_analysis_input_v5'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$new$);
 if md5(definition)<>'af1cffb5894094d0a37c0037ba7794bf' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition)<>'fc1dc1727006ec6a441c38f8e0e6e731' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure)<>'f11c2832d0baa9deb213f7c3c2282be4' then raise exception 'P1_03_BASELINE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_03_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$new$);
 if md5(definition)<>'6a81ca3e501ddd953ab855848fa7e0f7' then raise exception 'P1_03_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_03_ACL_CHANGED';end if;
end $migration$;
commit;
