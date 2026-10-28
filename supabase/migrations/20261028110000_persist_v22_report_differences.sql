begin;

create table public.capability_review_report_differences (
  report_id uuid primary key references public.capability_report_versions(id),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  payload jsonb not null,
  payload_checksum text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint v22_report_difference_size check(octet_length(payload::text)<=5000000),
  constraint v22_report_difference_digest check(payload_checksum=public.v22_review_hash(payload))
);
alter table public.capability_review_report_differences enable row level security;
revoke all on public.capability_review_report_differences from public,anon,authenticated,service_role;

create function public.guard_v22_report_difference() returns trigger language plpgsql as $$
begin raise exception 'REVIEW_DIFFERENCE_IMMUTABLE';end;$$;
create trigger v22_report_difference_immutable before update or delete on public.capability_review_report_differences
 for each row execute function public.guard_v22_report_difference();

create function public.v22_difference_work(a jsonb) returns jsonb language sql immutable as $$
 select case when a is null or a='null'::jsonb then null else jsonb_build_object(
 'title',a->'title','target',a->'target','steps',a->'steps','completion',a->'completion','review',a->'review',
 'materials',(select coalesce(jsonb_agg(m-array['id','evidence_ids'] order by position),'[]'::jsonb)
  from jsonb_array_elements(a->'materials') with ordinality items(m,position))) end;
$$;
create function public.v22_difference_facts(f jsonb) returns jsonb language sql immutable as $$
 select jsonb_build_object('recorded_work',f->'recorded_work',
  'page',case when f->'page'='null'::jsonb then 'null'::jsonb else (f->'page')-array['observed_at','previous_observed_at','comparison','comparison_reason','changes'] end,
  'gsc',case when f->'gsc'='null'::jsonb then 'null'::jsonb else (f->'gsc')-'evaluated_at' end,
  'ga4',case when f->'ga4'='null'::jsonb then 'null'::jsonb else (f->'ga4')-array['started_at','completed_at'] end,'checks',f->'checks');
$$;

