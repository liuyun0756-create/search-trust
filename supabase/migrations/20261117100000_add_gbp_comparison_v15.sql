-- P1-02 phase 1: v15 / report 2.2.10 / manifest v5. No new collection.
-- Rollback: restore docs/acquisition-plan/rollback/20261117100000/*.sql in reverse order.
-- Original definitions, md5 baselines and ACLs were read-only exported before implementation.
begin;
do $constraint$
begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from '559a7e341e80c31f0e9a426ee328e326' then raise exception 'P1_02_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;
do $constraint$
begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from 'b8bfa86660a44be24206258fe8c26584' then raise exception 'P1_02_CONSTRAINT_BASELINE_MISMATCH'; end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text])));
end $constraint$;

create function public.validate_v22_gbp_comparison(p jsonb)
returns void language plpgsql stable security definer set search_path=public as $function$
declare m jsonb=p->'input_manifest'; v jsonb=p->'gbp_comparison'; customer jsonb; rivals jsonb; market jsonb; run jsonb; record jsonb; call jsonb; profile_time timestamptz; customer_time timestamptz;
 row jsonb; item jsonb; original jsonb; profile jsonb; review jsonb; d jsonb; other jsonb; val jsonb;
 source_id text; customer_id text; rival_id text; field text; path text; idx integer=0; n integer; r integer; count90 integer;
 ts timestamptz; latest timestamptz; bad_dates boolean; min_at timestamptz; max_at timestamptz; i integer;
begin
 if p->>'schema_version' is distinct from '2.2.10' then
  if p ? 'gbp_comparison' then raise exception 'CAPABILITY_GBP_COMPARISON_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from 'v22_capability_public_v15' or m->>'schema_version' is distinct from 'v22_analysis_input_v5'
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
     if (item->>'value')::integer is distinct from (case when n=0 and (profile->>'review_count')::integer=0 then 0 else count90 end)
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
revoke all on function public.validate_v22_gbp_comparison(jsonb) from public,anon,authenticated;
grant execute on function public.validate_v22_gbp_comparison(jsonb) to service_role;

do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition)<>'c121b2eb1356479b642cb18715f86869' or
    (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure)<>'f172266d5e7829d575989104aec0ad19' then
  raise exception 'P1_02_BASELINE_MISMATCH_CHECK_V22_ACQUISITION_PREPARATION_BINDING'; end if;
 previous := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14'),false)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15'),false)
$new$);
 if md5(definition)<>'8e2c1097d74eb68c7c86563b5fe440db' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition)<>'c6b4ae7397a69289c917bbf254092cd3' or
    (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure)<>'31a66c58a7825cd74e4386d23a7feca8' then
  raise exception 'P1_02_BASELINE_MISMATCH_ENFORCE_V22_DELIVERY_PREREQUISITES'; end if;
 previous := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10') then
$new$);
 if md5(definition)<>'8abf69017464bddb15e9481033e5b23c' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition)<>'d90cf92134dfa47a603963d4937f46a2' or
    (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure)<>'e5c12b7fbed4afc104e0976586307983' then
  raise exception 'P1_02_BASELINE_MISMATCH_FREEZE_V22_ANALYSIS_MANIFEST'; end if;
 previous := $old$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5')
$new$);
previous := $old$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') then
$new$);
previous := $old$  if (p_manifest->>'schema_version'='v22_analysis_input_v4') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v14') then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version'='v22_analysis_input_v4' then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') then
$new$);
previous := $old$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15'))
$new$);
previous := $old$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
$new$);
previous := $old$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15')
$new$);
 if md5(definition)<>'8adee228259bd82739602048eee08c41' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition)<>'148b5a7a1bec604c8b1e0aa0d460a133' or
    (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure)<>'f38430cb4361dc0979d12e7554fe7c30' then
  raise exception 'P1_02_BASELINE_MISMATCH_GET_V22_COMPLETED_PLAN_SOURCE'; end if;
 previous := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10') then
$new$);
 if md5(definition)<>'facffdc84ca01bc62721df1f03aca6fe' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'9c4419da8d7baa90ac956600047229ab' or
    (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure)<>'dae8cb09af0167380641f46e5d808f5c' then
  raise exception 'P1_02_BASELINE_MISMATCH_HYDRATE_V22_CAPABILITY_GENERATION_INPUT'; end if;
 previous := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition)<>'267902612ec5bc49781c2975abe1ec0c' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition)<>'8e3ae6db6a571e7f3cfd49bcf3aab2d0' or
    (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure)<>'f3538d0b40b52fd2c5b9319b84004cff' then
  raise exception 'P1_02_BASELINE_MISMATCH_LIST_V22_COMPLETED_CAPABILITY_REPORTS'; end if;
 previous := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10')
$new$);
 if md5(definition)<>'650e7701e5a063eae4a30fe530bc4595' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'671c2f5a8954b5f7557e57ec641b7c35' or
    (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure)<>'25e7094b217029b15334cac79eaa2ac9' then
  raise exception 'P1_02_BASELINE_MISMATCH_PREPARE_V22_CAPABILITY_ANALYSIS_INPUT_CORE'; end if;
 previous := $old$  if p_manifest->>'schema_version'='v22_analysis_input_v4' and exists(
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') and exists(
$new$);
previous := $old$  if p_manifest->>'schema_version'='v22_analysis_input_v4' and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 if md5(definition)<>'4e4809115e074fbbcebb041b89e380ef' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition)<>'d13507ad46606451ba288c96fcb0c359' or
    (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure)<>'6d2b65d8f8f6aef6119a95a0d9bc4703' then
  raise exception 'P1_02_BASELINE_MISMATCH_PREPARE_V22_PUBLIC_REASSESSMENT'; end if;
 previous := $old$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9') or r->>'report_type' is distinct from 'prospect'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10') or r->>'report_type' is distinct from 'prospect'
$new$);
previous := $old$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)
    or (base.schema_version='2.2.10') is distinct from (r->>'schema_version'='2.2.10')
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(r);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_gbp_comparison(r);
  perform public.validate_v22_candidate_pool(r);
$new$);
 if md5(definition)<>'1291df5849a6747f5b0ace2e9b590a76' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition)<>'acf6dd686837ff1a74354e33a4316d91' or
    (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure)<>'5548b36f25121f6901d6da5832b9cc8e' then
  raise exception 'P1_02_BASELINE_MISMATCH_SAVE_V22_REPORT_CONTENT_REVISION'; end if;
 previous := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
previous := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9')
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10')
$new$);
 if md5(definition)<>'a8538242a211ccbac77ee2b30ca23efa' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'d846e800e3a11964be298a0e3f4f32ee' or
    (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure)<>'017481fa9c59a6958a078e95964635b6' then
  raise exception 'P1_02_BASELINE_MISMATCH_STORE_V22_CAPABILITY_REPORT'; end if;
 previous := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
previous := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9') and (
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10') and (
$new$);
previous := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') then
$new$);
previous := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14') then 5 else 4 end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') then 5 else 4 end)
$new$);
previous := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14') and c->>'field'='opening_hours'))
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15') and c->>'field'='opening_hours'))
$new$);
previous := $old$  perform public.validate_v22_candidate_pool(p_payload);
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$  perform public.validate_v22_gbp_comparison(p_payload);
  perform public.validate_v22_candidate_pool(p_payload);
$new$);
 if md5(definition)<>'7f769b1b7ba4e1b00d00259be4b25d74' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition)<>'92041f276d4a4795556c1a594f4a72dc' or
    (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure)<>'e6fa21df1a1738e3913d9ebe1f594b4c' then
  raise exception 'P1_02_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_POOL'; end if;
 previous := $old$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9') then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10') then
$new$);
previous := $old$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
$new$);
 if md5(definition)<>'cce080ca352f02acfe94454aab5699c8' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'5b02daeed4e95013fb2fb2317a2aa42d' or
    (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure)<>'599da1e4f38077888244ac486c389aec' then
  raise exception 'P1_02_BASELINE_MISMATCH_VALIDATE_V22_CANDIDATE_SELECTION'; end if;
 previous := $old$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9','2.2.10') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 if md5(definition)<>'13dbb871a701c4ccd51297689ed493f3' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
do $migration$
declare definition text; previous text; original_acl text;
begin
 select pg_get_functiondef(oid), proacl::text into strict definition, original_acl from pg_proc
 where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition)<>'f892f53308e78a71f76ac3e349ca1e36' or
    (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure)<>'0d0651393325b68c05fa7a0ad0688612' then
  raise exception 'P1_02_BASELINE_MISMATCH_VALIDATE_V22_KEYWORD_VISIBILITY'; end if;
 previous := $old$ if p->>'schema_version' is distinct from '2.2.9' then
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10') then
$new$);
previous := $old$ if m->>'ruleset_version' is distinct from 'v22_capability_public_v14' or m->>'schema_version' is distinct from 'v22_analysis_input_v4'
$old$;
 if position(previous in definition)=0 then raise exception 'P1_02_TARGET_MISSING'; end if;
 definition := replace(definition,previous,$new$ if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
$new$);
 if md5(definition)<>'fc1dc1727006ec6a441c38f8e0e6e731' then raise exception 'P1_02_PATCH_RESULT_MISMATCH'; end if;
 execute definition;
 if (select proacl::text from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure) is distinct from original_acl then raise exception 'P1_02_ACL_CHANGED'; end if;
end $migration$;
commit;
