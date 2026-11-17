-- Original production definition; restore original ACL.
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
end $function$
;
