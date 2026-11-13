-- A stale caller-supplied planning revision cannot be fixed by retrying the same
-- RPC transaction. PostgREST 14 retries SQLSTATE 40001 internally without a
-- bound, so preserve the conflict message but use the ordinary P0001 exception.
-- Only this function changes. ACLs, reservation/debit logic and other conflicts
-- remain untouched. Rollback: restore the captured pre-migration definition.
begin;
do $migration$
declare definition text; source text; previous text;
begin
  select pg_get_functiondef(oid),prosrc into strict definition,source
    from pg_proc where oid='public.start_v22_prospect_discovery_with_keywords(uuid,uuid,uuid,uuid,text,text,integer,text,jsonb)'::regprocedure;
  if md5(source) is distinct from '4888849736c04473d5277757a0794dcd'
    or md5(definition) is distinct from '8e5f39ef6284fdd5406a1b6d29b559a5' then
    raise exception 'KEYWORD_CONFLICT_BASELINE_MISMATCH';
  end if;
  previous := $old$raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'$old$;
  if position(previous in definition)=0
    or length(definition)-length(replace(definition,previous,''))<>length(previous) then
    raise exception 'KEYWORD_CONFLICT_TARGET_MISSING';
  end if;
  execute replace(definition,previous,$new$raise exception 'PLANNING_SETTINGS_CONFLICT'$new$);
end;
$migration$;
commit;
