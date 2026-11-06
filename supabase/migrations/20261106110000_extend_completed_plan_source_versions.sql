-- Extend only the capability-report branch; preserve review projection and access.
begin;
do $migration$
declare definition text; previous text;
begin
  select pg_get_functiondef('public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure) into strict definition;
  previous := $old$if r.schema_version='2.2.2' then$old$;
  if position(previous in definition)=0 then raise exception 'COMPLETED_PLAN_SOURCE_VERSION_TARGET_MISSING'; end if;
  execute replace(definition,previous,$new$if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8') then$new$);
end $migration$;
commit;
