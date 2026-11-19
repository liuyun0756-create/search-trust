CREATE OR REPLACE FUNCTION public.validate_v22_landing_comparison(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb=p->'input_manifest'; module jsonb=p->'landing_page_comparison'; row jsonb; metric jsonb; e jsonb; source jsonb; inv jsonb; deep jsonb;
 c jsonb; other jsonb; expected jsonb; indices jsonb; counts jsonb; fields text[]=array['local_entities','case_study','portfolio','credentials','service_price','discount','project_budget'];
 types text[]=array['home','service_index','service_detail','service_area','location','about','contact','team','review_testimonial','case_study_portfolio','faq','blog_index','blog_post','product_category','product_detail','legal','other'];
 eligible boolean; sid uuid; i integer=0; n integer; idx integer; field text; path text; quote text; original text; reason text; min_at timestamptz; max_at timestamptz;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.11','2.2.12') then
  if p ? 'landing_page_comparison' then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' else 'v22_capability_public_v16' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' else 'v22_analysis_input_v6' end)
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
