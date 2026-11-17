-- Rollback definition; preserve original ACL.
CREATE OR REPLACE FUNCTION public.validate_v22_candidate_selection(p jsonb, c jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare a jsonb; original jsonb; ids jsonb; visible jsonb; tech jsonb; expected jsonb; seen text[]='{}'; shown text[]='{}';
begin
 if c->>'schema_version' is distinct from 'v22_delivery_revision_v3' or coalesce(p->>'schema_version','') not in ('2.2.7','2.2.8','2.2.9') then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
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
end; $function$
;
