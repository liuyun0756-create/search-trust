-- v22 saved-input identity reassessment. No change to stored reports or snapshot checksums.

begin;

CREATE FUNCTION public.resolve_v22_report_recipe(p_manifest jsonb, p_allow_preview boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare target_manifest_id uuid=(p_manifest->>'id')::uuid; saved_recipe jsonb;
  base public.capability_report_versions; frozen jsonb;
begin
 select g.recipe into saved_recipe from public.capability_generation_recipes g where g.manifest_id=target_manifest_id;
 if found then return saved_recipe; end if;
 if not coalesce(p_allow_preview,false)
   or p_manifest->>'execution_type' is distinct from 'public_reassessment'
   or p_manifest->>'ruleset_version' is distinct from 'v22_capability_public_v22'
   or p_manifest->>'schema_version' is distinct from 'v22_analysis_input_v12'
   or p_manifest->>'mode' is distinct from 'acquisition'
   or target_manifest_id is null
   or exists(select 1 from public.analysis_input_manifests f where f.id=target_manifest_id)
   or p_manifest->>'input_checksum' is distinct from public.v22_review_hash(p_manifest-'input_checksum')
 then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;

 select * into base from public.get_v22_completed_capability_report(
   (p_manifest->>'user_id')::uuid,(p_manifest->>'case_id')::uuid,
   (p_manifest#>>'{base_report_ref,report_id}')::uuid);
 if base.id is null or base.schema_version is distinct from '2.2.17'
   or p_manifest#>>'{base_report_ref,report_type}' is distinct from 'prospect'
   or p_manifest#>>'{base_report_ref,case_id}' is distinct from base.case_id::text
   or p_manifest#>>'{base_report_ref,version}' is distinct from base.payload->>'version'
   or p_manifest#>>'{base_report_ref,payload_checksum}' is distinct from base.payload_checksum
   or base.payload_checksum is distinct from public.v22_review_hash(base.payload)
 then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;

 select f.payload,g.recipe into frozen,saved_recipe
 from public.analysis_input_manifests f join public.capability_generation_recipes g
   on (g.manifest_id,g.user_id,g.case_id)=(f.id,f.user_id,f.case_id)
 where (f.id,f.user_id,f.case_id)=(base.manifest_id,base.user_id,base.case_id)
   and f.payload=base.payload->'input_manifest' and f.payload->>'id'=f.id::text
   and f.input_checksum=f.payload->>'input_checksum'
   and f.input_checksum=public.v22_review_hash(f.payload-'input_checksum')
   and g.generation_input_checksum=f.payload->>'generation_input_checksum';
 if not found or p_manifest->'snapshots' is distinct from frozen->'snapshots'
   or p_manifest->'business' is distinct from frozen->'business'
   or p_manifest->'identity_inheritance' is distinct from frozen->'identity_inheritance'
   or p_manifest->>'evidence_as_of' is distinct from frozen->>'evidence_as_of'
 then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
 return saved_recipe;
end
$function$
;
revoke all on function public.resolve_v22_report_recipe(jsonb,boolean) from public,anon,authenticated,service_role;

CREATE FUNCTION public.validate_v22_gbp_comparison(p jsonb, p_allow_preview boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb; saved_manifest jsonb=p->'input_manifest'; review_version boolean=coalesce(p->>'schema_version'='2.2.17',false); v jsonb=p->'gbp_comparison'; customer jsonb; rivals jsonb; market jsonb; run jsonb; record jsonb; call jsonb; profile_time timestamptz; customer_time timestamptz;
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
  or jsonb_array_length(v->'differences')<>6 or (v-array['schema_version','rows','differences']-case when review_version then 'customer_sampling' else '' end)<>'{}'::jsonb
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
 if review_version and v->'customer_sampling' is distinct from (
  select jsonb_build_object('sampled_at',s->'sampled_at','page_count',jsonb_array_length(s->'pages'),
    'returned_count',(select coalesce(sum((page->>'returned')::int),0) from jsonb_array_elements(s->'pages') page),
    'sort_verified',jsonb_array_length(s->'pages')>0 and not exists (
      select 1 from jsonb_array_elements(s->'pages') page where page->>'sort_verified' is distinct from 'true'),
    'stop',s->'stop','invalid_records',s->'invalid_records','discarded_recent_or_invalid',s->'discarded_recent_or_invalid')
  from (select customer->'review_sample' s) sample
 ) then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID'; end if;
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
   if row->>'name' is distinct from (public.resolve_v22_report_recipe(saved_manifest,p_allow_preview)#>>'{request,business_identity,business_name}') then raise exception 'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'; end if;
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
end $function$
;
revoke all on function public.validate_v22_gbp_comparison(jsonb,boolean) from public,anon,authenticated,service_role;

CREATE FUNCTION public.validate_v22_possible_reasons(p jsonb, p_allow_preview boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 perform public.validate_v22_gbp_comparison(case when review_version then original_report else p end,p_allow_preview);
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
end $function$
;
revoke all on function public.validate_v22_possible_reasons(jsonb,boolean) from public,anon,authenticated,service_role;

CREATE FUNCTION public.validate_v22_reassessment_report(p jsonb, p_allow_preview boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare manifest jsonb=p->'input_manifest'; gbp jsonb; recipe jsonb;
begin
 if p->>'schema_version'='2.2.17' then
   recipe=public.resolve_v22_report_recipe(manifest,p_allow_preview);
   select s.normalized_payload into gbp
     from jsonb_array_elements(manifest->'snapshots') ref
     join public.data_snapshots s on s.id=(ref->>'snapshot_id')::uuid
     where ref->>'source_kind'='public_gbp' and s.case_id=(manifest->>'case_id')::uuid
       and s.payload_checksum=ref->>'payload_checksum';
   perform public.validate_v22_customer_review_sample(gbp,manifest,recipe#>>'{request,business_identity,selected_branch_ref}');
 end if;
 perform public.validate_v22_keyword_visibility(p);
 perform public.validate_v22_gbp_comparison(p,p_allow_preview);
 perform public.validate_v22_landing_comparison(p);
 perform public.validate_v22_possible_reasons(p,p_allow_preview);
 perform public.validate_v22_local_entity_coverage(p);
 perform public.validate_v22_action_advice(p);
 perform public.validate_v22_candidate_pool(p);
end
$function$
;
revoke all on function public.validate_v22_reassessment_report(jsonb,boolean) from public,anon,authenticated,service_role;

do $migration$
declare target regprocedure='public.v22_a3_manifest_shape(jsonb)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> '5da9618d0d5796cc9f37ba0c99e8f14b'
   or md5(pg_get_functiondef(target)) <> '4b2b6fccd5ad492ea71d2fdd41c064d7'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: v22_a3_manifest_shape'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.v22_a3_manifest_shape(m jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
   or m->>'mode' is distinct from 'acquisition' or manifest_version is null
   or (m ? 'execution_type' and (
       m->>'ruleset_version' is distinct from 'v22_capability_public_v22'
       or m->>'execution_type' is distinct from 'public_reassessment'
       or jsonb_typeof(m->'base_report_ref') is distinct from 'object'
       or m#>>'{base_report_ref,case_id}' is distinct from m->>'case_id'
       or m#>>'{base_report_ref,report_type}' is distinct from 'prospect'
       or m#>>'{base_report_ref,report_id}' is null
       or m#>>'{base_report_ref,report_id}' is not distinct from m->>'job_id'
       or coalesce(m#>>'{base_report_ref,payload_checksum}','') !~ '^sha256:[a-f0-9]{64}$'
       or nullif(m->>'evidence_as_of','') is null
       or (m->>'evidence_as_of')::timestamptz>(m->>'evaluated_at')::timestamptz))
   or (m->>'ruleset_version'='v22_capability_public_v22' and m ? 'base_report_ref' and not m ? 'execution_type')
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
end $function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> 'fb51cdfa5ddd12d303bcc5697c447e4c' or md5(pg_get_functiondef(oid)) <> '9f4986549a9594ca62880b82d5c35bbe'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: v22_a3_manifest_shape'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> 'dcd19f685b1c09b95c09a58ff98ee90e'
   or md5(pg_get_functiondef(target)) <> '94961785c9a230aa9f9ac550efabc1a5'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: prepare_v22_public_reassessment'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.prepare_v22_public_reassessment(p_user_id uuid, p_case_id uuid, p_report_id uuid, p_request_id uuid, p_preview jsonb, p_canonical text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare base public.capability_report_versions; m jsonb; r jsonb; old public.capability_reassessment_requests;
  ir integer; dr integer; source jsonb; hydrated jsonb; expected jsonb; visit boolean; location jsonb; confirmation jsonb; saved_address text; base_report_schema text; v22_review boolean; mode_withdrawn boolean; previous_visit jsonb;
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
  v22_review=base.schema_version='2.2.17';
  mode_withdrawn=v22_review and coalesce(p_preview#>'{selection,operating_model}'='null'::jsonb,false);
  if (p_preview#>'{selection,customers_can_visit}' is not null
      and jsonb_typeof(p_preview#>'{selection,customers_can_visit}') is distinct from 'boolean')
    or coalesce(p_preview#>>'{selection,reason}','') ~ '^[[:space:]]*$' then raise exception 'IDENTITY_INVALID'; end if;
  visit=coalesce((p_preview#>>'{selection,customers_can_visit}')::boolean,false);
  location=p_preview#>'{identity,operating_location}';confirmation=location->'confirmation_ref';
  if visit and mode_withdrawn then
    if location->>'role' is distinct from 'customer_facing' or location->>'state' is distinct from 'seo_confirmed'
      or jsonb_typeof(confirmation) is distinct from 'object' then raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID'; end if;
  elsif visit then
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
  base_report_schema=public.v22_a3_report_shape(base.payload)->>'schema_version';
  if p_preview is distinct from p_canonical::jsonb or octet_length(p_canonical)>3000000
    or public.v22_review_hash(r) is distinct from p_preview->>'report_checksum'
    or public.v22_review_hash(m-'input_checksum') is distinct from m->>'input_checksum'
    or public.v22_review_hash(p_preview->'identity') is distinct from m->>'identity_checksum'
    or coalesce(r->>'schema_version','') not in ('2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.17') or r->>'report_type' is distinct from 'prospect'
    or r->>'settlement_policy' is distinct from 'no_charge_public_reassessment'
    or r->>'id' is distinct from m->>'job_id' or r->>'id'=p_report_id::text
    or (r->>'version')::integer is distinct from (base.payload->>'version')::integer+1
    or m->>'execution_type' is distinct from 'public_reassessment'
    or v22_review is distinct from (r->>'schema_version'='2.2.17')
    or (v22_review and (m->>'schema_version' is distinct from 'v22_analysis_input_v12'
      or m->>'ruleset_version' is distinct from 'v22_capability_public_v22'
      or m->'identity_inheritance' is distinct from base.payload#>'{input_manifest,identity_inheritance}'))
    or (not v22_review and (m->>'schema_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_analysis_input_v10' when r->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when r->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when r->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when r->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' when r->>'schema_version'='2.2.9' then 'v22_analysis_input_v4' else 'v22_analysis_input_v3' end) or m->>'ruleset_version' is distinct from (case when r->>'schema_version'='2.2.15' then 'v22_capability_public_v20' when r->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when r->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when r->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when r->>'schema_version'='2.2.10' then 'v22_capability_public_v15' when r->>'schema_version'='2.2.9' then 'v22_capability_public_v14' else 'v22_capability_public_v13' end)))
    or (not v22_review and ((base_report_schema='2.2.15') is distinct from (r->>'schema_version'='2.2.15')
    or (base_report_schema='2.2.13') is distinct from (r->>'schema_version'='2.2.13')
    or (base_report_schema='2.2.12') is distinct from (r->>'schema_version'='2.2.12')
    or (base_report_schema='2.2.11') is distinct from (r->>'schema_version'='2.2.11')
    or (base_report_schema='2.2.10') is distinct from (r->>'schema_version'='2.2.10')
    or (base_report_schema='2.2.9') is distinct from (r->>'schema_version'='2.2.9')))
    or m->>'mode' is distinct from 'acquisition' or m->>'case_id' is distinct from p_case_id::text or m->>'user_id' is distinct from p_user_id::text
    or m#>>'{base_report_ref,report_id}' is distinct from p_report_id::text
    or m#>>'{base_report_ref,payload_checksum}' is distinct from base.payload_checksum
    or m->'snapshots' is distinct from base.payload#>'{input_manifest,snapshots}'
    or m->'business' is distinct from base.payload#>'{input_manifest,business}'
    or m->>'evidence_as_of' is distinct from coalesce(base.payload#>>'{input_manifest,evidence_as_of}',base.payload#>>'{input_manifest,evaluated_at}')
    or (m->>'evaluated_at')::timestamptz < (base.payload->>'generated_at')::timestamptz
    or (m->>'evaluated_at')::timestamptz > now()+interval '5 minutes'
    or p_preview#>>'{identity,schema_version}' is distinct from 'business_identity_v2'
    or (mode_withdrawn and (
        p_preview#>>'{identity,operating_model,source}' is null
        or p_preview#>>'{identity,operating_model,source}'='explicit_confirmation'
        or p_preview#>'{identity,operating_model,confirmation_ref}' is distinct from 'null'::jsonb))
    or (not mode_withdrawn and (
        p_preview#>>'{identity,operating_model,value}' is distinct from p_preview#>>'{selection,operating_model}'
        or p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_by}' is distinct from p_user_id::text
        or p_preview#>>'{identity,operating_model,confirmation_ref,source_ref}' is distinct from 'identity-review:'||p_request_id::text
        or (v22_review and p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_at}' is distinct from m->>'evaluated_at')))
    or jsonb_array_length(r->'actions')>3 then raise exception 'IDENTITY_INVALID'; end if;
  if v22_review then
    if exists(select 1 from public.analysis_input_manifests where id=(m->>'id')::uuid)
      then raise exception 'IDENTITY_SOURCE_CONFLICT'; end if;
    expected=public.hydrate_v22_capability_generation_input(base.payload->'input_manifest',
      public.resolve_v22_report_recipe(m,true));
  else
    expected=(select public.hydrate_v22_capability_generation_input(base.payload->'input_manifest',g.recipe)
      from public.capability_generation_recipes g where g.manifest_id=base.manifest_id);
  end if;
  hydrated=public.hydrate_v22_capability_generation_input(m,p_preview->'recipe');
  if expected is null or hydrated->'evidence_input' is distinct from expected->'evidence_input'
    or public.v22_review_hash(hydrated) is distinct from m->>'generation_input_checksum'
    or hydrated->'business_identity' is distinct from p_preview->'identity'
    or not exists(select 1 from jsonb_array_elements(expected#>'{evidence_input,context,customer_public_gbp,entity_keys}') k
      where (k->>'kind')||':'||(k->>'value')=p_preview#>>'{selection,branch_ref}') then raise exception 'IDENTITY_SOURCE_CONFLICT'; end if;
  if v22_review then
    if public.v22_review_hash(expected) is distinct from base.payload#>>'{input_manifest,generation_input_checksum}'
      or hydrated#>>'{business_identity,business_name}' is distinct from expected#>>'{business_identity,business_name}'
      or hydrated#>>'{business_identity,selected_branch_ref}' is distinct from expected#>>'{business_identity,selected_branch_ref}'
      or hydrated#>>'{business_identity,selected_branch_ref}' is distinct from split_part(p_preview#>>'{selection,branch_ref}',':',2)
      then raise exception 'IDENTITY_SOURCE_CONFLICT'; end if;
    if mode_withdrawn and visit then
      previous_visit=expected#>'{business_identity,operating_location,confirmation_ref}';
      if jsonb_typeof(previous_visit) is distinct from 'object' or confirmation is distinct from (
        previous_visit || jsonb_build_object('source_identity_version_id',
          coalesce(previous_visit->>'source_identity_version_id',base.payload#>>'{input_manifest,identity_version_id}')))
        then raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID'; end if;
    end if;
  end if;
  if visit then
    select s#>>'{payload,record,fields,address,value}' into saved_address
      from jsonb_array_elements(expected#>'{evidence_input,sources}') s
      where s->>'kind'='public_gbp' and s#>>'{payload,record,fields,address,state}'='observed';
    if saved_address is null or location#>>'{location,address}' is distinct from saved_address
      or confirmation->>'address' is distinct from saved_address then raise exception 'IDENTITY_VISIT_ADDRESS_INVALID'; end if;
  end if;
  perform public.validate_v22_reassessment_report(r,v22_review);
  insert into public.capability_reassessment_requests(id,user_id,case_id,base_report_id,preview,preview_checksum,expected_identity_revision,expected_delivery_revision)
    values(p_request_id,p_user_id,p_case_id,p_report_id,p_preview,'sha256:'||encode(sha256(convert_to(p_canonical,'UTF8')),'hex'),ir,dr);
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> '4fe1e3024bf74354f51f86fbbec1f6e9' or md5(pg_get_functiondef(oid)) <> '03e5f96ebd8d103b9868bfee26feec60'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: prepare_v22_public_reassessment'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.commit_v22_public_reassessment(uuid,uuid,uuid,uuid)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> 'c291c65aa49de73bb277481142578733'
   or md5(pg_get_functiondef(target)) <> '8cf5623e7f2b3cb21d7948320e19fab8'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: commit_v22_public_reassessment'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.commit_v22_public_reassessment(p_user_id uuid, p_case_id uuid, p_report_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare q public.capability_reassessment_requests; r jsonb; m jsonb; s jsonb; ir integer; dr integer; result_id uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Share the delivery writer's report lock before reading its latest revision.
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into q from public.capability_reassessment_requests where id=p_request_id and user_id=p_user_id and case_id=p_case_id and base_report_id=p_report_id;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  if exists(select 1 from public.capability_reassessment_completions where request_id=q.id) then
    return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id); end if;
  select coalesce(max(revision),0) into ir from public.case_business_identity_versions where case_id=p_case_id;
  select coalesce(max(revision),0) into dr from public.report_content_revisions where report_id=p_report_id;
  if ir<>q.expected_identity_revision or dr<>q.expected_delivery_revision then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
  if not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id)) then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Do not change the identity under an in-flight collection or review workflow.
  if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved')
    or exists(select 1 from public.analysis_jobs where case_id=p_case_id and status in ('queued','running')) then
    raise exception 'IDENTITY_BUSY' using errcode='40001'; end if;
  r=q.preview->'report';m=r->'input_manifest';result_id=(r->>'id')::uuid;
  insert into public.case_business_identity_versions(id,user_id,case_id,revision,base_report_id,identity,identity_checksum)
    values((m->>'identity_version_id')::uuid,p_user_id,p_case_id,ir+1,p_report_id,q.preview->'identity',m->>'identity_checksum');
  insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key)
    values(result_id,p_case_id,'prospect_report','queued','public-reassessment:'||q.id::text);
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload)
    values((m->>'id')::uuid,p_user_id,p_case_id,result_id,(m#>>'{business,id}')::uuid,'acquisition',m->>'input_checksum',m);
  for s in select value from jsonb_array_elements(m->'snapshots') loop
    insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind) values((m->>'id')::uuid,(s->>'snapshot_id')::uuid,s->>'source_kind');
  end loop;
  insert into public.capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe)
    values((m->>'id')::uuid,p_user_id,p_case_id,m->>'generation_input_checksum',q.preview->'recipe');
  if r->>'schema_version'='2.2.17' then
    -- The new recipe is part of the same transaction. A failed recheck rolls
    -- back the recipe, identity, job and manifest together.
    perform public.validate_v22_reassessment_report(r,false);
  end if;
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(result_id,(m->>'id')::uuid,p_user_id,p_case_id,r->>'schema_version',q.preview->>'report_checksum',r);
  insert into public.capability_reassessment_completions(request_id,report_id,identity_version_id,user_id,case_id)
    values(q.id,result_id,(m->>'identity_version_id')::uuid,p_user_id,p_case_id);
  update public.analysis_jobs set status='succeeded',current_stage='completed',progress=100,completed_at=now(),capability_report_id=result_id
    where id=result_id;
  -- No delivery revision is copied or approved. Existing shares remain pinned.
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> '7a79d22d2cc218ea43b98c053c62170d' or md5(pg_get_functiondef(oid)) <> 'b23b449ce3029f2b01b53a10140fb3f0'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: commit_v22_public_reassessment'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.validate_v22_gbp_comparison(jsonb)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> 'acf06d242092f89d084e0957d28ac928'
   or md5(pg_get_functiondef(target)) <> 'dd8714c4a5f19074d4dd303fbfb7f78b'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: validate_v22_gbp_comparison'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.validate_v22_gbp_comparison(p jsonb)
 RETURNS void
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.validate_v22_gbp_comparison(p,false);
$function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> 'ebe270ff43ba07c4832728bcd573b4b3' or md5(pg_get_functiondef(oid)) <> '044a545a830f81549df7e1143be54f08'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: validate_v22_gbp_comparison'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.validate_v22_possible_reasons(jsonb)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> '9f99a3793ae9e9cb48140167e26180b9'
   or md5(pg_get_functiondef(target)) <> 'b41df040ff85c38df0bb2e4c1b0175b1'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: validate_v22_possible_reasons'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.validate_v22_possible_reasons(p jsonb)
 RETURNS void
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select public.validate_v22_possible_reasons(p,false);
$function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> '830ea01034f2d091b992af2a8d7d492b' or md5(pg_get_functiondef(oid)) <> '84f03f0873f9748d92b3dad49bf2bdde'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: validate_v22_possible_reasons'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.get_v22_acquisition_identity_pin(uuid,uuid,uuid)'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> '82538528d0f425783331731c1db963f1'
   or md5(pg_get_functiondef(target)) <> '7e3142104d5694b4991209b4e3cbd85c'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: get_v22_acquisition_identity_pin'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.get_v22_acquisition_identity_pin(p_user_id uuid, p_case_id uuid, p_job_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select coalesce(public.get_v22_acquisition_preflight_branch_pin(p_user_id,p_case_id,p_job_id), (select jsonb_build_object('id',i.id,'revision',i.revision,'identity',i.identity,'identity_checksum',i.identity_checksum,
  'entity_keys',coalesce((select jsonb_object_agg(k->>'kind',k->>'value')
    from jsonb_array_elements(g.record->'observed_entity_keys') k),'{}'::jsonb),
  'gbp_website_url',case when g.record#>>'{fields,website_url,state}'='observed' then g.record#>>'{fields,website_url,value}' end,
  'gbp_phone',case when g.record#>>'{fields,phone,state}'='observed' then g.record#>>'{fields,phone,value}' end,
  'phone_matched',exists(select 1 from jsonb_array_elements(b.payload->'contact_checks') c
    where c->>'field'='phone' and c->>'status'='confirmed' and c->>'result'='match'))
  || case when i.identity#>>'{operating_model,confirmation_ref,confirmed_at}' is null and (case when b.schema_version='2.2.17' then
      coalesce(i.identity#>>'{operating_location,confirmation_ref,confirmed_at}',b.payload#>>'{input_manifest,identity_inheritance,confirmed_at}') end) is not null
      then jsonb_build_object('branch_confirmed_at', case when b.schema_version='2.2.17' then
      coalesce(i.identity#>>'{operating_location,confirmation_ref,confirmed_at}',b.payload#>>'{input_manifest,identity_inheritance,confirmed_at}') end) else '{}'::jsonb end
 from public.capability_acquisition_preparations a
 join public.case_business_identity_versions i on (i.id,i.user_id,i.case_id)=(a.pinned_identity_version_id,a.user_id,a.case_id)
 join public.capability_report_versions b on (b.id,b.user_id,b.case_id)=(i.base_report_id,i.user_id,i.case_id)
 left join lateral (
   select s.normalized_payload->'record' as record from public.analysis_manifest_snapshots ms
   join public.data_snapshots s on s.id=ms.snapshot_id where ms.manifest_id=b.manifest_id and ms.source_kind='public_gbp'
 ) g on true
 where (a.user_id,a.case_id,a.job_id)=(p_user_id,p_case_id,p_job_id)));
$function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> 'd572b6578ca32dcfe1e27b84e6c125b3' or md5(pg_get_functiondef(oid)) <> '49473d1b845f377ef2bfab8915f5ea8e'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: get_v22_acquisition_identity_pin'; end if;
end $migration$;

do $migration$
declare target regprocedure='public.check_v22_acquisition_preparation_binding()'::regprocedure; previous_acl aclitem[];
begin
 select proacl into strict previous_acl from pg_proc where oid=target;
 if (select md5(prosrc) from pg_proc where oid=target) <> 'b8c9ddac4303d436dfd91298067ba5ed'
   or md5(pg_get_functiondef(target)) <> 'd2486fc3b18a7c2961b7b25497b4f87f'
 then raise exception 'V22_REASSESSMENT_BASELINE_MISMATCH: check_v22_acquisition_preparation_binding'; end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.check_v22_acquisition_preparation_binding()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb; proof jsonb; pinned public.case_business_identity_versions; branch_pin jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if new.payload->>'ruleset_version'='v22_capability_public_v22'
      and new.payload->>'execution_type'='public_reassessment' then
      -- A prepared, no-charge reassessment has no acquisition receipt. Match
      -- the immutable preview, its frozen base, and the identity/job just
      -- created by commit in this same transaction.
      if prep.job_id is not null or not exists (
        select 1 from public.capability_reassessment_requests q
        join public.analysis_jobs j on j.id=new.job_id and j.case_id=new.case_id
          and j.idempotency_key='public-reassessment:'||q.id::text
        join public.case_business_identity_versions i on (i.id,i.user_id,i.case_id)=
          ((new.payload->>'identity_version_id')::uuid,new.user_id,new.case_id)
        join lateral public.get_v22_completed_capability_report(new.user_id,new.case_id,q.base_report_id) b on true
        join public.analysis_input_manifests f on (f.id,f.user_id,f.case_id)=(b.manifest_id,b.user_id,b.case_id)
        where (q.user_id,q.case_id)=(new.user_id,new.case_id)
          and q.preview#>'{report,input_manifest}'=new.payload
          and q.preview#>>'{report,id}'=j.id::text
          and q.preview#>>'{report,schema_version}'='2.2.17'
          and q.preview#>>'{report,settlement_policy}'='no_charge_public_reassessment'
          and q.preview_checksum=public.v22_review_hash(q.preview)
          and j.job_type='prospect_report' and j.status='queued'
          and j.xmin=pg_current_xact_id()::xid and i.xmin=pg_current_xact_id()::xid
          and i.base_report_id=q.base_report_id and i.revision=q.expected_identity_revision+1
          and i.identity=q.preview->'identity' and i.identity_checksum=new.payload->>'identity_checksum'
          and i.identity_checksum=public.v22_review_hash(i.identity)
          and new.mode='acquisition' and new.payload->>'mode'=new.mode
          and new.payload->>'schema_version'='v22_analysis_input_v12'
          and new.payload->>'id'=new.id::text and new.payload->>'job_id'=new.job_id::text
          and new.payload->>'user_id'=new.user_id::text and new.payload->>'case_id'=new.case_id::text
          and new.payload#>>'{business,id}'=new.business_version_id::text
          and new.input_checksum=new.payload->>'input_checksum'
          and new.input_checksum=public.v22_review_hash(new.payload-'input_checksum')
          and new.id<>f.id and new.job_id<>b.id and b.schema_version='2.2.17'
          and (new.payload#>>'{base_report_ref,report_id}',new.payload#>>'{base_report_ref,case_id}',
            new.payload#>>'{base_report_ref,report_type}',new.payload#>>'{base_report_ref,version}')=
            (b.id::text,b.case_id::text,'prospect',b.payload->>'version')
          and new.payload#>>'{base_report_ref,payload_checksum}'=b.payload_checksum
          and b.payload_checksum=public.v22_review_hash(b.payload)
          and f.payload=b.payload->'input_manifest' and f.payload->>'id'=f.id::text
          and f.input_checksum=f.payload->>'input_checksum'
          and f.input_checksum=public.v22_review_hash(f.payload-'input_checksum')
          and new.payload->'snapshots'=f.payload->'snapshots'
          and new.payload->'business'=f.payload->'business'
          and new.payload->'identity_inheritance'=f.payload->'identity_inheritance'
          and new.payload->>'evidence_as_of'=f.payload->>'evidence_as_of'
      ) then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    elsif new.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22') and not exists (
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
          or proof->>'confirmed_at' is distinct from coalesce(pinned.identity#>>'{operating_model,confirmation_ref,confirmed_at}',
             (select case when b.schema_version='2.2.17' then
      coalesce(pinned.identity#>>'{operating_location,confirmation_ref,confirmed_at}',b.payload#>>'{input_manifest,identity_inheritance,confirmed_at}') end
              from public.capability_report_versions b
              where (b.id,b.user_id,b.case_id)=(pinned.base_report_id,pinned.user_id,pinned.case_id)))
          or public.v22_review_hash(pub->'business_identity') is distinct from m.payload->>'identity_checksum'
          or (proof->>'branch'='retained' and pub#>>'{business_identity,selected_branch_ref}' is distinct from pinned.identity->>'selected_branch_ref')
          or (proof->>'operating_model'='retained') is distinct from (pub#>>'{business_identity,operating_model,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'operating_model'='retained' and
              ((pub#>'{business_identity,operating_model,confirmation_ref}')-'evidence_checksum') is distinct from
              ((pinned.identity#>'{operating_model,confirmation_ref}')-'evidence_checksum'))
          or (proof->>'visits'='retained') is distinct from (pub#>>'{business_identity,operating_location,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'visits'='retained' and
              ((pub#>'{business_identity,operating_location,confirmation_ref}')-array['address','source_identity_version_id']) is distinct from
              ((pinned.identity#>'{operating_location,confirmation_ref}')-array['address','source_identity_version_id']))
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
$function$
$definition$;
 if exists (select 1 from pg_proc where oid=target and (proacl is distinct from previous_acl
    or md5(prosrc) <> 'c9acc339bc049f4e8779295309e7b78a' or md5(pg_get_functiondef(oid)) <> '6c0a9241218830a329193aeebf710221'))
 then raise exception 'V22_REASSESSMENT_TARGET_MISMATCH: check_v22_acquisition_preparation_binding'; end if;
end $migration$;

commit;
