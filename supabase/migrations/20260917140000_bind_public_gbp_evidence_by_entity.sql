-- Bind Prospect GBP evidence to the observed provider record by a matching
-- strong entity key. The provider may legitimately omit a Maps URL, so the
-- evidence locator must preserve that absence instead of inventing the
-- customer-confirmed URL.
begin;

do $migration$
declare
  definition text;
  previous_predicate constant text :=
    'and e #>> ''{source_locator,url}''=p_public_gbp_reference->>''public_gbp_url''';
  entity_bound_predicate constant text :=
    'and e #>> ''{source_locator,url}'' is not distinct from p_public_gbp_payload #>> ''{record,observed_public_gbp_url}''
            and exists (
              select 1
              from jsonb_array_elements(p_public_gbp_reference->''entity_keys'') expected_key
              join jsonb_array_elements(
                p_public_gbp_payload #> ''{record,observed_entity_keys}''
              ) observed_key
                on observed_key->>''kind'' = expected_key->>''kind''
               and observed_key->>''value'' = expected_key->>''value''
              where e #>> ''{source_locator,external_resource_id}'' =
                concat(expected_key->>''kind'', '':'', expected_key->>''value'')
            )';
begin
  select pg_get_functiondef(
    'public.persist_v22_prospect_result(uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb)'::regprocedure
  ) into definition;

  if position(previous_predicate in definition) = 0 then
    raise exception 'expected Prospect GBP URL predicate was not found';
  end if;

  execute replace(definition, previous_predicate, entity_bound_predicate);
end;
$migration$;

comment on function public.persist_v22_prospect_result(
  uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,
  uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb
) is 'Persists a Prospect report whose public GBP evidence is bound to the provider-observed URL and a customer-confirmed strong entity key.';

commit;
