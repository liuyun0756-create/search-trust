begin;

-- Internal binding only. This migration neither starts jobs nor debits credits.
create table public.capability_review_generation_inputs (
  job_id uuid primary key references public.analysis_jobs(id),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  review_id uuid not null references public.capability_review_evidence_bundles(id),
  decision_id uuid not null references public.capability_review_decision_revisions(id),
  input_text text not null check(octet_length(input_text)<=2300000),
  input_checksum text not null check(input_checksum ~ '^sha256:[a-f0-9]{64}$'),
  recipe jsonb not null check(octet_length(recipe::text)<=4096),
  frozen_at timestamptz not null default clock_timestamp()
);
alter table public.capability_review_generation_inputs enable row level security;
revoke all on public.capability_review_generation_inputs from public,anon,authenticated,service_role;
create trigger immutable_review_generation_input before update or delete on public.capability_review_generation_inputs
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_review_generation_job(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer)
returns void language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; c public.workflow_charges;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'REVIEW_GENERATION_UNAVAILABLE'; end if;
  select * into j from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if j.id is null then raise exception 'REVIEW_GENERATION_UNAVAILABLE'; end if;
  if p_run_generation is null or p_run_generation<1 or j.run_generation is distinct from p_run_generation
    or j.status not in ('queued','running') or j.deadline_at<=clock_timestamp()
    then raise exception 'REVIEW_GENERATION_INACTIVE'; end if;
  if j.job_type<>'verified_report' or j.report_id is not null or j.capability_report_id is not null
    or exists(select 1 from public.analysis_input_manifests where job_id=j.id)
    or exists(select 1 from public.verified_analysis_inputs where job_id=j.id)
    or exists(select 1 from public.capability_acquisition_preparations where job_id=j.id)
    or exists(select 1 from public.capability_first_service_preparations where job_id=j.id)
    or exists(select 1 from public.analysis_attempt_charges where job_id=j.id)
    or exists(select 1 from public.reports where id=j.id)
    or exists(select 1 from public.capability_report_versions where id=j.id)
    then raise exception 'REVIEW_GENERATION_CONFLICT'; end if;
  select * into c from public.workflow_charges where analysis_job_id=j.id for update;
  if c.id is null or (c.user_id,c.case_id) is distinct from (p_user_id,p_case_id)
    or c.workflow_kind<>'verified' or c.state<>'reserved' or c.idempotency_key is distinct from j.idempotency_key
    or (select count(*) from public.credit_ledger l where l.workflow_charge_id=c.id and l.user_id=p_user_id
      and l.case_id=p_case_id and l.analysis_job_id=j.id and l.delta=-1 and l.kind='verified_debit')<>1
    or exists(select 1 from public.credit_ledger where workflow_charge_id=c.id and kind='technical_failure_credit')
    then raise exception 'REVIEW_GENERATION_NOT_RESERVED'; end if;
end; $$;

