CREATE OR REPLACE FUNCTION public.validate_v22_keyword_visibility(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb=p->'keyword_visibility'; m jsonb=p->'input_manifest'; source public.data_snapshots;
 ref jsonb; row jsonb; item jsonb; record jsonb; run jsonb; a jsonb; channel text; field text; rid text; ep text;
 idx integer=0; k integer; h integer; grade text; ids integer; domain text;
begin
 if coalesce(p->>'schema_version','') not in ('2.2.9','2.2.10','2.2.11','2.2.12','2.2.13') then
  if p ? 'keyword_visibility' then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if; return;
 end if;
 if m->>'ruleset_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_capability_public_v18' when p->>'schema_version'='2.2.12' then 'v22_capability_public_v17' when p->>'schema_version'='2.2.11' then 'v22_capability_public_v16' when p->>'schema_version'='2.2.10' then 'v22_capability_public_v15' else 'v22_capability_public_v14' end) or m->>'schema_version' is distinct from (case when p->>'schema_version'='2.2.13' then 'v22_analysis_input_v8' when p->>'schema_version'='2.2.12' then 'v22_analysis_input_v7' when p->>'schema_version'='2.2.11' then 'v22_analysis_input_v6' when p->>'schema_version'='2.2.10' then 'v22_analysis_input_v5' else 'v22_analysis_input_v4' end)
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
