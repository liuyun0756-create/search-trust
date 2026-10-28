begin;

-- SQL owns logical lifecycle. ARQ only wakes this durable work; no source bodies
-- or credits live in Redis. The immutable request/input remain separate from leases.
create table public.capability_review_generation_requests (
  job_id uuid primary key references public.capability_review_generation_inputs(job_id),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  review_id uuid not null references public.capability_review_evidence_bundles(id),
  decision_id uuid not null references public.capability_review_decision_revisions(id),
  command jsonb not null check(octet_length(command::text)<=4096)
);
create table public.capability_review_generation_work (
  job_id uuid primary key references public.capability_review_generation_requests(job_id),
  dispatch_token uuid,
  dispatch_until timestamptz,
  run_token uuid,
  run_until timestamptz
);
alter table public.capability_review_generation_requests enable row level security;
alter table public.capability_review_generation_work enable row level security;
revoke all on public.capability_review_generation_requests,public.capability_review_generation_work from public,anon,authenticated,service_role;
create trigger immutable_review_generation_request before update or delete on public.capability_review_generation_requests
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_review_start_command(p_text text) returns jsonb
language plpgsql immutable set search_path=public as $$
declare c jsonb; k text;
begin
  if p_text is null or octet_length(p_text)>4096 or not public.v22_review_unique_json(p_text::json)
    then raise exception 'REVIEW_START_INVALID'; end if;
  c=p_text::jsonb;
  if public.v22_page_keys(c,array['job_id','review_id','review_checksum','decision_id','decision_checksum']) is not true
    then raise exception 'REVIEW_START_INVALID'; end if;
  foreach k in array array['job_id','review_id','decision_id'] loop
    if jsonb_typeof(c->k) is distinct from 'string' or c->>k is distinct from ((c->>k)::uuid)::text
      then raise exception 'REVIEW_START_INVALID'; end if;
  end loop;
  foreach k in array array['review_checksum','decision_checksum'] loop
    if jsonb_typeof(c->k) is distinct from 'string' or c->>k !~ '^sha256:[a-f0-9]{64}$'
      then raise exception 'REVIEW_START_INVALID'; end if;
  end loop;
  return c;
exception when invalid_text_representation then raise exception 'REVIEW_START_INVALID';
end; $$;

