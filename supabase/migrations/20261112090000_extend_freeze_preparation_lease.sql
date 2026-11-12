-- Production pg_get_functiondef baseline verified on 2026-11-12.
-- Only freeze-local lease renewal changes; ordinary claim/heartbeat stay at 90s.
-- The extension shares the freeze transaction and rolls back with it. A crash
-- releases row locks without persisting the 200s extension, so takeover retains
-- its existing recovery behavior. On commit the manifest already exists and
-- this preparation lease no longer governs handoff. deadline_at remains a cap.
-- Rollback: run supabase/rollbacks/20261112090000_extend_freeze_preparation_lease.sql
-- to restore the exact exported original definitions (no role/ACL changes).
begin;
do $baseline$
begin
  if not exists(select 1 from pg_proc p where p.oid='public.freeze_v22_acquisition_preparation(uuid,jsonb,jsonb)'::regprocedure
    and md5(p.prosrc) in ('aba7a7d4eeae6b642cb8943e0e64bfa5','d25b28c53540c1635dc6170d6f832f0f')) then
    raise exception 'FREEZE_PREPARATION_BASELINE_CHANGED: acquisition'; end if;
  if not exists(select 1 from pg_proc p where p.oid='public.freeze_v22_first_service_preparation(uuid,jsonb,jsonb)'::regprocedure
    and md5(p.prosrc) in ('7a1544115ed34063ca718f7a57dd6852','3902e478841e81f009a8e0237ef84560')) then
    raise exception 'FREEZE_PREPARATION_BASELINE_CHANGED: first_service'; end if;
end;
$baseline$;

CREATE OR REPLACE FUNCTION public.freeze_v22_acquisition_preparation(p_lease_token uuid, p_cost_counters jsonb, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb; job public.analysis_jobs; prep public.capability_acquisition_preparations;
begin
  select * into prep from public.capability_acquisition_preparations where job_id=(p_input->>'p_job_id')::uuid;
  if prep.job_id is null or prep.user_id::text is distinct from p_input->>'p_user_id'
    or prep.case_id::text is distinct from p_input->>'p_case_id' then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  perform 1 from public.client_cases where id=prep.case_id and user_id=prep.user_id for no key update;
  select * into job from public.analysis_jobs where id=prep.job_id for update;
  if not public.heartbeat_v22_acquisition_preparation(job.id,(p_input->>'p_run_generation')::integer,p_lease_token,p_cost_counters)
    then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  declare lease_rows bigint;
  begin
    update public.capability_acquisition_runs
      set lease_until=least(job.deadline_at,clock_timestamp()+interval '200 seconds')
      where job_id=job.id and lease_token=p_lease_token;
    get diagnostics lease_rows = row_count;
    if lease_rows<>1 then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  end;
  perform set_config('searchtrust.acquisition_lease',p_lease_token::text,true);
  select to_jsonb(t) into result from public.prepare_v22_capability_analysis_input(
    prep.user_id,prep.case_id,job.id,p_input->'p_manifest',p_input->>'p_manifest_canonical',
    p_input->'p_recipe',p_input->>'p_generation_canonical',p_input->'p_public_source_canonicals',
    p_input->>'p_previous_canonical',(p_input->>'p_run_generation')::integer) t;
  -- Formal execution receives these revisions/attempts and the original deadline.
  update public.analysis_jobs set status='queued',current_stage='queued',state_revision=state_revision+1,
    user_message='Sources prepared. Queued for report generation.' where id=job.id;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.freeze_v22_first_service_preparation(p_lease_token uuid, p_cost_counters jsonb, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb; job public.analysis_jobs; prep public.capability_first_service_collections;
begin
  select * into prep from public.capability_first_service_collections where job_id=(p_input->>'p_job_id')::uuid;
  if prep.job_id is null or prep.user_id::text is distinct from p_input->>'p_user_id'
    or prep.case_id::text is distinct from p_input->>'p_case_id' then raise exception 'CAPABILITY_PREPARATION_UNAVAILABLE'; end if;
  perform 1 from public.client_cases where id=prep.case_id and user_id=prep.user_id for no key update;
  select * into job from public.analysis_jobs where id=prep.job_id for update;
  if not public.heartbeat_v22_first_service_preparation(job.id,(p_input->>'p_run_generation')::integer,p_lease_token,p_cost_counters)
    then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  declare lease_rows bigint;
  begin
    update public.capability_first_service_runs
      set lease_until=least(job.deadline_at,clock_timestamp()+interval '200 seconds')
      where job_id=job.id and lease_token=p_lease_token;
    get diagnostics lease_rows = row_count;
    if lease_rows<>1 then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  end;
  perform set_config('searchtrust.first_service_lease',p_lease_token::text,true);
  select to_jsonb(t) into result from public.prepare_v22_capability_analysis_input(
    prep.user_id,prep.case_id,job.id,p_input->'p_manifest',p_input->>'p_manifest_canonical',
    p_input->'p_recipe',p_input->>'p_generation_canonical',p_input->'p_public_source_canonicals',
    p_input->>'p_previous_canonical',(p_input->>'p_run_generation')::integer) t;
  -- Formal execution receives these revisions/attempts and the original deadline.
  update public.analysis_jobs set status='queued',current_stage='queued',state_revision=state_revision+1,
    user_message='Sources prepared. Queued for report generation.' where id=job.id;
  return result;
end;
$function$;

commit;