-- Return the recipe only after independently matching the selected saved graph.
create function public.v22_review_generation_recipe(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_input_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; b jsonb; d jsonb; report_id uuid; review_id uuid; decision_id uuid; at_time timestamptz;
begin
  if p_input_text is null then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  if octet_length(p_input_text)>2300000 then raise exception 'REVIEW_GENERATION_TOO_LARGE'; end if;
  if not public.v22_review_unique_json(p_input_text::json) then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  v=p_input_text::jsonb;
  if public.v22_page_keys(v,array['schema_version','rules_version','job_id','user_id','case_id','report_id','prepared_at','evidence','decision','checksum']) is not true
    or v->>'schema_version' is distinct from 'v22_review_generation_input_v1'
    or v->>'rules_version' is distinct from 'v22_review_generation_rules_v1'
    or v->>'job_id' is distinct from p_job_id::text or v->>'user_id' is distinct from p_user_id::text
    or v->>'case_id' is distinct from p_case_id::text
    or v->>'checksum' is distinct from public.v22_review_hash(v-'checksum')
    then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  report_id=(v->>'report_id')::uuid; review_id=(v#>>'{evidence,id}')::uuid; decision_id=(v#>>'{decision,id}')::uuid;
  if report_id is null or review_id is null or decision_id is null or report_id=p_job_id
    or v->>'report_id' is distinct from report_id::text then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  b=public.get_v22_review_evidence(p_user_id,p_case_id,review_id);
  if b is null then raise exception 'REVIEW_GENERATION_UNAVAILABLE'; end if;
  b=(b-'bundle_text')||jsonb_build_object('bundle',(b->>'bundle_text')::jsonb);
  d=public.get_v22_review_decision(p_user_id,p_case_id,report_id,review_id,decision_id);
  if v->'evidence' is distinct from b or v->'decision' is distinct from d
    or b#>>'{bundle,report,id}' is distinct from report_id::text
    or b#>>'{bundle,report,report_type}' is distinct from 'verified_execution'
    then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  if jsonb_typeof(v->'prepared_at') is distinct from 'string'
    or v->>'prepared_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  at_time=(v->>'prepared_at')::timestamptz;
  if at_time<greatest((b->>'frozen_at')::timestamptz,(b#>>'{bundle,evaluated_at}')::timestamptz,(d->>'recorded_at')::timestamptz)
    or at_time>clock_timestamp()+interval '1 minute' then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  return jsonb_build_object('schema_version','v22_review_generation_recipe_v1','rules_version',v->'rules_version',
    'job_id',p_job_id,'user_id',p_user_id,'case_id',p_case_id,'report_id',report_id,'prepared_at',v->'prepared_at',
    'review_id',review_id,'review_checksum',b#>'{bundle,checksum}','decision_id',decision_id,
    'decision_checksum',d->'checksum','input_checksum',v->'checksum');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
  or numeric_value_out_of_range or character_not_in_repertoire or untranslatable_character then
  raise exception 'REVIEW_GENERATION_INVALID';
end; $$;

create function public.resolve_v22_review_generation_input(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.capability_review_generation_inputs; r jsonb;
begin
  perform public.v22_review_generation_job(p_user_id,p_case_id,p_job_id,p_run_generation);
  select * into s from public.capability_review_generation_inputs where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if s.job_id is null then raise exception 'REVIEW_GENERATION_UNAVAILABLE'; end if;
  r=public.v22_review_generation_recipe(p_user_id,p_case_id,p_job_id,s.input_text);
  if r is distinct from s.recipe or r->>'input_checksum' is distinct from s.input_checksum
    or r->>'review_id' is distinct from s.review_id::text or r->>'decision_id' is distinct from s.decision_id::text
    or r->>'report_id' is distinct from s.report_id::text then raise exception 'REVIEW_GENERATION_INVALID'; end if;
  return jsonb_build_object('schema_version','v22_frozen_review_generation_v1','job_id',p_job_id,
    'run_generation',p_run_generation,'frozen_at',public.v22_page_time(s.frozen_at),'recipe',r,'input_text',s.input_text);
end; $$;

create function public.freeze_v22_review_generation_input(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer,p_input_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.capability_review_generation_inputs; r jsonb;
begin
  perform public.v22_review_generation_job(p_user_id,p_case_id,p_job_id,p_run_generation);
  r=public.v22_review_generation_recipe(p_user_id,p_case_id,p_job_id,p_input_text);
  select * into s from public.capability_review_generation_inputs where job_id=p_job_id;
  if s.job_id is not null then
    if (s.user_id,s.case_id) is distinct from (p_user_id,p_case_id) or s.recipe is distinct from r
      or s.input_text::jsonb is distinct from p_input_text::jsonb then raise exception 'REVIEW_GENERATION_CONFLICT'; end if;
  else
    insert into public.capability_review_generation_inputs(job_id,user_id,case_id,report_id,review_id,decision_id,input_text,input_checksum,recipe)
      values(p_job_id,p_user_id,p_case_id,(r->>'report_id')::uuid,(r->>'review_id')::uuid,(r->>'decision_id')::uuid,
        p_input_text,r->>'input_checksum',r);
  end if;
  return public.resolve_v22_review_generation_input(p_user_id,p_case_id,p_job_id,p_run_generation);
end; $$;

-- Serialize opposing paths on the same task lock, including direct inserts.
create function public.guard_v22_review_input_exclusivity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.analysis_jobs where id=new.job_id for update;
  if exists(select 1 from public.capability_review_generation_inputs where job_id=new.job_id)
    then raise exception 'REVIEW_GENERATION_CONFLICT'; end if;
  return new;
end; $$;
create trigger no_review_capability_manifest before insert on public.analysis_input_manifests
  for each row execute function public.guard_v22_review_input_exclusivity();
create trigger no_review_legacy_input before insert on public.verified_analysis_inputs
  for each row execute function public.guard_v22_review_input_exclusivity();
create trigger no_review_acquisition_preparation before insert on public.capability_acquisition_preparations
  for each row execute function public.guard_v22_review_input_exclusivity();
create trigger no_review_first_service_preparation before insert on public.capability_first_service_preparations
  for each row execute function public.guard_v22_review_input_exclusivity();

-- Until review report persistence is connected, generic terminal updates must
-- never consume a reservation without the corresponding completed report.
create function public.guard_v22_review_job_completion() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.capability_review_generation_inputs where job_id=old.id) then
    if (new.id,new.case_id,new.job_type) is distinct from (old.id,old.case_id,old.job_type)
      or new.status='succeeded' or new.report_id is not null or new.capability_report_id is not null
      then raise exception 'REVIEW_GENERATION_COMPLETION_NOT_READY'; end if;
  end if;
  return new;
end; $$;
create trigger guard_v22_review_job_completion before update on public.analysis_jobs
  for each row execute function public.guard_v22_review_job_completion();

revoke all on function public.v22_review_generation_job(uuid,uuid,uuid,integer),
  public.v22_review_generation_recipe(uuid,uuid,uuid,text), public.guard_v22_review_input_exclusivity(), public.guard_v22_review_job_completion(),
  public.freeze_v22_review_generation_input(uuid,uuid,uuid,integer,text),
  public.resolve_v22_review_generation_input(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.freeze_v22_review_generation_input(uuid,uuid,uuid,integer,text),
  public.resolve_v22_review_generation_input(uuid,uuid,uuid,integer) to service_role;
commit;
