-- Preserve the enrolled-input path; reuse an earlier service discovery reservation when present.
begin;
create or replace function public.start_v22_first_service_preparation(p_user_id uuid,p_case_id uuid,p_job_id uuid,
  p_idempotency_key text,p_business_version_id uuid,p_gsc_snapshot_id uuid,p_ga4_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cc public.client_cases; job public.analysis_jobs; prep public.capability_first_service_preparations;
  business public.case_business_scope_versions; charge public.workflow_charges;
  discovered uuid[]; locked uuid[]; current_connections uuid[]; refs jsonb='[]'; source text; selected uuid;
  balance integer; replay boolean=false; prepaid boolean=false;
begin
  if p_job_id is null or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,200}$'
    or p_business_version_id is null or p_gsc_snapshot_id is null or p_ga4_snapshot_id is null
    or p_gsc_snapshot_id=p_ga4_snapshot_id then raise exception 'FIRST_SERVICE_INPUT_INVALID'; end if;
  select coalesce(array_agg(distinct b.connection_id order by b.connection_id) filter(where b.connection_id is not null),'{}')
    into discovered from public.case_source_bindings b join public.client_cases c on c.id=b.case_id
    where c.id=p_case_id and c.user_id=p_user_id and b.is_active and b.source_type in ('gsc','ga4');
  perform 1 from public.google_connections where id=any(discovered) and user_id=p_user_id order by id for share;
  select coalesce(array_agg(id order by id),'{}') into locked from public.google_connections where id=any(discovered) and user_id=p_user_id;
  select * into cc from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if cc.id is null then raise exception 'FIRST_SERVICE_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id or (case_id=p_case_id and idempotency_key=p_idempotency_key)
    order by id limit 1 for update;
  select * into prep from public.capability_first_service_preparations where job_id=p_job_id;
  if job.id is not null or prep.job_id is not null then
    select * into charge from public.workflow_charges where analysis_job_id=p_job_id;
    if job.id is distinct from p_job_id or job.case_id is distinct from p_case_id or job.job_type is distinct from 'verified_report'
      or job.idempotency_key is distinct from p_idempotency_key or prep.job_id is null
      or prep.user_id<>p_user_id or prep.case_id<>p_case_id or prep.business_version_id<>p_business_version_id
      or prep.gsc_snapshot_id<>p_gsc_snapshot_id or prep.ga4_snapshot_id<>p_ga4_snapshot_id
      or charge.id is null or charge.user_id<>p_user_id or charge.case_id<>p_case_id or charge.workflow_kind<>'verified'
      or charge.idempotency_key<>p_idempotency_key then
      raise exception 'FIRST_SERVICE_CONFLICT' using errcode='40001'; end if;
    replay=true;
  else
    prepaid=public.check_v22_first_service_discovery_binding(p_user_id,p_case_id,p_job_id,p_idempotency_key,p_business_version_id);
    select coalesce(array_agg(distinct connection_id order by connection_id) filter(where connection_id is not null),'{}')
      into current_connections from public.case_source_bindings where case_id=p_case_id and is_active and source_type in ('gsc','ga4');
    if current_connections is distinct from discovered or current_connections is distinct from locked then
      raise exception 'FIRST_SERVICE_BINDING_CHANGED' using errcode='40001'; end if;
    if cc.latest_report_id is not null
      or exists(select 1 from public.reports where case_id=p_case_id and status='paid_full')
      or exists(select 1 from public.analysis_jobs where case_id=p_case_id and (status in ('queued','running') or capability_report_id is not null))
      or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved' and not(prepaid and id=p_job_id)) then
      raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    select * into business from public.case_business_scope_versions where case_id=p_case_id and user_id=p_user_id order by revision desc limit 1;
    if business.id is distinct from p_business_version_id
      or jsonb_typeof(business.scope->'competitor_sites') is distinct from 'array'
      or jsonb_array_length(business.scope->'competitor_sites') not between 1 and 3
      or coalesce(btrim(cc.business_identity->>'public_gbp_url'),'')=''
      or cc.business_identity->>'site_url' is distinct from business.scope->>'site_url'
      or cc.site_url is distinct from business.scope->>'site_url'
      or cc.primary_service is distinct from business.scope->>'primary_service'
      or cc.target_market->>'display_name' is distinct from business.scope->>'target_market' then
      raise exception 'FIRST_SERVICE_BUSINESS_NOT_READY'; end if;
    foreach source in array array['gsc','ga4'] loop
      selected=case when source='gsc' then p_gsc_snapshot_id else p_ga4_snapshot_id end;
      refs=refs||jsonb_build_array(public.check_v22_first_service_source(p_user_id,p_case_id,selected,source));
      if selected is distinct from (select d.id from public.data_snapshots d join public.case_source_bindings b on b.id=d.binding_id
        where b.case_id=p_case_id and b.is_active and b.source_type=source and d.source_type=source
        order by d.fetched_at desc,d.id desc limit 1) then raise exception 'FIRST_SERVICE_SNAPSHOT_NOT_CURRENT'; end if;
    end loop;
    if not prepaid then
      update public.users set credit_balance=credit_balance-1,updated_at=now()
        where id=p_user_id and credit_balance>=1 returning credit_balance into balance;
      if balance is null then raise exception 'INSUFFICIENT_CREDITS'; end if;
      if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then
        raise exception 'FIRST_SERVICE_WORKFLOW_EXISTS'; end if;
    end if;
    insert into public.analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,deadline_at)
      values(p_job_id,p_case_id,'verified_report','queued','queued',p_idempotency_key,now()+interval '20 minutes') returning * into job;
    if prepaid then
      -- Keep the immutable original ledger entry (which predates the analysis job).
      update public.workflow_charges set analysis_job_id=p_job_id where id=p_job_id and state='reserved' and analysis_job_id is null;
      if not found then raise exception 'FIRST_SERVICE_DISCOVERY_NOT_READY'; end if;
    else
      insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id)
        values(p_job_id,p_user_id,p_case_id,'verified',p_idempotency_key,p_job_id);
      insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
        values(p_user_id,p_case_id,p_job_id,p_job_id,'verified_debit',-1,balance,'workflow:'||p_job_id::text||':debit');
    end if;
    insert into public.capability_first_service_preparations(job_id,user_id,case_id,business_version_id,business_identity,gsc_snapshot_id,ga4_snapshot_id,source_refs)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,cc.business_identity,p_gsc_snapshot_id,p_ga4_snapshot_id,refs) returning * into prep;
  end if;
  select credit_balance into balance from public.users where id=p_user_id;
  return jsonb_build_object('schema_version','v22_first_service_preparation_v1','mode','first_service',
    'user_id',p_user_id,'case_id',p_case_id,'job_id',p_job_id,'idempotency_key',p_idempotency_key,
    'business_version_id',prep.business_version_id,'gsc_snapshot_id',prep.gsc_snapshot_id,'ga4_snapshot_id',prep.ga4_snapshot_id,
    'idempotent',replay,'credit_balance',balance,'status',job.status,'created_at',job.created_at,'deadline_at',job.deadline_at);
end;
$$;
commit;
