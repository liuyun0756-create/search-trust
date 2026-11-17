-- Rollback definition; preserve original ACL.
CREATE OR REPLACE FUNCTION public.validate_v22_candidate_pool(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare a jsonb; e jsonb; m jsonb; ids jsonb; tech jsonb; field text; val jsonb; seen text[]='{}'; selected_seen text[]='{}';
begin
 if coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9') then
   if p ? 'action_candidates' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   return;
 end if;
 if p#>>'{input_manifest,ruleset_version}' is distinct from (case when p->>'schema_version'='2.2.9' then 'v22_capability_public_v14' when p->>'schema_version'='2.2.8' then 'v22_capability_public_v13' else 'v22_capability_public_v12' end)
   or p#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v3'
   or jsonb_typeof(p->'action_candidates') is distinct from 'array'
   or jsonb_array_length(p->'action_candidates')>1000
   or jsonb_typeof(p#>'{prioritization,candidates}') is distinct from 'array'
   or jsonb_array_length(p#>'{prioritization,candidates}')<>jsonb_array_length(p->'action_candidates')
 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
 select coalesce(jsonb_agg(x->'id' order by n),'[]') into ids from jsonb_array_elements(p->'action_candidates') with ordinality t(x,n);
 if ids is distinct from p#>'{prioritization,candidate_order}' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
 for a in select value from jsonb_array_elements(p->'action_candidates') loop
   if jsonb_typeof(a->'id') is distinct from 'string' or a->>'id'=any(seen)
     or jsonb_typeof(a->'dependencies') is distinct from 'array'
     or jsonb_typeof(a->'finding_ids') is distinct from 'array' or jsonb_array_length(a->'finding_ids')=0
     or jsonb_typeof(a->'materials') is distinct from 'array'
     or exists(select 1 from jsonb_array_elements_text(a->'dependencies') d where not(d=any(seen)))
     or exists(select 1 from jsonb_array_elements_text(a->'finding_ids') id where not exists(select 1 from jsonb_array_elements(p->'findings') f where f->>'id'=id))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   if a-array['id','title','target','finding_ids','steps','completion','review','dependencies','materials']<>'{}'::jsonb
     or jsonb_array_length(a->'dependencies')>2 or jsonb_array_length(a->'finding_ids')>20 or jsonb_array_length(a->'materials')>3
     or (select count(distinct x) from jsonb_array_elements(a->'finding_ids') x)<>jsonb_array_length(a->'finding_ids')
     or (select count(distinct x) from jsonb_array_elements(a->'dependencies') x)<>jsonb_array_length(a->'dependencies')
     or (select count(distinct x->>'id') from jsonb_array_elements(a->'materials') x)<>jsonb_array_length(a->'materials')
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   foreach field in array array['id','title','target','review'] loop
     if jsonb_typeof(a->field) is distinct from 'string' or length(btrim(a->>field)) not between 1 and (case when field in ('id','title') then 200 else 2000 end)
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   end loop;
   foreach field in array array['steps','completion'] loop
     if jsonb_typeof(a->field) is distinct from 'array' or jsonb_array_length(a->field) not between 1 and 12
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     for val in select value from jsonb_array_elements(a->field) loop
       if jsonb_typeof(val) is distinct from 'string' or length(btrim(val#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
   end loop;
   select value into e from jsonb_array_elements(p#>'{prioritization,candidates}') where value#>>'{input,action_id}'=a->>'id';
   if e is null or (select count(*) from jsonb_array_elements(p#>'{prioritization,candidates}') x where x#>>'{input,action_id}'=a->>'id')<>1
     or e#>'{input,finding_ids}' is distinct from (select jsonb_agg(x order by x) from jsonb_array_elements(a->'finding_ids') x)
     or e#>'{input,dependencies}' is distinct from (select coalesce(jsonb_agg(x order by x),'[]') from jsonb_array_elements(a->'dependencies') x)
     or e#>'{input,target}' is distinct from a->'target'
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   select coalesce(jsonb_agg(f->'id' order by f->>'id'),'[]') into tech from jsonb_array_elements(p->'findings') f
     where a->'finding_ids' @> jsonb_build_array(f->'id') and f->>'rule_id' in ('v22_public.site_http_error','v22_public.site_explicit_noindex')
       and f->>'kind'='fact' and f->>'status'='confirmed' and f->>'confidence' in ('medium','high') and f->>'interpretation'='supported'
       and jsonb_typeof(f->'evidence_ids')='array' and jsonb_array_length(f->'evidence_ids')>0;
   if e->'technical_finding_ids' is distinct from tech
     or (e->>'prerequisite'='access_indexing') is distinct from (jsonb_array_length(tech)>0)
     or e->'default_visible' is distinct from to_jsonb(exists(select 1 from jsonb_array_elements(p->'findings') f
       where a->'finding_ids' @> jsonb_build_array(f->'id') and f->>'status'='confirmed' and f->>'confidence' in ('medium','high')))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   for m in select value from jsonb_array_elements(a->'materials') loop
     if m-array['id','kind','title','target','body','readiness','confirmation_items','evidence_ids']<>'{}'::jsonb
       or coalesce(m->>'kind','') not in ('title_brief','service_brief','profile_correction','technical_check','measurement_check')
       or coalesce(m->>'readiness','') not in ('instructions','requires_confirmation','ready_to_use')
       or jsonb_typeof(m->'confirmation_items') is distinct from 'array' or jsonb_array_length(m->'confirmation_items')>12
       or (m->>'readiness'='ready_to_use' and jsonb_array_length(m->'confirmation_items')<>0)
       or (m->>'readiness'='requires_confirmation' and jsonb_array_length(m->'confirmation_items')=0)
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     foreach field in array array['id','title','target','body'] loop
       if jsonb_typeof(m->field) is distinct from 'string' or length(btrim(m->>field)) not between 1 and (case when field in ('id','title') then 200 else 2000 end)
       then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
     for val in select value from jsonb_array_elements(m->'confirmation_items') loop
       if jsonb_typeof(val) is distinct from 'string' or length(btrim(val#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
     end loop;
     if jsonb_typeof(m->'evidence_ids') is distinct from 'array' or jsonb_array_length(m->'evidence_ids') not between 1 and 20
       or (select count(distinct x) from jsonb_array_elements(m->'evidence_ids') x)<>jsonb_array_length(m->'evidence_ids') or exists(
       select 1 from jsonb_array_elements_text(m->'evidence_ids') id where not exists(
         select 1 from jsonb_array_elements(p->'findings') f where a->'finding_ids' @> jsonb_build_array(f->'id') and f->'evidence_ids' @> to_jsonb(array[id])))
     then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   end loop;
   seen=array_append(seen,a->>'id');
 end loop;
 for a in select value from jsonb_array_elements(p->'actions') loop
   if not exists(select 1 from jsonb_array_elements(p->'action_candidates') x where x=a)
     or a->>'id'=any(selected_seen) or exists(select 1 from jsonb_array_elements_text(a->'dependencies') d where not(d=any(selected_seen)))
     or not exists(select 1 from jsonb_array_elements(p#>'{prioritization,candidates}') x where x#>>'{input,action_id}'=a->>'id' and x->'default_visible'='true'::jsonb and x->'selected_order'=to_jsonb(cardinality(selected_seen)+1))
   then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   selected_seen=array_append(selected_seen,a->>'id');
 end loop;
 if to_jsonb(selected_seen) is distinct from p#>'{prioritization,action_order}' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
end; $function$
;
