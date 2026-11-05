-- P1-05 phase 1. New identity contracts only; frozen evidence is never updated.
begin;
alter table public.capability_report_versions
 drop constraint capability_report_versions_schema_version_check,
 drop constraint capability_report_input_variant,
 add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8')),
 add constraint capability_report_input_variant check(
   (schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8') and manifest_id is not null and review_input_job_id is null)
   or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

-- Full identity remains in client_cases. The legacy service projection preserves
-- the three-value mode and the historical meaning of primary_location (market).
create or replace function public.v22_service_identity(identity jsonb, market jsonb) returns jsonb
language plpgsql immutable set search_path=public as $fn$
begin
 if identity->>'schema_version' is distinct from 'business_identity_v2' then return identity; end if;
 if coalesce(identity#>>'{operating_model,value}','') not in ('storefront','service_area','hybrid')
   then raise exception 'FIRST_SERVICE_OPERATING_MODEL_UNSUPPORTED'; end if;
 return jsonb_build_object('business_name',identity->'business_name','site_url',identity->'site_url',
   'normalized_domain',identity->'normalized_domain','public_gbp_url',identity->'public_gbp_url',
   'operating_model',identity#>'{operating_model,value}','primary_location',market);
end; $fn$;
revoke all on function public.v22_service_identity(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.v22_service_identity(jsonb,jsonb) to service_role;

alter table public.client_cases drop constraint client_cases_complete_identity_consistency_check;
drop index public.uq_client_cases_user_domain_location;
alter table public.client_cases drop column location_key;
alter table public.client_cases add column location_key text generated always as (
 public.v22_case_location_key(case when business_identity->>'schema_version'='business_identity_v2'
 then target_market else business_identity->'primary_location' end)) stored;
create unique index uq_client_cases_user_domain_location on public.client_cases(user_id,normalized_domain,location_key) where location_key is not null;
alter table public.client_cases alter column operating_model drop not null;
alter table public.client_cases drop constraint client_cases_operating_model_check;
alter table public.client_cases add constraint client_cases_operating_model_check check ((
 case when business_identity->>'schema_version'='business_identity_v2' then
   (operating_model is null or operating_model in ('storefront','service_area','hybrid','meeting_point'))
   and (business_identity#>>'{operating_model,value}') is not distinct from operating_model
   and business_identity#>>'{operating_model,state}' in ('resolved','needs_confirmation','unresolved')
   and (business_identity#>>'{operating_model,state}'='resolved')=(operating_model is not null)
   and jsonb_typeof(business_identity->'operating_location')='object'
   and jsonb_typeof(target_market)='object'
   and business_identity->>'business_name'=business_name and business_identity->>'site_url'=site_url
   and business_identity->>'normalized_domain'=normalized_domain
 else operating_model is not null and operating_model in ('storefront','service_area','hybrid') end) is true);
alter table public.client_cases add constraint client_cases_complete_identity_consistency_check check (
 business_identity->>'schema_version' is not distinct from 'business_identity_v2' or location_key is null or (
 business_identity->>'business_name'=business_name and business_identity->>'site_url'=site_url
 and business_identity->>'normalized_domain'=normalized_domain and business_identity->>'operating_model'=operating_model
 and jsonb_typeof(business_identity->'primary_location')='object')) not valid;

do $migration$
declare definition text; previous text;
begin
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='freeze_v22_analysis_manifest';
  previous := $old$('v22_analysis_input_v1','v22_analysis_input_v2')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3')$new$);
  previous := $old$'v22_capability_public_v12')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$'v22_capability_public_v12','v22_capability_public_v13')$new$);
  previous := $old$  kind=p_manifest->>'mode';$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version'='v22_analysis_input_v3') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v13') then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version'='v22_analysis_input_v3' then
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
  kind=p_manifest->>'mode';$new$);
  previous := $old$if p_manifest->>'schema_version'='v22_analysis_input_v2' then required=required||array['rendered']; end if;$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version'='v22_analysis_input_v3' and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='store_v22_capability_report';
  previous := $old$case when manifest.payload->>'ruleset_version'='v22_capability_public_v12' then '2.2.7'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$case when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
    when manifest.payload->>'ruleset_version'='v22_capability_public_v12' then '2.2.7'$new$);
  previous := $old$'v22_capability_public_v12')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$'v22_capability_public_v12','v22_capability_public_v13')$new$);
  previous := $old$'2.2.7')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$'2.2.7','2.2.8')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='validate_v22_candidate_pool';
  previous := $old$p->>'schema_version' is distinct from '2.2.7'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: validate_v22_candidate_pool'; end if;
  definition := replace(definition,previous,$new$coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8')$new$);
  previous := $old$p#>>'{input_manifest,ruleset_version}' is distinct from 'v22_capability_public_v12'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: validate_v22_candidate_pool'; end if;
  definition := replace(definition,previous,$new$p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='validate_v22_candidate_selection';
  previous := $old$p->>'schema_version' is distinct from '2.2.7'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: validate_v22_candidate_selection'; end if;
  definition := replace(definition,previous,$new$coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='save_v22_report_content_revision';
  previous := $old$report.payload->>'schema_version'='2.2.7'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: save_v22_report_content_revision'; end if;
  definition := replace(definition,previous,$new$report.payload->>'schema_version' in ('2.2.7','2.2.8')$new$);
  previous := $old$'2.2.7')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: save_v22_report_content_revision'; end if;
  definition := replace(definition,previous,$new$'2.2.7','2.2.8')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='list_v22_completed_capability_reports';
  previous := $old$'2.2.7')$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: list_v22_completed_capability_reports'; end if;
  execute replace(definition,previous,$new$'2.2.7','2.2.8')$new$);
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='enforce_v22_delivery_prerequisites';
  previous := $old$report.payload->>'schema_version'='2.2.7'$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: enforce_v22_delivery_prerequisites'; end if;
  execute replace(definition,previous,$new$report.payload->>'schema_version' in ('2.2.7','2.2.8')$new$);
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='check_v22_first_service_discovery_binding';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: check_v22_first_service_discovery_binding'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='claim_v22_first_service_discovery_run_base';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: claim_v22_first_service_discovery_run_base'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='continue_v22_first_service_discovery';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: continue_v22_first_service_discovery'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='get_v22_first_service_workspace';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: get_v22_first_service_workspace'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='reserve_v22_first_service_discovery_base';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: reserve_v22_first_service_discovery_base'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='start_v22_first_service_preparation';
  previous := $old$cc.business_identity$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: start_v22_first_service_preparation'; end if;
  definition := replace(definition,previous,$new$public.v22_service_identity(cc.business_identity,cc.target_market)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='begin_v22_first_service_collection';
  previous := $old$(select business_identity from public.client_cases$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: begin_v22_first_service_collection'; end if;
  definition := replace(definition,previous,$new$(select public.v22_service_identity(business_identity,target_market) from public.client_cases$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='check_v22_first_service_preparation_binding';
  previous := $old$(select business_identity from public.client_cases$old$;
  if position(previous in definition)=0 then raise exception 'P105_TARGET_MISSING: check_v22_first_service_preparation_binding'; end if;
  definition := replace(definition,previous,$new$(select public.v22_service_identity(business_identity,target_market) from public.client_cases$new$);
  execute definition;
  select pg_get_functiondef('public.resolve_v22_capability_analysis_input(uuid,uuid,uuid,text,integer)'::regprocedure) into definition;
  previous := '(select business_identity from public.client_cases';
  if position(previous in definition)=0 then raise exception 'P105_RESOLVE_TARGET_MISSING'; end if;
  execute replace(definition,previous,'(select public.v22_service_identity(business_identity,target_market) from public.client_cases');
end;
$migration$;
commit;
