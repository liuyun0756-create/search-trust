CREATE OR REPLACE FUNCTION public.validate_v22_possible_reasons(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m jsonb=p->'input_manifest'; g jsonb=p->'gbp_comparison'; d jsonb; item jsonb; items jsonb='[]'; refs jsonb; indices jsonb;
 metric text; label text; own text; nums text; own_value text; i integer; idx integer; wanted jsonb;
begin
 if p->>'schema_version' is distinct from '2.2.12' then
  if p ? 'possible_reasons' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;return;
 end if;
 if m->>'ruleset_version' is distinct from 'v22_capability_public_v17' or m->>'schema_version' is distinct from 'v22_analysis_input_v7' then raise exception 'CAPABILITY_REASONS_VERSION_INVALID';end if;
 perform public.validate_v22_gbp_comparison(p);
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
 wanted=jsonb_build_object('schema_version','possible_reasons_v1','status',case when jsonb_array_length(items)>0 then 'assessed' else 'not_assessed' end,'items',items);
 if p->'possible_reasons' is distinct from wanted then raise exception 'CAPABILITY_REASONS_BINDING_INVALID';end if;
end $function$;
