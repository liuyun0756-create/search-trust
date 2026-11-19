CREATE OR REPLACE FUNCTION public.validate_v22_local_entity_coverage(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