create function public.get_v22_review_generation_status(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; s public.capability_review_generation_requests; i public.capability_review_generation_inputs; charge public.workflow_charges;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  select * into s from public.capability_review_generation_requests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id and report_id=p_report_id;
  if s.job_id is null then return null; end if;
  select * into j from public.analysis_jobs where id=s.job_id;
  select * into i from public.capability_review_generation_inputs where job_id=s.job_id;
  select * into charge from public.workflow_charges where analysis_job_id=s.job_id;
  if j.id is null or i.job_id is null or charge.id is null or (charge.user_id,charge.case_id) is distinct from (p_user_id,p_case_id)
    or charge.workflow_kind<>'verified' or charge.idempotency_key is distinct from j.idempotency_key
    or (j.status='succeeded' and (j.capability_report_id is distinct from j.id or charge.state<>'consumed'))
    or (j.status='failed' and charge.state<>'compensated')
    or (j.status in ('queued','running') and charge.state<>'reserved') then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  return jsonb_build_object('schema_version','v22_review_job_v1','job_id',j.id,'user_id',p_user_id,'case_id',p_case_id,'base_report_id',p_report_id,
    'selection',s.command,'input_checksum',i.input_checksum,'revision',j.state_revision,'run_generation',j.run_generation,'status',j.status,
    'created_at',public.v22_page_time(j.created_at),'deadline_at',public.v22_page_time(j.deadline_at),'updated_at',public.v22_page_time(j.updated_at),
    'report_id',j.capability_report_id,'credit_state',charge.state,'error_code',case when j.status='failed' then 'TECHNICAL_FAILURE' else null end);
end; $$;

create function public.find_v22_review_generation(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_review_id uuid,p_decision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  select q.job_id into j from public.capability_review_generation_requests q join public.analysis_jobs a on a.id=q.job_id
    where q.user_id=p_user_id and q.case_id=p_case_id and q.report_id=p_report_id and q.review_id=p_review_id and q.decision_id=p_decision_id
    order by a.created_at desc,a.id desc limit 1;
  if j is null then return null; end if;
  return public.get_v22_review_generation_status(p_user_id,p_case_id,p_report_id,j);
end; $$;

create function public.lookup_v22_review_generation(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_command_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c jsonb; s public.capability_review_generation_requests;
begin
  c=public.v22_review_start_command(p_command_text);
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active';
  if not found then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  select * into s from public.capability_review_generation_requests where job_id=(c->>'job_id')::uuid;
  if s.job_id is null then return null; end if;
  if (s.user_id,s.case_id,s.report_id) is distinct from (p_user_id,p_case_id,p_report_id) or s.command is distinct from c
    then raise exception 'REVIEW_START_CONFLICT' using errcode='40001'; end if;
  return public.get_v22_review_generation_status(p_user_id,p_case_id,p_report_id,s.job_id);
end; $$;

create function public.start_v22_review_generation(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_command_text text,p_input_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c jsonb; existing jsonb; r jsonb; j uuid; balance integer; base public.capability_report_versions; input jsonb;
begin
  c=public.v22_review_start_command(p_command_text);j=(c->>'job_id')::uuid;
  -- Serialize all review intakes in a Case, including identical requests.
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  existing=public.lookup_v22_review_generation(p_user_id,p_case_id,p_report_id,p_command_text);
  if existing is not null then return existing; end if;
  if exists(select 1 from public.analysis_jobs where id=j)
    or exists(select 1 from public.capability_review_generation_requests q join public.analysis_jobs a on a.id=q.job_id
      where q.case_id=p_case_id and q.review_id=(c->>'review_id')::uuid and q.decision_id=(c->>'decision_id')::uuid and a.status<>'failed')
    then raise exception 'REVIEW_START_CONFLICT' using errcode='40001'; end if;
  select * into base from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id
    and payload->>'report_type'='verified_execution' and schema_version='2.2.2';
  if base.id is null then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  if exists(select 1 from public.capability_report_versions where case_id=p_case_id and payload->>'report_type'='verified_execution'
    and (payload->>'version')::integer>(base.payload->>'version')::integer) then raise exception 'REVIEW_START_STALE'; end if;
  r=public.v22_review_generation_recipe(p_user_id,p_case_id,j,p_input_text);
  if r->'report_id' is distinct from to_jsonb(p_report_id::text)
    or r->'review_id' is distinct from c->'review_id' or r->'review_checksum' is distinct from c->'review_checksum'
    or r->'decision_id' is distinct from c->'decision_id' or r->'decision_checksum' is distinct from c->'decision_checksum'
    then raise exception 'REVIEW_START_INVALID'; end if;
  if exists(select 1 from public.analysis_jobs where case_id=p_case_id and status in ('queued','running'))
    or exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then raise exception 'REVIEW_START_BUSY'; end if;
  update public.users set credit_balance=credit_balance-1,updated_at=now() where id=p_user_id and credit_balance>=1 returning credit_balance into balance;
  if balance is null then raise exception 'REVIEW_START_INSUFFICIENT_CREDITS'; end if;
  if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved') then raise exception 'REVIEW_START_BUSY'; end if;
  insert into public.analysis_jobs(id,case_id,job_type,status,current_stage,state_revision,idempotency_key,deadline_at)
    values(j,p_case_id,'verified_report','queued','queued',1,'review:'||j::text,clock_timestamp()+interval '20 minutes');
  insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id)
    values(j,p_user_id,p_case_id,'verified','review:'||j::text,j);
  insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
    values(p_user_id,p_case_id,j,j,'verified_debit',-1,balance,'workflow:'||j::text||':debit');
  input=public.freeze_v22_review_generation_input(p_user_id,p_case_id,j,1,p_input_text);
  insert into public.capability_review_generation_requests(job_id,user_id,case_id,report_id,review_id,decision_id,command)
    values(j,p_user_id,p_case_id,p_report_id,(c->>'review_id')::uuid,(c->>'decision_id')::uuid,c);
  insert into public.capability_review_generation_work(job_id) values(j);
  return public.get_v22_review_generation_status(p_user_id,p_case_id,p_report_id,j);
end; $$;

create function public.guard_v22_review_parallel_charge() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.capability_review_generation_requests r join public.workflow_charges c on c.analysis_job_id=r.job_id
    where r.case_id=new.case_id and c.state='reserved') then raise exception 'REVIEW_START_BUSY'; end if;
  return new;
end; $$;
create trigger guard_review_parallel_charge before insert on public.workflow_charges for each row execute function public.guard_v22_review_parallel_charge();

-- Terminal outcome is always SQL-first. A lost completion acknowledgement must
-- return success, never compensate a report that has already been delivered.
create function public.finalize_v22_review_generation(p_job_id uuid,p_run_generation integer,p_run_token uuid,p_fail boolean)
returns text language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; w public.capability_review_generation_work;
begin
  if p_fail is null then raise exception 'REVIEW_START_INVALID'; end if;
  select * into j from public.analysis_jobs where id=p_job_id for update;
  select * into w from public.capability_review_generation_work where job_id=p_job_id;
  if w.job_id is null or j.id is null then raise exception 'REVIEW_START_UNAVAILABLE'; end if;
  if j.status in ('succeeded','failed') then return j.status; end if;
  if p_run_generation is distinct from j.run_generation or p_run_token is distinct from w.run_token
    then return 'inactive'; end if;
  if p_fail then
    update public.analysis_jobs set status='failed',current_stage='failed',completed_at=clock_timestamp(),
      error_code='REVIEW_TECHNICAL_FAILURE',user_message='The review could not be completed. The reserved credit has been returned.',
      state_revision=state_revision+1 where id=j.id;
    return 'failed';
  end if;
  update public.capability_review_generation_work set run_until=null,dispatch_until=null where job_id=j.id;
  update public.analysis_jobs set status='queued',current_stage='queued',state_revision=state_revision+1 where id=j.id;
  return 'queued';
end; $$;

create function public.pending_v22_review_generations() returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; w public.capability_review_generation_work; result jsonb='[]';
begin
  -- Bound each cron batch. Archived Cases are not executable but still settle.
  for j in select a.* from public.analysis_jobs a join public.capability_review_generation_work q on q.job_id=a.id
    where a.status in ('queued','running') and (a.deadline_at<=clock_timestamp() or a.attempt_count>=3
      or not exists(select 1 from public.client_cases c where c.id=a.case_id and c.status='active')
      or (coalesce(q.run_until,'-infinity')<=clock_timestamp() and coalesce(q.dispatch_until,'-infinity')<=clock_timestamp()))
    order by a.created_at,a.id limit 50 for update of a skip locked loop
    select * into w from public.capability_review_generation_work where job_id=j.id;
    if j.deadline_at<=clock_timestamp() or not exists(select 1 from public.client_cases where id=j.case_id and status='active')
      or (j.attempt_count>=3 and coalesce(w.run_until,'-infinity')<=clock_timestamp()) then
      perform public.finalize_v22_review_generation(j.id,j.run_generation,w.run_token,true);
    elsif coalesce(w.run_until,'-infinity')<=clock_timestamp() and coalesce(w.dispatch_until,'-infinity')<=clock_timestamp() then
      result=result||jsonb_build_array(j.id);
    end if;
  end loop;
  return result;
end; $$;

create function public.claim_v22_review_dispatch(p_job_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; w public.capability_review_generation_work;
begin
  if p_token is null then raise exception 'REVIEW_START_INVALID'; end if;
  select * into j from public.analysis_jobs where id=p_job_id for update;
  select * into w from public.capability_review_generation_work where job_id=p_job_id;
  if w.job_id is null or j.status not in ('queued','running') or j.deadline_at<=clock_timestamp() or j.attempt_count>=3
    or coalesce(w.run_until,'-infinity')>clock_timestamp() or coalesce(w.dispatch_until,'-infinity')>clock_timestamp()
    or not exists(select 1 from public.client_cases where id=j.case_id and status='active') then return false; end if;
  update public.capability_review_generation_work set dispatch_token=p_token,dispatch_until=least(j.deadline_at,clock_timestamp()+interval '60 seconds') where job_id=p_job_id;
  return true;
end; $$;

create function public.claim_v22_review_run(p_job_id uuid,p_dispatch_token uuid,p_run_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; w public.capability_review_generation_work; i public.capability_review_generation_inputs;
begin
  if p_dispatch_token is null or p_run_token is null then raise exception 'REVIEW_START_INVALID'; end if;
  select * into j from public.analysis_jobs where id=p_job_id for update;
  select * into w from public.capability_review_generation_work where job_id=p_job_id;
  if w.job_id is null or j.status not in ('queued','running') or j.deadline_at<=clock_timestamp() or j.attempt_count>=3
    or w.dispatch_token is distinct from p_dispatch_token or w.dispatch_until is null or w.dispatch_until<=clock_timestamp()
    or coalesce(w.run_until,'-infinity')>clock_timestamp()
    or not exists(select 1 from public.client_cases where id=j.case_id and status='active') then return null; end if;
  update public.analysis_jobs set run_generation=run_generation+1,attempt_count=attempt_count+1,
    status='running',current_stage='generating_report',progress=20,state_revision=state_revision+1,
    started_at=coalesce(started_at,clock_timestamp()),heartbeat_at=clock_timestamp() where id=j.id returning * into j;
  perform public.v22_review_generation_job((select user_id from public.capability_review_generation_requests where job_id=j.id),j.case_id,j.id,j.run_generation);
  update public.capability_review_generation_work set run_token=p_run_token,run_until=least(j.deadline_at,clock_timestamp()+interval '90 seconds'),dispatch_until=null where job_id=j.id;
  select * into i from public.capability_review_generation_inputs where job_id=j.id;
  return jsonb_build_object('job_id',j.id,'user_id',i.user_id,'case_id',j.case_id,'run_generation',j.run_generation,
    'input_checksum',i.input_checksum,'deadline_at',public.v22_page_time(j.deadline_at));
end; $$;

create function public.heartbeat_v22_review_generation(p_job_id uuid,p_run_generation integer,p_run_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; w public.capability_review_generation_work;
begin
  select * into j from public.analysis_jobs where id=p_job_id for update;
  select * into w from public.capability_review_generation_work where job_id=p_job_id;
  if w.job_id is null or j.status<>'running' or j.deadline_at<=clock_timestamp() or j.run_generation is distinct from p_run_generation
    or p_run_token is null or w.run_token is distinct from p_run_token or w.run_until is null or w.run_until<=clock_timestamp()
    or not exists(select 1 from public.client_cases where id=j.case_id and status='active') then return false; end if;
  update public.capability_review_generation_work set run_until=least(j.deadline_at,clock_timestamp()+interval '90 seconds') where job_id=j.id;
  update public.analysis_jobs set heartbeat_at=clock_timestamp(),state_revision=state_revision+1 where id=j.id;
  return true;
end; $$;

revoke all on function public.v22_review_start_command(text),public.guard_v22_review_parallel_charge(),
  public.find_v22_review_generation(uuid,uuid,uuid,uuid,uuid),public.get_v22_review_generation_status(uuid,uuid,uuid,uuid),public.lookup_v22_review_generation(uuid,uuid,uuid,text),
  public.start_v22_review_generation(uuid,uuid,uuid,text,text),public.finalize_v22_review_generation(uuid,integer,uuid,boolean),
  public.pending_v22_review_generations(),public.claim_v22_review_dispatch(uuid,uuid),public.claim_v22_review_run(uuid,uuid,uuid),
  public.heartbeat_v22_review_generation(uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.find_v22_review_generation(uuid,uuid,uuid,uuid,uuid),public.get_v22_review_generation_status(uuid,uuid,uuid,uuid),public.lookup_v22_review_generation(uuid,uuid,uuid,text),
  public.start_v22_review_generation(uuid,uuid,uuid,text,text),public.finalize_v22_review_generation(uuid,integer,uuid,boolean),
  public.pending_v22_review_generations(),public.claim_v22_review_dispatch(uuid,uuid),public.claim_v22_review_run(uuid,uuid,uuid),
  public.heartbeat_v22_review_generation(uuid,integer,uuid) to service_role;
commit;
