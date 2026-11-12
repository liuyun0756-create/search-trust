-- P1-01 phase 1: first-page keyword observations; no collection or old-row rewrites.
begin;
alter table public.capability_report_versions
 drop constraint capability_report_versions_schema_version_check,
 drop constraint capability_report_input_variant,
 add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9')),
 add constraint capability_report_input_variant check(
   (schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9') and manifest_id is not null and review_input_job_id is null)
   or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

create function public.validate_v22_keyword_visibility(p jsonb) returns void
language plpgsql stable security definer set search_path=public as $function$
declare v jsonb=p->'keyword_visibility'; m jsonb=p->'input_manifest'; source public.data_snapshots;
 ref jsonb; row jsonb; item jsonb; record jsonb; run jsonb; a jsonb; channel text; field text; rid text; ep text;
 idx integer=0; k integer; h integer; grade text; ids integer; domain text;
begin
 if p->>'schema_version' is distinct from '2.2.9' then
  if p ? 'keyword_visibility' then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from 'v22_capability_public_v14' or m->>'schema_version' is distinct from 'v22_analysis_input_v4'
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
revoke all on function public.validate_v22_keyword_visibility(jsonb) from public,anon,authenticated;
grant execute on function public.validate_v22_keyword_visibility(jsonb) to service_role;

do $migration$
declare definition text; previous text;
begin
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='commit_v22_public_reassessment';
  previous := $old$p_case_id,'2.2.8',q.preview->>'report_checksum',r)$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: commit_v22_public_reassessment'; end if;
  definition := replace(definition,previous,$new$p_case_id,r->>'schema_version',q.preview->>'report_checksum',r)$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='enforce_v22_delivery_prerequisites';
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: enforce_v22_delivery_prerequisites'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='freeze_v22_analysis_manifest';
  previous := $old$'v22_analysis_input_v2','v22_analysis_input_v3')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$'v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4')$new$);
  previous := $old$(p_manifest->>'schema_version'='v22_analysis_input_v3') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v13')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$(p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14'))$new$);
  previous := $old$p_manifest->>'schema_version'='v22_analysis_input_v3'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4')$new$);
  previous := $old$  kind=p_manifest->>'mode';$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version'='v22_analysis_input_v4') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v14') then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version'='v22_analysis_input_v4' then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';$new$);
  previous := $old$'v22_capability_public_v13')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: freeze_v22_analysis_manifest'; end if;
  definition := replace(definition,previous,$new$'v22_capability_public_v13','v22_capability_public_v14')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='get_v22_completed_plan_source';
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: get_v22_completed_plan_source'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='hydrate_v22_capability_generation_input';
  previous := $old$p_manifest->>'schema_version'='v22_analysis_input_v3'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: hydrate_v22_capability_generation_input'; end if;
  definition := replace(definition,previous,$new$p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='list_v22_completed_capability_reports';
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: list_v22_completed_capability_reports'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='prepare_v22_capability_analysis_input_core';
  previous := $old$  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: prepare_v22_capability_analysis_input_core'; end if;
  definition := replace(definition,previous,$new$  pub=case when p_manifest->>'mode'='acquisition' then full_input else full_input->'public_input' end;
  if p_manifest->>'schema_version'='v22_analysis_input_v4' and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
    or pub#>>'{business_identity,schema_version}' is distinct from 'business_identity_v2') then raise exception 'CAPABILITY_KEYWORDS_BINDING_INVALID'; end if;$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='prepare_v22_public_reassessment';
  previous := $old$r->>'schema_version' is distinct from '2.2.8'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: prepare_v22_public_reassessment'; end if;
  definition := replace(definition,previous,$new$coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9')$new$);
  previous := $old$m->>'schema_version' is distinct from 'v22_analysis_input_v3' or m->>'ruleset_version' is distinct from 'v22_capability_public_v13'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: prepare_v22_public_reassessment'; end if;
  definition := replace(definition,previous,$new$m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.9') is distinct from (r->>'schema_version'='2.2.9')$new$);
  previous := $old$  perform public.validate_v22_candidate_pool(r);$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: prepare_v22_public_reassessment'; end if;
  definition := replace(definition,previous,$new$  perform public.validate_v22_keyword_visibility(r);
  perform public.validate_v22_candidate_pool(r);$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='save_v22_report_content_revision';
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: save_v22_report_content_revision'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='store_v22_capability_report';
  previous := $old$case when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$case when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'$new$);
  previous := $old$  perform public.validate_v22_candidate_pool(p_payload);$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$  perform public.validate_v22_keyword_visibility(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);$new$);
  previous := $old$'v22_capability_public_v13')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$'v22_capability_public_v13','v22_capability_public_v14')$new$);
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: store_v22_capability_report'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='validate_v22_candidate_pool';
  previous := $old$case when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13'$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: validate_v22_candidate_pool'; end if;
  definition := replace(definition,previous,$new$case when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13'$new$);
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: validate_v22_candidate_pool'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
  select pg_get_functiondef(oid) into strict definition from pg_proc where pronamespace='public'::regnamespace and proname='validate_v22_candidate_selection';
  previous := $old$'2.2.8')$old$;
  if position(previous in definition)=0 then raise exception 'P101_TARGET_MISSING: validate_v22_candidate_selection'; end if;
  definition := replace(definition,previous,$new$'2.2.8','2.2.9')$new$);
  execute definition;
end;
$migration$;
commit;
