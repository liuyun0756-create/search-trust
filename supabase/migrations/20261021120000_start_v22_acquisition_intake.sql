-- Bind an already-paid discovery workflow, scope and preparation atomically.
begin;
create function public.lookup_v22_acquisition_intake(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_job_id uuid,p_idempotency_key text,p_discovery_id uuid,p_analyze_request jsonb,p_previous_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare charge public.workflow_charges; job public.analysis_jobs; prep public.capability_acquisition_preparations;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'CAPABILITY_INTAKE_UNAVAILABLE'; end if;
  select * into charge from public.workflow_charges where id=p_workflow_id;
  if charge.id is null or charge.user_id<>p_user_id or charge.case_id<>p_case_id or charge.workflow_kind<>'prospect'
    or not exists(select 1 from public.prospect_discovery_tasks where discovery_job_id=p_discovery_id and workflow_charge_id=p_workflow_id)
    then raise exception 'CAPABILITY_INTAKE_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id or (case_id=p_case_id and idempotency_key=p_idempotency_key);
  select * into prep from public.capability_acquisition_preparations where job_id=p_job_id;
  if job.id is null and prep.job_id is null then
    if charge.state<>'reserved' or charge.analysis_job_id is not null then raise exception 'CAPABILITY_INTAKE_UNAVAILABLE'; end if;
    return null;
  end if;
  if prep.job_id is null or job.id is distinct from p_job_id or job.case_id<>p_case_id
    or prep.user_id<>p_user_id or prep.case_id<>p_case_id or job.idempotency_key is distinct from p_idempotency_key
    or charge.analysis_job_id is distinct from p_job_id or job.previous_job_id is distinct from p_previous_job_id
    or prep.request->'analyze_request' is distinct from p_analyze_request
    or prep.request#>>'{competitor_discovery,discovery_id}' is distinct from p_discovery_id::text then
    raise exception 'CAPABILITY_INTAKE_CONFLICT' using errcode='40001'; end if;
  -- Full recovery data stays inside the trusted server boundary, never the browser.
  return jsonb_build_object('business_version_id',prep.business_version_id,'request',prep.request,
    'run_generation',job.run_generation,'status',job.status);
end;
$$;

create function public.start_v22_acquisition_intake(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_job_id uuid,p_idempotency_key text,p_discovery_id uuid,p_request_canonical text,p_previous_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare body jsonb; req jsonb; existing jsonb; current_revision integer; scope jsonb; scope_id uuid;
begin
  if p_request_canonical is null or octet_length(p_request_canonical)>150000
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception 'CAPABILITY_INTAKE_INVALID'; end if;
  body=p_request_canonical::jsonb; req=body->'analyze_request';
  if req->>'report_type' is distinct from 'prospect' or req->>'case_id' is distinct from p_case_id::text
    or body#>>'{competitor_discovery,discovery_id}' is distinct from p_discovery_id::text then
    raise exception 'CAPABILITY_INTAKE_INVALID'; end if;
  existing=public.lookup_v22_acquisition_intake(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_discovery_id,req,p_previous_job_id);
  if existing is not null then
    -- Do not accept different discovery checksums on an already enrolled job.
    if existing->'request' is distinct from body then raise exception 'CAPABILITY_INTAKE_CONFLICT' using errcode='40001'; end if;
    return existing;
  end if;
  select coalesce(max(revision),0) into current_revision from public.case_business_scope_versions where case_id=p_case_id;
  scope_id=gen_random_uuid();
  scope=jsonb_build_object('id',scope_id,'user_id',p_user_id,'case_id',p_case_id,'revision',current_revision+1,
    'site_url',req#>>'{business_identity,site_url}','primary_service',req->>'primary_service',
    'target_market',req#>>'{target_market,display_name}','target_pages','[]'::jsonb,
    'competitor_sites',(select jsonb_agg(value->>'website_url' order by ordinal) from jsonb_array_elements(req->'competitors') with ordinality c(value,ordinal)),
    'priority',null,'confirmation_source','seo_confirmation','confirmed_at',now());
  perform public.save_v22_business_scope(p_user_id,p_case_id,current_revision,scope);
  perform public.bind_v22_prospect_analysis(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_previous_job_id);
  perform public.begin_v22_acquisition_preparation(p_user_id,p_case_id,p_job_id,p_idempotency_key,scope_id,p_request_canonical);
  return public.lookup_v22_acquisition_intake(p_user_id,p_case_id,p_workflow_id,p_job_id,p_idempotency_key,p_discovery_id,req,p_previous_job_id);
end;
$$;

create function public.get_v22_acquisition_status(p_user_id uuid,p_job_id uuid)
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
      when exists(select 1 from public.analysis_input_manifests where job_id=p_job_id) then 'Preparing your diagnosis report.'
      when job.status='running' then 'Checking the confirmed website, business and competitor sources.'
      else 'Queued to prepare the confirmed analysis sources.' end,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'updated_at',greatest(job.updated_at,job.heartbeat_at,job.created_at),
    'report',null,'error',case when job.status='failed' then jsonb_build_object('error_code','ANALYSIS_FAILED',
      'user_message','The analysis could not be completed. Check the Case before starting a new analysis.',
      'retryable',false,'stage','failed','diagnostic_id',job.id) else null end);
end;
$$;
revoke all on function public.lookup_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.start_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.get_v22_acquisition_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lookup_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,jsonb,uuid) to service_role;
grant execute on function public.start_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,text,uuid) to service_role;
grant execute on function public.get_v22_acquisition_status(uuid,uuid) to service_role;
commit;
