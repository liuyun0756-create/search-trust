-- P1-04: v17 / report 2.2.12 / manifest v7. Saved input only; no collector changes.
-- Rollback originals: docs/acquisition-plan/rollback/20261117120000/.
begin;
do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from 'a3f7d0761126c2e4745471f6f9515aeb' then raise exception 'P1_04_CONSTRAINT_BASELINE_MISMATCH';end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;
do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from '46b4dcd9901f7bff4d0a10f9059b7255' then raise exception 'P1_04_CONSTRAINT_BASELINE_MISMATCH';end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text])));
end $constraint$;
create function public.validate_v22_possible_reasons(p jsonb)
returns void language plpgsql stable security definer set search_path=public as $function$
declare m jsonb=p->'input_manifest'; g jsonb=p->'gbp_comparison'; d jsonb; item jsonb; items jsonb='[]'; refs jsonb; indices jsonb;
 metric text; label text; own text; nums text; own_value text; i integer; idx integer; wanted jsonb;
begin
 if p->>'schema_version' is distinct from '2.2.12' then
  if p ? 'possible_reasons' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;return;
 end if;
 if m->>'ruleset_version' is distinct from 'v22_capability_public_v17' or m->>'schema_version' is distinct from 'v22_analysis_input_v7' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
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
revoke all on function public.validate_v22_possible_reasons(jsonb) from public, anon, authenticated;
grant execute on function public.validate_v22_possible_reasons(jsonb) to service_role;

do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition)<>'b839256d729fb9363a4a95a371730360' or (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure)<>'ed8b8cfda34dbb4a048e657b6cc2a6e0' then raise exception 'P1_04_BASELINE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING';end if;
 previous := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16'),false)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17'),false)
$new$);
 if md5(definition)<>'16b0195903b4cf7a4bf6a36529a461b1' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition)<>'9acfb11c9a28d8618d54fc42ba7ebf5d' or (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure)<>'81e5a94aede8bab15a26f6d7f8f12fb6' then raise exception 'P1_04_BASELINE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES';end if;
 previous := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$new$);
 if md5(definition)<>'dd620cf7839668e9aae39fdf9d6ef934' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition)<>'4cbd2de054c4dd6d405cf8378243b60c' or (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure)<>'2c0525bb1bda9407cf840975982e8bbe' then raise exception 'P1_04_BASELINE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST';end if;
 previous := $old$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')
$new$);
previous := $old$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') then
$new$);
previous := $old$  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version'='v22_analysis_input_v7') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
$new$);
previous := $old$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') then
$new$);
previous := $old$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17'))
$new$);
previous := $old$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$new$);
previous := $old$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17')
$new$);
 if md5(definition)<>'1249a1b6d253ef87d1f90cd4d42317a4' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition)<>'b908616f3dceed95196e55c70d35d44c' or (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure)<>'6270c06847ad347c30a569fc427e527a' then raise exception 'P1_04_BASELINE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE';end if;
 previous := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$new$);
 if md5(definition)<>'e30c224207c51630217d2d8e4f8f5eb4' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'1596fedf9bb859daf4208ad59c3a7bf4' or (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure)<>'96d2ee773d50026b4e323b61c8f27a30' then raise exception 'P1_04_BASELINE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT';end if;
 previous := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition)<>'56f011dd10dc4b3657f0ed4df87ce163' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition)<>'af12506f75d41d057cbd4feb6ad61ad5' or (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure)<>'9a070b2827f989b662157b21adcb66f7' then raise exception 'P1_04_BASELINE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS';end if;
 previous := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')
$new$);
 if md5(definition)<>'e6ae76122e2171f9fbfbf3dcbe6b7a69' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'85649f0975965b7821cdc52f80634961' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure)<>'330678273b0b5e0ec490e68a80f24aa3' then raise exception 'P1_04_BASELINE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE';end if;
 previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and exists(
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and exists(
$new$);
previous := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 if md5(definition)<>'fe6963ba8d8fc41569746598eff877d2' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition)<>'8cbcc5c30529ebaa8d645a83ec94e3d1' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure)<>'046b8128f57a7fa717bad8a56ff7286b' then raise exception 'P1_04_BASELINE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT';end if;
 previous := $old$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11') or r->>'report_type' is distinct from 'prospect'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') or r->>'report_type' is distinct from 'prospect'
