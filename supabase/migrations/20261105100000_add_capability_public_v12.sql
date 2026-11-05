-- P1-07 phase 1: additive candidate pool and confirmed technical omission.
-- No frozen rows are rewritten. Apply only in an approved release.
begin;
alter table public.capability_report_versions
 drop constraint capability_report_versions_schema_version_check,
 drop constraint capability_report_input_variant,
 add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4','2.2.5','2.2.6','2.2.7')),
 add constraint capability_report_input_variant check(
   (schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7') and manifest_id is not null and review_input_job_id is null)
   or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

create or replace function public.validate_v22_candidate_pool(p jsonb) returns void
language plpgsql immutable set search_path=public as $fn$
declare a jsonb; e jsonb; m jsonb; ids jsonb; tech jsonb; field text; val jsonb; seen text[]='{}'; selected_seen text[]='{}';
begin
 if p->>'schema_version' is distinct from '2.2.7' then
   if p ? 'action_candidates' then raise exception 'CAPABILITY_CANDIDATES_INVALID'; end if;
   return;
 end if;
 if p#>>'{input_manifest,ruleset_version}' is distinct from 'v22_capability_public_v12'
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
end; $fn$;

create or replace function public.validate_v22_candidate_selection(p jsonb,c jsonb) returns void
language plpgsql immutable set search_path=public as $fn$
declare a jsonb; original jsonb; ids jsonb; visible jsonb; tech jsonb; expected jsonb; seen text[]='{}'; shown text[]='{}';
begin
 if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or p->>'schema_version' is distinct from '2.2.7' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
 if jsonb_typeof(c->'actions') is distinct from 'array' or jsonb_array_length(c->'actions')<>jsonb_array_length(p->'actions')
   or jsonb_array_length(c->'actions')>3 or jsonb_typeof(c->'client_action_ids') is distinct from 'array'
 then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
 for a in select value from jsonb_array_elements(c->'actions') loop
   select value into original from jsonb_array_elements(p->'action_candidates') x where x->>'id'=a->>'id';
   if original is null or a->>'id'=any(seen) or exists(select 1 from jsonb_array_elements_text(original->'dependencies') d where not(d=any(seen)))
   then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
   seen=array_append(seen,a->>'id');
   if c->'client_action_ids' @> jsonb_build_array(a->'id') then
     if exists(select 1 from jsonb_array_elements_text(original->'dependencies') d where not(d=any(shown))) then raise exception 'CAPABILITY_ORDER_INVALID'; end if;
     shown=array_append(shown,a->>'id');
   end if;
 end loop;
 if c->'client_action_ids' is distinct from to_jsonb(shown) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
 select coalesce(jsonb_agg(x#>'{input,action_id}' order by x#>>'{input,action_id}'),'[]') into tech
   from jsonb_array_elements(p#>'{prioritization,candidates}') x where jsonb_array_length(x->'technical_finding_ids')>0;
 if jsonb_array_length(tech)>0 and not exists(select 1 from jsonb_array_elements_text(tech) id where id=any(shown)) then
   expected=jsonb_build_object('confirmed',true,'omitted_action_ids',tech,'selected_action_ids',to_jsonb(seen),'client_action_ids',to_jsonb(shown));
   if c->'technical_omission_confirmation' is distinct from expected then raise exception 'CAPABILITY_TECHNICAL_CONFIRMATION_REQUIRED'; end if;
 elsif c ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_TECHNICAL_CONFIRMATION_INVALID'; end if;
end; $fn$;
revoke all on function public.validate_v22_candidate_pool(jsonb),public.validate_v22_candidate_selection(jsonb,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $old$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11')$old$;
  replacement := $new$('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12')$new$;
  if position(previous in definition)=0 then raise exception 'P107_MANIFEST_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$p_manifest->>'ruleset_version'='v22_capability_public_v11'$old$;
  replacement := $new$p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12')$new$;
  if position(previous in definition)=0 then raise exception 'P107_MANIFEST_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11')$old$;
  replacement := $new$('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12')$new$;
  if position(previous in definition)=0 then raise exception 'P107_MANIFEST_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) into definition;
  previous := $old$case when manifest.payload->>'ruleset_version'='v22_capability_public_v11' then '2.2.6'$old$;
  replacement := $new$case when manifest.payload->>'ruleset_version'='v22_capability_public_v12' then '2.2.7'
    when manifest.payload->>'ruleset_version'='v22_capability_public_v11' then '2.2.6'$new$;
  if position(previous in definition)=0 then raise exception 'P107_REPORT_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$('2.2.5','2.2.6')$old$;
  replacement := $new$('2.2.5','2.2.6','2.2.7')$new$;
  if position(previous in definition)=0 then raise exception 'P107_LABELS_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11') then$old$;
  replacement := $new$('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12') then$new$;
  if position(previous in definition)=0 then raise exception 'P107_LABELS_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$manifest.payload->>'ruleset_version'='v22_capability_public_v11' then 5$old$;
  replacement := $new$manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12') then 5$new$;
  if position(previous in definition)=0 then raise exception 'P107_LABELS_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$manifest.payload->>'ruleset_version'='v22_capability_public_v11' and c->>'field'='opening_hours'$old$;
  replacement := $new$manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12') and c->>'field'='opening_hours'$new$;
  if position(previous in definition)=0 then raise exception 'P107_LABELS_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$  insert into public.capability_report_versions($old$;
  replacement := $new$  perform public.validate_v22_candidate_pool(p_payload);
  insert into public.capability_report_versions($new$;
  if position(previous in definition)=0 then raise exception 'P107_POOL_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.list_v22_completed_capability_reports(uuid)'::regprocedure) into definition;
  previous := $old$('2.2.2','2.2.4','2.2.5','2.2.6')$old$;
  replacement := $new$('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7')$new$;
  if position(previous in definition)=0 then raise exception 'P107_LIST_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure) into definition;
  previous := $old$('v22_delivery_revision_v1','v22_delivery_revision_v2')$old$;
  replacement := $new$('v22_delivery_revision_v1','v22_delivery_revision_v2','v22_delivery_revision_v3')$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_VERSION_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$'actions','client_action_ids']$old$;
  replacement := $new$'actions','client_action_ids','technical_omission_confirmation']$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_FIELDS_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$  if p_content->>'schema_version'='v22_delivery_revision_v2' then$old$;
  replacement := $new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version'='2.2.7') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version'='v22_delivery_revision_v3' then
    perform public.validate_v22_candidate_selection(report.payload,p_content);
  elsif p_content ? 'technical_omission_confirmation' then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  if p_content->>'schema_version' in ('v22_delivery_revision_v2','v22_delivery_revision_v3') then$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_SELECTION_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$('2.2.5','2.2.6')$old$;
  replacement := $new$('2.2.5','2.2.6','2.2.7')$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_LABELS_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$  if expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;$old$;
  replacement := $new$  if p_content->>'schema_version'<>'v22_delivery_revision_v3' and expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_IDENTITIES_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $old$jsonb_array_elements(report.payload->'actions') where value->>'id'=item->>'id'$old$;
  replacement := $new$jsonb_array_elements(case when p_content->>'schema_version'='v22_delivery_revision_v3' then report.payload->'action_candidates' else report.payload->'actions' end) where value->>'id'=item->>'id'$new$;
  if position(previous in definition)=0 then raise exception 'P107_REVISION_MATERIALS_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
  select pg_get_functiondef('public.enforce_v22_delivery_prerequisites()'::regprocedure) into definition;
  previous := $old$  if report.payload#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v2' then return new; end if;$old$;
  replacement := $new$  if report.payload->>'schema_version'='2.2.7' then
    perform public.validate_v22_candidate_selection(report.payload,new.content);
    return new;
  end if;
  if report.payload#>>'{prioritization,rules_version}' is distinct from 'v22_business_priority_v2' then return new; end if;$new$;
  if position(previous in definition)=0 then raise exception 'P107_TRIGGER_TARGET_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  execute definition;
end;
$migration$;
commit;
