begin;

alter table public.capability_report_versions
  alter column manifest_id drop not null,
  add column review_input_job_id uuid unique references public.capability_review_generation_inputs(job_id),
  drop constraint capability_report_versions_schema_version_check,
  add constraint capability_report_versions_schema_version_check check(schema_version in ('2.2.2','2.2.3')),
  add constraint capability_report_input_variant check(
    (schema_version='2.2.2' and manifest_id is not null and review_input_job_id is null)
    or (schema_version='2.2.3' and manifest_id is null and review_input_job_id is not null and review_input_job_id=id));

create function public.v22_review_decision_summary(identifier jsonb,d jsonb) returns jsonb
language sql immutable set search_path=public as $$
  select jsonb_build_object('action_id',identifier,'decision_state',case when d is null then 'needs_review' else 'seo_recorded' end,
    'disposition',coalesce(d->'disposition','null'::jsonb),'system_completion_verified',false,
    'text',case d->>'disposition'
      when 'continue' then 'SEO-recorded decision: continue the original action.'
      when 'adjust' then 'SEO-recorded decision: propose an adjustment. The proposed scope still needs client-delivery review.'
      when 'observe' then 'SEO reports the work complete and chooses observation. System verification of completion is not established.'
      when 'defer' then 'SEO-recorded decision: defer this action. Review the stated reconsideration condition before delivery.'
      when 'new' then 'SEO-recorded proposal for new work. Its scope and basis still need client-delivery review.'
      else 'Next work has not been decided. Review the available evidence and open checks.' end);
$$;