-- Inputs are completed immutable reports plus the exact frozen generation input.
-- Only the completion/read wrappers below can call this helper.
create function public.v22_build_report_difference(p jsonb,v jsonb,prior jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare b jsonb=v#>'{evidence,bundle}';a jsonb;before_fact jsonb;after_fact jsonb;left_value jsonb;right_value jsonb;
 evidence jsonb='[]';work jsonb='[]';fields jsonb;state text;reason text;key text;body jsonb;old_order jsonb;new_order jsonb;
 later boolean=(v#>>'{evidence,bundle,report,schema_version}'='v22_review_plan_basis_v1');
begin
 if later and (prior is null or prior='null'::jsonb or prior->'id' is distinct from b#>'{report,id}'
   or public.v22_review_hash(prior) is distinct from b->>'report_checksum') then raise exception 'REVIEW_DIFFERENCE_INVALID';end if;
 for a in select value from jsonb_array_elements(p#>'{content,seo_actions}') loop
  after_fact=a->'facts';before_fact=null;state='compared';reason=null;fields='[]';
  if later then select x->'facts' into before_fact from jsonb_array_elements(prior#>'{content,seo_actions}') x
    where x#>'{facts,action_id}'=after_fact->'action_id';end if;
  if not later then state='first_baseline';reason='no_previous_review';
  elsif before_fact is null then state='first_baseline';reason='no_previous_action_observation';
  elsif jsonb_build_array(prior#>'{business,site_url}',prior#>'{business,primary_service}',prior#>'{business,target_market}')
    is distinct from jsonb_build_array(b#>'{report,business,site_url}',b#>'{report,business,primary_service}',b#>'{report,business,target_market}')
    then state='not_comparable';reason='different_business_scope';
  elsif before_fact->'target' is distinct from after_fact->'target' then state='not_comparable';reason='different_target';
  end if;
  if state='compared' then
   left_value=public.v22_difference_facts(before_fact);right_value=public.v22_difference_facts(after_fact);
   foreach key in array array['recorded_work','page','gsc','ga4','checks'] loop
    if left_value->key is distinct from right_value->key then fields=fields||to_jsonb(key);end if;
   end loop;
  end if;
  evidence=evidence||jsonb_build_array(jsonb_build_object('action_id',after_fact->'action_id','state',state,'reason',reason,
   'before',before_fact,'after',after_fact,'changed_sections',fields));
 end loop;
 for a in select value from jsonb_array_elements((p->'actions')||(
   select coalesce(jsonb_agg(x order by position),'[]'::jsonb) from jsonb_array_elements(b#>'{delivery,actions}') with ordinality t(x,position)
   where not exists(select 1 from jsonb_array_elements(p->'actions') n where n->'id'=x->'id'))) loop
  select x into left_value from jsonb_array_elements(b#>'{delivery,actions}') x where x->'id'=a->'id';
  select x into right_value from jsonb_array_elements(p->'actions') x where x->'id'=a->'id';fields='[]';
  if left_value is null then state='added';
  elsif right_value is null then state='not_carried_forward';
  else
   foreach key in array array['title','target','steps','completion','review','materials'] loop
    if public.v22_difference_work(left_value)->key is distinct from public.v22_difference_work(right_value)->key then fields=fields||to_jsonb(key);end if;
   end loop;
   state=case when jsonb_array_length(fields)>0 then 'updated' else 'unchanged' end;
  end if;
  work=work||jsonb_build_array(jsonb_build_object('action_id',a->'id','state',state,'before',left_value,'after',right_value,'changed_fields',fields));
 end loop;
 select coalesce(jsonb_agg(x->'id' order by position),'[]'::jsonb) into old_order
  from jsonb_array_elements(b#>'{delivery,actions}') with ordinality t(x,position)
  where exists(select 1 from jsonb_array_elements(p->'actions') n where n->'id'=x->'id');
 select coalesce(jsonb_agg(x->'id' order by position),'[]'::jsonb) into new_order
  from jsonb_array_elements(p->'actions') with ordinality t(x,position)
  where exists(select 1 from jsonb_array_elements(b#>'{delivery,actions}') n where n->'id'=x->'id');
 body=jsonb_build_object('schema_version','v22_review_report_difference_v1','rules_version','v22_report_difference_rules_v1',
  'user_id',v->'user_id','case_id',v->'case_id','report_id',p->'id','report_checksum',public.v22_review_hash(p),
  'report_version',p->'version','generated_at',p->'generated_at','input_checksum',v->'checksum',
  'basis',jsonb_build_object('report_id',b#>'{report,id}','report_checksum',b->'report_checksum','report_version',b#>'{report,version}',
    'delivery_id',b->'delivery_id','delivery_revision',b->'delivery_revision','delivery_checksum',b->'delivery_checksum'),
  'evidence_basis',case when later then 'previous_review' else 'first_review' end,'evidence',evidence,'work',work,
  'basis_action_order',(select coalesce(jsonb_agg(x->'id' order by position),'[]'::jsonb) from jsonb_array_elements(b#>'{delivery,actions}') with ordinality t(x,position)),
  'current_action_order',(select coalesce(jsonb_agg(x->'id' order by position),'[]'::jsonb) from jsonb_array_elements(p->'actions') with ordinality t(x,position)),
  'plan_order_changed',old_order is distinct from new_order);
 if octet_length(body::text)>4999800 then raise exception 'REVIEW_DIFFERENCE_TOO_LARGE';end if;
 return body||jsonb_build_object('checksum',public.v22_review_hash(body));
end;$$;

create function public.get_v22_review_report_difference(p_user_id uuid,p_case_id uuid,p_report_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare envelope jsonb;v jsonb;prior public.capability_report_versions;d public.capability_review_report_differences;expected jsonb;
begin
 envelope=public.get_v22_completed_review_report(p_user_id,p_case_id,p_report_id);
 select * into d from public.capability_review_report_differences where report_id=p_report_id;
 if d.report_id is null then return null;end if;
 v=(envelope->>'input_text')::jsonb;
 select * into prior from public.get_v22_completed_capability_report(p_user_id,p_case_id,(v->>'report_id')::uuid);
 if prior.id is null or prior.payload_checksum is distinct from v#>>'{evidence,bundle,report_checksum}'
  or d.user_id is distinct from p_user_id or d.case_id is distinct from p_case_id then raise exception 'REVIEW_DIFFERENCE_INVALID';end if;
 expected=public.v22_build_report_difference(envelope->'report',v,case when prior.schema_version='2.2.3' then prior.payload else null end);
 if d.payload_checksum is distinct from public.v22_review_hash(d.payload) or d.payload is distinct from expected then raise exception 'REVIEW_DIFFERENCE_INVALID';end if;
 return d.payload;
end;$$;

alter function public.complete_v22_review_analysis(uuid,uuid,uuid,integer,text) rename to complete_v22_review_analysis_before_difference;
create function public.complete_v22_review_analysis(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_run_generation integer,p_report_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare receipt jsonb;v jsonb;prior public.capability_report_versions;difference jsonb;
begin
 receipt=public.complete_v22_review_analysis_before_difference(p_user_id,p_case_id,p_job_id,p_run_generation,p_report_text);
 if (receipt->>'idempotent')::boolean then
  -- A pre-migration terminal replay remains byte-exact; never backfill on reads/replays.
  if exists(select 1 from public.capability_review_report_differences where report_id=p_job_id) then
   perform public.get_v22_review_report_difference(p_user_id,p_case_id,p_job_id);
  end if;
  return receipt;
 end if;
 select input_text::jsonb into v from public.capability_review_generation_inputs
  where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
 select * into prior from public.get_v22_completed_capability_report(p_user_id,p_case_id,(v->>'report_id')::uuid);
 if prior.id is null or prior.payload_checksum is distinct from v#>>'{evidence,bundle,report_checksum}' then raise exception 'REVIEW_DIFFERENCE_INVALID';end if;
 difference=public.v22_build_report_difference(p_report_text::jsonb,v,case when prior.schema_version='2.2.3' then prior.payload else null end);
 insert into public.capability_review_report_differences(report_id,user_id,case_id,payload,payload_checksum)
  values(p_job_id,p_user_id,p_case_id,difference,public.v22_review_hash(difference));
 return receipt;
end;$$;

revoke all on function public.guard_v22_report_difference(),public.v22_difference_work(jsonb),public.v22_difference_facts(jsonb),
 public.v22_build_report_difference(jsonb,jsonb,jsonb),public.complete_v22_review_analysis_before_difference(uuid,uuid,uuid,integer,text),
 public.complete_v22_review_analysis(uuid,uuid,uuid,integer,text),public.get_v22_review_report_difference(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.complete_v22_review_analysis(uuid,uuid,uuid,integer,text),public.get_v22_review_report_difference(uuid,uuid,uuid) to service_role;
commit;
