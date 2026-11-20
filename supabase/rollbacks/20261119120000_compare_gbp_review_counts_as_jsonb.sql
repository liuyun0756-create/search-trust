-- Restores the pre-fix validation only. Existing reports and snapshots stay intact.
-- Restoring this definition will reject decimal-form counts in new reports again.
begin;

do $migration$
declare
  target oid := 'public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
  definition text;
  original_acl aclitem[];
  previous text := $old$if item->'value' is distinct from to_jsonb(case when n=0 and (profile->>'review_count')::integer=0 then 0 else count90 end)$old$;
  replacement text := $new$if (item->>'value')::integer is distinct from (case when n=0 and (profile->>'review_count')::integer=0 then 0 else count90 end)$new$;
begin
  select pg_get_functiondef(oid), proacl into strict definition, original_acl
  from pg_proc where oid=target;
  if (select md5(prosrc) from pg_proc where oid=target) is distinct from 'fbb49257bd7342006707fbb41737f4b2'
    or md5(definition) is distinct from '49f1317c82b800f3135b79a98e48263a' then
    raise exception 'GBP_REVIEW_COUNT_ROLLBACK_BASELINE_MISMATCH';
  end if;
  if position(previous in definition)=0 then raise exception 'GBP_REVIEW_COUNT_ROLLBACK_TARGET_MISSING'; end if;
  execute replace(definition,previous,replacement);
  if not exists (
    select 1 from pg_proc where oid=target and proacl is not distinct from original_acl
      and md5(prosrc)='e183e708caa775a59fe745a5ee9266ec'
      and md5(pg_get_functiondef(oid))='9d9711583b39ddeebf6198cb81ad742a'
  ) then raise exception 'GBP_REVIEW_COUNT_ROLLBACK_RESULT_MISMATCH'; end if;
end $migration$;

commit;
