begin;
-- Milestones only. This function does not charge, generate, extend deadlines or alter reports.
create function public.advance_v22_acquisition_stage(p_job_id uuid,p_run_generation integer,
  p_lease_token uuid,p_stage text)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; run public.capability_acquisition_runs;
begin
  if p_job_id is null or p_run_generation is null or p_lease_token is null or p_stage is null
    or p_stage not in ('collecting_market','collecting_site','collecting_competitors','building_evidence') then return false; end if;
  select * into job from public.analysis_jobs where id=p_job_id for update;
  select * into run from public.capability_acquisition_runs where job_id=p_job_id;
  if job.id is null or job.run_generation<>p_run_generation or job.status<>'running'
    or job.deadline_at<=clock_timestamp() or run.lease_token is distinct from p_lease_token
    or run.run_generation<>p_run_generation or run.lease_until<=clock_timestamp()
    or exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then return false; end if;
  if job.current_stage is distinct from p_stage then
    update public.analysis_jobs set current_stage=p_stage,state_revision=state_revision+1,
      updated_at=clock_timestamp() where id=p_job_id;
  end if;
  return true;
end;
$$;
revoke all on function public.advance_v22_acquisition_stage(uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.advance_v22_acquisition_stage(uuid,integer,uuid,text) to service_role;

create or replace function public.get_v22_acquisition_status(p_user_id uuid,p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; prep public.capability_acquisition_preparations; dispatch jsonb;
begin
  select p.* into prep from public.capability_acquisition_preparations p
    join public.client_cases c on c.id=p.case_id and c.user_id=p.user_id
    where p.job_id=p_job_id and p.user_id=p_user_id;
  if prep.job_id is null then return null; end if;
  select * into job from public.analysis_jobs where id=p_job_id;
  if job.status='succeeded' then
    dispatch=public.get_v22_capability_dispatch(p_user_id,prep.case_id,p_job_id,job.idempotency_key);
    return dispatch->'completion';
  end if;
  return jsonb_build_object('job_id',job.id,'revision',greatest(job.state_revision,1),'run_generation',job.run_generation,
    'status',job.status,'stage',job.current_stage,'progress',job.progress,'message',
    case when job.status='failed' then 'The analysis could not be completed. Check the Case before starting a new analysis.'
      when job.current_stage='collecting_market' then 'Checking the saved search context and source validity.'
      when job.current_stage='collecting_site' then 'Checking website pages and the public business profile.'
      when job.current_stage='collecting_competitors' then 'Collecting the confirmed competitors'' public evidence.'
      when job.current_stage='building_evidence' then 'Organising saved sources for the diagnosis.'
      when job.current_stage='evaluating' then 'Evaluating the evidence and supported actions.'
      when job.current_stage='validating' then 'Validating the report and its source references.'
      when job.current_stage='persisting' then 'Saving the validated report.'
      when exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then 'Preparing your diagnosis report.'
      when job.status='running' then 'Checking the confirmed website, business and competitor sources.'
      else 'Queued to prepare the confirmed analysis sources.' end,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'updated_at',greatest(job.updated_at,job.heartbeat_at,job.created_at),
    'report',null,'error',case when job.status='failed' then jsonb_build_object('error_code','ANALYSIS_FAILED',
      'user_message','The analysis could not be completed. Check the Case before starting a new analysis.',
      'retryable',false,'stage','failed','diagnostic_id',job.id) else null end);
end;
$$;

commit;
