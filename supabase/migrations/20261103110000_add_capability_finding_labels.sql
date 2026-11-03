-- P0-06: additive report version. Never rewrite a frozen report or snapshot.
begin;
alter table public.capability_report_versions
  drop constraint capability_report_versions_schema_version_check,
  drop constraint capability_report_input_variant,
  add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3','2.2.4','2.2.5')),
  add constraint capability_report_input_variant check(
    (schema_version in ('2.2.2','2.2.4','2.2.5') and manifest_id is not null and review_input_job_id is null)
    or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

do $migration$
declare definition text; previous text; replacement text;
begin
  select pg_get_functiondef('public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure) into definition;
  previous := $$p_manifest->>'ruleset_version' is distinct from 'v22_capability_public_v7'$$;
  replacement := $$coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8')$$;
  if position(previous in definition)=0 then raise exception 'P006_MANIFEST_GATE_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) into definition;
  previous := $$case when manifest.payload->>'schema_version'='v22_analysis_input_v2' then '2.2.4' else '2.2.2' end$$;
  replacement := $$case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_service_v5') then '2.2.5'
    when manifest.payload->>'schema_version'='v22_analysis_input_v2' then '2.2.4' else '2.2.2' end$$;
  if position(previous in definition)=0 then raise exception 'P006_REPORT_GATE_MISSING'; end if;
  definition := replace(definition,previous,replacement);
  previous := $$select * into saved from public.capability_report_versions where id=p_job_id;$$;
  replacement := $$if p_payload->>'schema_version'='2.2.5' and (
    jsonb_typeof(p_payload->'findings') is distinct from 'array'
    or jsonb_array_length(p_payload->'findings') not between 1 and 50
    or exists (select 1 from jsonb_array_elements(p_payload->'findings') f where
      coalesce(f->>'kind','') not in ('fact','inference','recommendation')
      or coalesce(f->>'status','') not in ('confirmed','not_detected','not_checked','not_assessed')
      or f->>'kind'<>'fact' and f->>'status'<>'not_assessed'
      or jsonb_typeof(f->'coverage') is distinct from 'array'
      or jsonb_array_length(f->'coverage') not between 1 and 8
      or exists (select 1 from jsonb_array_elements(f->'coverage') c where
        coalesce(c->>'source','') not in ('site','gbp','serp','competitor','citation','gsc','ga4','rendered')
        or jsonb_typeof(c->'checked') is distinct from 'boolean')
      or (select count(*) from jsonb_array_elements(f->'coverage'))<>(select count(distinct c->>'source') from jsonb_array_elements(f->'coverage') c))
    ) then raise exception 'CAPABILITY_FINDING_LABELS_INVALID'; end if;
  if manifest.payload->>'ruleset_version'='v22_capability_public_v8' then
    if jsonb_typeof(p_payload->'contact_checks') is distinct from 'array'
      or jsonb_array_length(p_payload->'contact_checks')>4
      or exists (select 1 from jsonb_array_elements(p_payload->'contact_checks') c where
        coalesce(c->>'field','') not in ('phone','address','business_name','service_area')
        or coalesce(c->>'status','') not in ('confirmed','not_detected','not_checked','not_assessed')
        or coalesce(c->>'result','') not in ('match','partial_match','mismatch','none')
        or coalesce(c->>'basis','') not in ('structured','text_pattern','rendered')
        or jsonb_typeof(c->'compared_components') is distinct from 'array'
        or jsonb_typeof(c->'omitted_components') is distinct from 'array'
        or jsonb_typeof(c->'evidence_ids') is distinct from 'array'
        or exists(select 1 from jsonb_array_elements_text(c->'evidence_ids') id
          where not exists(select 1 from jsonb_array_elements(p_payload->'evidence') e where e->>'id'=id)))
      or (select count(*) from jsonb_array_elements(p_payload->'contact_checks')) <>
         (select count(distinct c->>'field') from jsonb_array_elements(p_payload->'contact_checks') c)
    then raise exception 'CAPABILITY_CONTACT_CHECKS_INVALID'; end if;
  elsif p_payload ? 'contact_checks' then raise exception 'CAPABILITY_CONTACT_CHECKS_INVALID'; end if;
  select * into saved from public.capability_report_versions where id=p_job_id;$$;
  if position(previous in definition)=0 then raise exception 'P006_REPORT_LABEL_INSERTION_MISSING'; end if;
  execute replace(definition,previous,replacement);

  select pg_get_functiondef('public.list_v22_completed_capability_reports(uuid)'::regprocedure) into definition;
  previous := $$('2.2.2','2.2.4')$$;
  if position(previous in definition)=0 then raise exception 'P006_LIST_GATE_MISSING'; end if;
  execute replace(definition,previous,$$('2.2.2','2.2.4','2.2.5')$$);
end;
$migration$;
commit;