create function public.v22_review_report_actions(v jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare d jsonb; a jsonb; output jsonb='[]'; work text; steps jsonb;
begin
  for d in select value from jsonb_array_elements(v#>'{decision,decisions}') loop
    select value into a from jsonb_array_elements(v#>'{evidence,bundle,delivery,actions}') where value->'id'=d->'action_id';
    if d->>'disposition'='continue' then output=output||jsonb_build_array(a);
    elsif d->>'disposition' in ('adjust','new') then
      work=d->>'work';steps=jsonb_build_array(work);
      output=output||jsonb_build_array(jsonb_build_object('id',d->'action_id',
        'title',case when d->>'disposition'='adjust' then a->>'title' else 'New work proposed by SEO' end,
        'target',d->'target','steps',steps,'completion',jsonb_build_array('Confirm the agreed work is live and record the implementation date.'),
        'review','Review the same target and eligible evidence after implementation.','materials','[]'::jsonb));
    end if;
  end loop;
  return output;
end; $$;

create function public.v22_check_review_report(p jsonb,v jsonb,r jsonb) returns void
language plpgsql immutable set search_path=public as $$
declare c jsonb; a jsonb; approved jsonb; selected jsonb; client jsonb; facts jsonb; source jsonb; next jsonb;
  i integer=0; next_work jsonb; n jsonb; new_items jsonb='[]'; new_client jsonb='[]'; limits jsonb; findings jsonb;
begin
  c=p->'content';next_work=public.v22_review_report_actions(v);
  select jsonb_agg(value order by first_position) into limits from (
    select value,min(position) first_position from jsonb_array_elements(
      jsonb_build_array('Observed changes do not establish that this work caused a business result.')||(v#>'{evidence,bundle,report,limitations}'))
      with ordinality a(value,position) group by value order by min(position) limit 40) x;
  if public.v22_page_keys(p,array['schema_version','id','report_type','version','generated_at','input_reference','business','title','summary',
      'content','action_state','actions','limitations','delivery_state','settlement_policy','checksum']) is not true
    or p->>'schema_version' is distinct from '2.2.3' or p->>'report_type' is distinct from 'verified_execution'
    or p->'id' is distinct from v->'job_id' or p->'version' is distinct from to_jsonb((v#>>'{evidence,bundle,report,version}')::integer+1)
    or p->'generated_at' is distinct from v->'prepared_at' or p->'input_reference' is distinct from r
    or p->'business' is distinct from v#>'{evidence,bundle,report,input_manifest,business}'
    or p->>'title' is distinct from 'Verified Action Plan · Review'
    or p->>'summary' is distinct from 'Review the recorded work, the selected evidence and the next actions before client delivery.'
    or p->>'delivery_state' is distinct from 'requires_delivery_review'
    or p->>'settlement_policy' is distinct from 'one_credit_per_completed_analysis'
    or p->>'checksum' is distinct from public.v22_review_hash(p-'checksum')
    or p->'actions' is distinct from next_work or jsonb_array_length(next_work)>3
    or p->>'action_state' is distinct from (case when jsonb_array_length(next_work)>0 then 'actions_supported' else 'no_next_actions' end)
    or p->'limitations' is distinct from limits then raise exception 'REVIEW_REPORT_INVALID'; end if;
  if public.v22_page_keys(c,array['schema_version','rules_version','job_id','user_id','case_id','base_report_id','report_type',
      'proposed_version','prepared_at','input_checksum','review_id','review_checksum','decision_id','decision_checksum','delivery_state',
      'prior_diagnosis','seo_actions','seo_new_decisions','client_actions','client_new_decisions','effect','causal_attribution','checksum']) is not true
    or c->>'schema_version' is distinct from 'v22_review_generation_content_v1' or c->'rules_version' is distinct from v->'rules_version'
    or c->'job_id' is distinct from v->'job_id' or c->'user_id' is distinct from v->'user_id' or c->'case_id' is distinct from v->'case_id'
    or c->'base_report_id' is distinct from v->'report_id' or c->'report_type' is distinct from p->'report_type'
    or c->'proposed_version' is distinct from p->'version' or c->'prepared_at' is distinct from v->'prepared_at'
    or c->'input_checksum' is distinct from v->'checksum' or c->'review_id' is distinct from r->'review_id'
    or c->'review_checksum' is distinct from r->'review_checksum' or c->'decision_id' is distinct from r->'decision_id'
    or c->'decision_checksum' is distinct from r->'decision_checksum' or c->'delivery_state' is distinct from p->'delivery_state'
    or c->'effect' is distinct from 'null'::jsonb or c->'causal_attribution' is distinct from 'false'::jsonb
    or c->>'checksum' is distinct from public.v22_review_hash(c-'checksum')
    then raise exception 'REVIEW_REPORT_INVALID'; end if;
  -- Select only the historical diagnosis fields; rule metadata never changes its meaning.
  select coalesce(jsonb_agg(jsonb_build_object('classification',f->'classification','target',f->'target',
    'observed_fact',f->'observed_fact','observed_at',f->'observed_at','comparison_scope',f->'comparison_scope',
    'judgment',f->'judgment','interpretation',f->'interpretation','limitations',f->'limitations') order by position),'[]'::jsonb)
    into findings from jsonb_array_elements(v#>'{evidence,bundle,report,findings}') with ordinality a(f,position);
  if c->'prior_diagnosis' is distinct from jsonb_build_object('source','prior_report_not_rechecked',
    'title',v#>'{evidence,bundle,delivery,title}','summary',v#>'{evidence,bundle,delivery,summary}',
    'action_state',v#>'{evidence,bundle,report,action_state}','findings',findings,'limitations',v#>'{evidence,bundle,report,limitations}')
    then raise exception 'REVIEW_REPORT_INVALID'; end if;
  if jsonb_typeof(c->'seo_actions') is distinct from 'array' or jsonb_typeof(c->'client_actions') is distinct from 'array'
    or jsonb_array_length(c->'seo_actions')<>(select jsonb_array_length(v#>'{evidence,bundle,delivery,actions}'))
    or jsonb_array_length(c->'client_actions')<>jsonb_array_length(c->'seo_actions') then raise exception 'REVIEW_REPORT_INVALID'; end if;
  for a in select value from jsonb_array_elements(c->'seo_actions') loop
    approved=v#>array['evidence','bundle','delivery','actions',i::text];
    source=v#>array['evidence','bundle','selections',i::text];
    select value into selected from jsonb_array_elements(v#>'{decision,decisions}') where value->'action_id'=approved->'id';
    client=c#>array['client_actions',i::text];facts=a->'facts';next=client->'next_decision';
    if public.v22_page_keys(a,array['facts','approved_action','source_references','selected_decision']) is not true
      or public.v22_page_keys(client,array['facts','next_decision']) is not true
      or public.v22_page_keys(facts,array['action_id','title','target','recorded_work','page','gsc','ga4','checks','effect','causal_attribution']) is not true
      or a->'approved_action' is distinct from approved or a->'selected_decision' is distinct from coalesce(selected,'null'::jsonb)
      or facts->'action_id' is distinct from approved->'id' or facts->'title' is distinct from approved->'title'
      or facts->'target' is distinct from approved->'target' or client->'facts' is distinct from facts
      or facts->'effect' is distinct from 'null'::jsonb or facts->'causal_attribution' is distinct from 'false'::jsonb
      or facts#>'{recorded_work,system_completion_verified}' is distinct from 'false'::jsonb
      or public.v22_page_keys(next,array['action_id','decision_state','disposition','text','system_completion_verified']) is not true
      or next->'action_id' is distinct from approved->'id'
      or next->'disposition' is distinct from coalesce(selected->'disposition','null'::jsonb)
      or next->>'decision_state' is distinct from (case when selected is null then 'needs_review' else 'seo_recorded' end)
      or next->'system_completion_verified' is distinct from 'false'::jsonb
      or next is distinct from public.v22_review_decision_summary(approved->'id',selected)
      then raise exception 'REVIEW_REPORT_INVALID'; end if;
    if source->'gsc'='null'::jsonb then
      if facts->'gsc'<>'null'::jsonb then raise exception 'REVIEW_REPORT_INVALID'; end if;
    elsif facts#>'{gsc,metrics}' is distinct from source#>'{gsc,result,metrics}'
      or facts#>'{gsc,state}' is distinct from source#>'{gsc,result,state}'
      or facts#>'{gsc,scope}' is distinct from source#>'{gsc,result,scope}'
      or facts#>'{gsc,windows}' is distinct from source#>'{gsc,result,windows}' then raise exception 'REVIEW_REPORT_INVALID'; end if;
    i=i+1;
  end loop;
  for n in select value from jsonb_array_elements(v#>'{decision,decisions}') where value->>'disposition'='new' loop
    new_items=new_items||jsonb_build_array(n);
    new_client=new_client||jsonb_build_array(public.v22_review_decision_summary(n->'action_id',n));
  end loop;
  if c->'seo_new_decisions' is distinct from new_items or jsonb_typeof(c->'client_new_decisions') is distinct from 'array'
    or c->'client_new_decisions' is distinct from new_client then raise exception 'REVIEW_REPORT_INVALID'; end if;
end; $$;

create or replace function public.guard_v22_review_job_completion() returns trigger
language plpgsql security definer set search_path=public as $$
declare s public.capability_review_generation_inputs; r public.capability_report_versions;
begin
  select * into s from public.capability_review_generation_inputs where job_id=old.id;
  if s.job_id is null then return new; end if;
  if (new.id,new.case_id,new.job_type) is distinct from (old.id,old.case_id,old.job_type) or new.report_id is not null
    then raise exception 'REVIEW_REPORT_COMPLETION_INVALID'; end if;
  if new.status='succeeded' or new.capability_report_id is not null then
    select * into r from public.capability_report_versions where id=old.id and review_input_job_id=old.id
      and user_id=s.user_id and case_id=s.case_id and schema_version='2.2.3';
    if r.id is null or new.capability_report_id is distinct from r.id or new.status<>'succeeded'
      or new.current_stage<>'completed' or new.progress<>100 or new.completed_at is null or new.error_code is not null
      or new.run_generation is distinct from old.run_generation then raise exception 'REVIEW_REPORT_COMPLETION_INVALID'; end if;
  end if;
  return new;
end; $$;

create function public.get_v22_completed_review_report(p_user_id uuid,p_case_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; s public.capability_review_generation_inputs;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for share;
  if not found then raise exception 'REVIEW_REPORT_UNAVAILABLE'; end if;
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_job_id) where schema_version='2.2.3';
  select * into s from public.capability_review_generation_inputs where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if r.id is null or s.job_id is null or r.review_input_job_id is distinct from s.job_id then raise exception 'REVIEW_REPORT_UNAVAILABLE'; end if;
  if r.payload_checksum is distinct from public.v22_review_hash(r.payload) then raise exception 'REVIEW_REPORT_INVALID'; end if;
  return jsonb_build_object('schema_version','v22_completed_review_report_v1','report',r.payload,
    'payload_checksum',r.payload_checksum,'input_text',s.input_text);
end; $$;

create function public.complete_v22_review_analysis(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer,p_report_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.analysis_jobs; s public.capability_review_generation_inputs; r public.capability_report_versions;
  p jsonb; v jsonb; recipe jsonb; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'REVIEW_REPORT_UNAVAILABLE'; end if;
  select * into j from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if j.id is null then raise exception 'REVIEW_REPORT_UNAVAILABLE'; end if;
  if p_run_generation is null or p_run_generation<1 or j.run_generation is distinct from p_run_generation then raise exception 'REVIEW_REPORT_INACTIVE'; end if;
  select * into s from public.capability_review_generation_inputs where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if s.job_id is null then raise exception 'REVIEW_REPORT_UNAVAILABLE'; end if;
  if p_report_text is null then raise exception 'REVIEW_REPORT_INVALID'; end if;
  if octet_length(p_report_text)>1300000 then raise exception 'REVIEW_REPORT_TOO_LARGE'; end if;
  if not public.v22_review_unique_json(p_report_text::json) then raise exception 'REVIEW_REPORT_INVALID'; end if;
  p=p_report_text::jsonb;checksum=public.v22_review_hash(p);
  if j.status='succeeded' then
    perform public.get_v22_completed_review_report(p_user_id,p_case_id,p_job_id);
    select * into r from public.capability_report_versions where id=p_job_id;
    if r.payload is distinct from p or r.payload_checksum is distinct from checksum then raise exception 'REVIEW_REPORT_CONFLICT'; end if;
    return jsonb_build_object('report_id',r.id,'payload_checksum',r.payload_checksum,'idempotent',true);
  end if;
  perform public.v22_review_generation_job(p_user_id,p_case_id,p_job_id,p_run_generation);
  recipe=public.v22_review_generation_recipe(p_user_id,p_case_id,p_job_id,s.input_text);v=s.input_text::jsonb;
  if recipe is distinct from s.recipe then raise exception 'REVIEW_REPORT_INVALID'; end if;
  perform public.v22_check_review_report(p,v,recipe);
  if exists(select 1 from public.capability_report_versions where case_id=p_case_id and payload->>'report_type'='verified_execution'
    and (payload->>'version')::integer >= (p->>'version')::integer) then raise exception 'REVIEW_REPORT_STALE'; end if;
  insert into public.capability_report_versions(id,manifest_id,review_input_job_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(p_job_id,null,p_job_id,p_user_id,p_case_id,'2.2.3',checksum,p);
  update public.analysis_jobs set capability_report_id=p_job_id,status='succeeded',current_stage='completed',progress=100,
    completed_at=clock_timestamp(),error_code=null,user_message='Analysis complete.',state_revision=state_revision+1,
    terminal_effects_revision=state_revision+1 where id=p_job_id;
  perform public.get_v22_completed_review_report(p_user_id,p_case_id,p_job_id);
  return jsonb_build_object('report_id',p_job_id,'payload_checksum',checksum,'idempotent',false);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'REVIEW_REPORT_INVALID';
end; $$;

-- The old reading/editing UI accepts 2.2.2 only. Dedicated review delivery follows.
create function public.guard_v22_review_delivery_version() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.capability_report_versions where id=new.report_id and schema_version='2.2.3')
    then raise exception 'REVIEW_DELIVERY_NOT_READY'; end if;
  return new;
end; $$;
create trigger guard_v22_review_delivery_version before insert on public.report_content_revisions
  for each row execute function public.guard_v22_review_delivery_version();

create or replace function public.list_v22_completed_capability_reports(p_user_id uuid)
returns table(id uuid,user_id uuid,case_id uuid,business_name text,site_url text,market text,service text,
  report_type text,version integer,generated_at timestamptz,delivery_revision integer,delivery_status text)
language sql stable security definer set search_path=public as $$
  select r.id,r.user_id,r.case_id,coalesce(nullif(btrim(cc.business_name),''),cc.normalized_domain),
    r.payload#>>'{input_manifest,business,site_url}',r.payload#>>'{input_manifest,business,target_market}',
    r.payload#>>'{input_manifest,business,primary_service}',r.payload->>'report_type',(r.payload->>'version')::integer,
    (r.payload->>'generated_at')::timestamptz,coalesce(v.revision,0),coalesce(v.status,'original')
  from public.capability_report_versions candidate
  cross join lateral public.get_v22_completed_capability_report(p_user_id,candidate.case_id,candidate.id) r
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  left join lateral(select revision,status from public.report_content_revisions where report_id=r.id and user_id=r.user_id
    and case_id=r.case_id order by revision desc limit 1) v on true
  where candidate.user_id=p_user_id and candidate.schema_version='2.2.2'
  order by (r.payload->>'generated_at')::timestamptz desc,r.id;
$$;

revoke all on function public.v22_review_report_actions(jsonb),public.v22_review_decision_summary(jsonb,jsonb),public.v22_check_review_report(jsonb,jsonb,jsonb),
  public.guard_v22_review_delivery_version(),public.get_v22_completed_review_report(uuid,uuid,uuid),
  public.complete_v22_review_analysis(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.get_v22_completed_review_report(uuid,uuid,uuid),
  public.complete_v22_review_analysis(uuid,uuid,uuid,integer,text) to service_role;
commit;