$new$);
previous := $old$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.12') is distinct from (r->>'schema_version'='2.2.12')
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(r);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_possible_reasons(r);
  perform public.validate_v22_candidate_pool(r);
$new$);
 if md5(definition)<>'9f8d3fa2a8af9085e7aed6273e091334' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition)<>'f6e69e3f629689d9d09cdedd9cc74043' or (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure)<>'f71d0f34475d2ee1425ccc20245c0ee2' then raise exception 'P1_04_BASELINE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION';end if;
 previous := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
previous := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12')
$new$);
 if md5(definition)<>'fd5797dbcc2d330ed8ef665d4da85a3b' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'4cffe1e43e174631f321c76e43794c8d' or (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure)<>'9e736210899a25544804b24e84b889ec' then raise exception 'P1_04_BASELINE_MISMATCH_STORE_V22_CAPABILITY_REPORT';end if;
 previous := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
previous := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') and (
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') and (
$new$);
previous := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then
$new$);
previous := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') then 5 else 4 end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') then 5 else 4 end)
$new$);
previous := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16') and c->>'field'='opening_hours'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17') and c->>'field'='opening_hours'))
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(p_payload);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_possible_reasons(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);
$new$);
 if md5(definition)<>'ace90ab9eb8bb62f5dd101018efb9466' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition)<>'598fa78a1ef0a26cfccada936d1757f1' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure)<>'314dd4d07d6555df001f366a0fb007f1' then raise exception 'P1_04_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL';end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then
$new$);
previous := $old$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$new$);
 if md5(definition)<>'4ee50b0d19a7fa7eb2823b30fd9ff3af' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'5d3af06a2ede0bd4d2c914665d6a4981' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure)<>'b96eafeb9fc489331a3451fb316ccf67' then raise exception 'P1_04_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION';end if;
 previous := $old$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 if md5(definition)<>'60f4a48d046d81f03ea29a96709e53a9' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(definition)<>'af1cffb5894094d0a37c0037ba7794bf' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure)<>'b0071fb4459b3fe77eeab2bbb6d87b40' then raise exception 'P1_04_BASELINE_MISMATCH_VALIDATE_V22_GBP_COMPARISON';end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.10','2.2.11','2.2.12') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' else 'v22_capability_public_v15' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' else 'v22_analysis_input_v5' end)
$new$);
 if md5(definition)<>'003e675d8d1d233150377a0a9cb3d3c8' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition)<>'6a81ca3e501ddd953ab855848fa7e0f7' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure)<>'d2b6c9600b1262510bcc841b0862ffc2' then raise exception 'P1_04_BASELINE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY';end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$new$);
 if md5(definition)<>'6d7e39a4884dafccaf68bba09d878d35' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
do $migration$
declare definition text;previous text;original_acl text;
begin
 select pg_get_functiondef(oid),proacl::text into strict definition,original_acl from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure;
 if md5(definition)<>'db921c07d47252dfc2ae40397a35d398' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure)<>'b710618bc1034a238758cb06249ec570' then raise exception 'P1_04_BASELINE_MISMATCH_VALIDATE_V22_LANDING_COMPARISON';end if;
 previous := $old$ if p->>'schema_version' is distinct from '2.2.11' then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from 'v22_capability_public_v16' or m->>'schema_version' is distinct from 'v22_analysis_input_v6'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_04_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
$new$);
 if md5(definition)<>'651cd9e51806813e1e0cc818502bf517' then raise exception 'P1_04_PATCH_RESULT_MISMATCH';end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_04_ACL_CHANGED';end if;
end $migration$;
commit;
