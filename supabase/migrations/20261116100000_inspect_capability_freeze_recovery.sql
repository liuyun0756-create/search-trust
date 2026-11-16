-- Small read-only recovery probe. No payloads, row locks, lease renewals or
-- business writes. Existing claim/freeze/failure fences remain authoritative.
begin;
create function public.inspect_v22_capability_preparation(
  p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer,
  p_lease_token uuid,p_kind text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare job public.analysis_jobs; owned boolean=false;
begin
  select j.* into job from public.analysis_jobs j
    join public.client_cases c on c.id=j.case_id and c.user_id=p_user_id
    where j.id=p_job_id and j.case_id=p_case_id and j.run_generation=p_run_generation;
  if not found then return null; end if;
  if p_kind='acquisition' then
    if not exists(select 1 from public.capability_acquisition_preparations
      where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id) then return null; end if;
    select coalesce(bool_or(lease_token=p_lease_token and lease_until>clock_timestamp()),false) into owned
      from public.capability_acquisition_runs where job_id=p_job_id and run_generation=p_run_generation;
  elsif p_kind='first_service' then
    if not exists(select 1 from public.capability_first_service_collections
      where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id) then return null; end if;
    select coalesce(bool_or(lease_token=p_lease_token and lease_until>clock_timestamp()),false) into owned
      from public.capability_first_service_runs where job_id=p_job_id and run_generation=p_run_generation;
  else return null;
  end if;
  return jsonb_build_object('job_id',job.id,'run_generation',job.run_generation,
    'status',job.status,'revision',greatest(job.state_revision,1),'progress',job.progress,
    'lease_owned',owned,'database_started_at',pg_postmaster_start_time(),
    'manifest_exists',exists(select 1 from public.analysis_input_manifests where job_id=p_job_id));
end;
$$;
revoke all on function public.inspect_v22_capability_preparation(uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.inspect_v22_capability_preparation(uuid,uuid,uuid,integer,uuid,text) to service_role;
-- Rollback: DROP FUNCTION public.inspect_v22_capability_preparation(uuid,uuid,uuid,integer,uuid,text);
commit;
