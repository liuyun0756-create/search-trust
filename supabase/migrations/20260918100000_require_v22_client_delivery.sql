-- Require the v2.2.1 client-delivery projection at every durable report boundary.
begin;

-- Preserve the latest hardened function bodies and change only their immutable
-- report contract version. This avoids reopening any of the ownership,
-- snapshot-provenance, idempotency, or unified-credit checks added later.
do $$
declare
  signature text;
  definition text;
  signatures text[] := array[
    'public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamp with time zone,uuid,jsonb,text,uuid,jsonb,text,timestamp with time zone,jsonb,jsonb)',
    'public.resolve_v22_first_party_findings_input(uuid,uuid,uuid,uuid,uuid,timestamp with time zone)',
    'public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)',
    'public.settle_v22_verified_job_on_report_link()',
    'public.resolve_v22_verified_analysis_input_strict_generation_v2(uuid,uuid,integer)',
    'public.is_v22_verified_success_replay(uuid,uuid,integer)',
    'public.persist_v22_verified_result_strict_generation_v2(uuid,uuid,jsonb,integer)'
  ];
begin
  foreach signature in array signatures loop
    select pg_get_functiondef(to_regprocedure(signature)) into definition;
    if definition is null then
      raise exception 'V22_CLIENT_DELIVERY_FUNCTION_MISSING: %', signature;
    end if;
    if position('2.2.0' in definition) = 0 then
      raise exception 'V22_CLIENT_DELIVERY_VERSION_GATE_MISSING: %', signature;
    end if;
    execute replace(definition, '2.2.0', '2.2.1');
  end loop;
end;
$$;

alter table public.reports
  add constraint reports_v22_client_delivery_required
  check (
    schema_version <> '2.2.1'
    or (
      report_v2_2 #>> '{report_version,schema_version}' is not distinct from '2.2.1'
      and jsonb_typeof(report_v2_2->'client_delivery') is not distinct from 'object'
      and jsonb_typeof(report_v2_2 #> '{client_delivery,decision}') is not distinct from 'object'
      and jsonb_typeof(report_v2_2 #> '{client_delivery,evidence_cards}') is not distinct from 'array'
      and jsonb_array_length(report_v2_2 #> '{client_delivery,evidence_cards}') between 1 and 3
      and jsonb_typeof(report_v2_2 #> '{client_delivery,priority_actions}') is not distinct from 'array'
      and jsonb_array_length(report_v2_2 #> '{client_delivery,priority_actions}') = 3
      and jsonb_typeof(report_v2_2 #> '{client_delivery,roadmap}') is not distinct from 'array'
      and jsonb_array_length(report_v2_2 #> '{client_delivery,roadmap}') = 3
      and jsonb_typeof(report_v2_2 #> '{client_delivery,coverage_appendix}') is not distinct from 'object'
      and jsonb_typeof(report_v2_2 #> '{client_delivery,next_review_date}') is not distinct from 'string'
    )
  );

comment on constraint reports_v22_client_delivery_required on public.reports is
  'Every v2.2.1 report includes the complete client-safe delivery projection.';

commit;
