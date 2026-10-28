-- Authorizes dispatch of an already prepared, reserved task. Never debits.
begin;

create function public.get_v22_capability_dispatch(
  p_user_id uuid, p_case_id uuid, p_job_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  job public.analysis_jobs;
  m public.analysis_input_manifests;
  r public.capability_report_versions;
  envelope jsonb;
  completion jsonb := null;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for share;
  select * into m from public.analysis_input_manifests
    where job_id=p_job_id and case_id=p_case_id and user_id=p_user_id;
  if job.id is null or m.id is null or job.idempotency_key is distinct from p_idempotency_key
    or job.status not in ('queued','running','succeeded')
    or job.report_id is not null or m.payload->>'mode'='review'
    or job.job_type is distinct from (case when m.payload->>'mode'='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE';
  end if;
  envelope := jsonb_build_object(
    'schema_version','v22_capability_request_envelope_v1',
    'capability_request',jsonb_build_object('case_id',p_case_id,'manifest_id',m.id,
      'input_checksum',m.input_checksum,'report_type',
      case when m.payload->>'mode'='acquisition' then 'prospect' else 'verified_execution' end));
  if job.status='succeeded' then
    select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_job_id);
    if r.id is null then raise exception 'CAPABILITY_DISPATCH_UNAVAILABLE'; end if;
    completion := jsonb_build_object(
      'schema_version','v22_capability_task_status_v1','job_id',job.id,
      'revision',greatest(job.state_revision,1),'run_generation',job.run_generation,
      'status','succeeded','stage','completed','progress',100,'message','Analysis complete.',
      'report_reference',jsonb_build_object('report_id',r.id,'case_id',p_case_id,
        'schema_version','2.2.2','report_type',r.payload->>'report_type','payload_checksum',r.payload_checksum),
      'created_at',job.created_at,'deadline_at',job.deadline_at,'updated_at',job.completed_at);
  else
    if job.deadline_at<=now() then raise exception 'CAPABILITY_DISPATCH_EXPIRED'; end if;
    -- Reuse the authoritative source/charge/recipe gate without returning bodies.
    perform public.resolve_v22_capability_analysis_input(job.id,p_case_id,m.id,m.input_checksum,job.run_generation);
  end if;
  return jsonb_build_object(
    'schema_version','v22_capability_dispatch_v1','user_id',p_user_id,'job_id',job.id,
    'case_id',p_case_id,'idempotency_key',job.idempotency_key,'request',envelope,
    'run_generation',job.run_generation,'status',job.status,
    'revision',greatest(job.state_revision,1),'attempt_count',job.attempt_count,
    'cost_counters',job.cost_counters,
    'created_at',job.created_at,'deadline_at',job.deadline_at,'completion',completion);
end;
$$;
revoke all on function public.get_v22_capability_dispatch(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_v22_capability_dispatch(uuid,uuid,uuid,text) to service_role;

-- Database-owned deadline also covers dispatch failures before Redis registration.
-- Successful settlement and failure compete under the same job row lock.
create function public.expire_v22_prepared_capability_jobs(p_limit integer default 100)
returns table(job_id uuid)
language plpgsql security definer set search_path=public as $$
declare job public.analysis_jobs; m public.analysis_input_manifests;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'CAPABILITY_EXPIRY_INVALID'; end if;
  for job in
    select j.* from public.analysis_jobs j
    where j.status in ('queued','running') and j.deadline_at<=now()
      and j.report_id is null and j.capability_report_id is null
      and exists (select 1 from public.analysis_input_manifests i where i.job_id=j.id)
    order by j.deadline_at,j.id limit p_limit for update of j skip locked
  loop
    select * into m from public.analysis_input_manifests where analysis_input_manifests.job_id=job.id;
    -- No worker may ever have run, so preserve an honest attempt_count of zero.
    -- The row lock and completion guard protect an already delivered result.
    perform public.apply_analysis_job_event(job.id,job.case_id,job.state_revision+1,'failed','failed',
      job.progress,job.attempt_count,'JOB_DEADLINE_EXCEEDED',
      'The analysis could not finish within its processing deadline.',
      job.cost_counters,job.heartbeat_at,now(),job.run_generation,job.deadline_at);
    if not exists(select 1 from public.workflow_charges c where c.analysis_job_id=job.id
      and c.case_id=job.case_id and c.user_id=m.user_id and c.state='compensated') then
      raise exception 'CAPABILITY_SETTLEMENT_INVALID';
    end if;
    return query select job.id;
  end loop;
end;
$$;
revoke all on function public.expire_v22_prepared_capability_jobs(integer) from public,anon,authenticated;
grant execute on function public.expire_v22_prepared_capability_jobs(integer) to service_role;

commit;
