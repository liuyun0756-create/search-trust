-- P1-05 phase 3. Additive identities/reports; no collection or credit charge.
begin;

create table public.case_business_identity_versions (
  id uuid primary key, user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id), revision integer not null check(revision>0),
  base_report_id uuid not null references public.capability_report_versions(id),
  identity jsonb not null, identity_checksum text not null,
  created_at timestamptz not null default now(), unique(case_id,revision)
);
create table public.capability_reassessment_requests (
  id uuid primary key, user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  base_report_id uuid not null references public.capability_report_versions(id),
  preview jsonb not null, preview_checksum text not null,
  expected_identity_revision integer not null, expected_delivery_revision integer not null,
  created_at timestamptz not null default now()
);
create table public.capability_reassessment_completions (
  request_id uuid primary key references public.capability_reassessment_requests(id),
  report_id uuid not null unique references public.capability_report_versions(id) deferrable initially deferred,
  identity_version_id uuid not null references public.case_business_identity_versions(id) deferrable initially deferred,
  user_id uuid not null references public.users(id), case_id uuid not null references public.client_cases(id),
  created_at timestamptz not null default now()
);
create table public.case_identity_lookup_ledgers (
  base_report_id uuid not null references public.capability_report_versions(id),
  user_id uuid not null references public.users(id), case_id uuid primary key references public.client_cases(id),
  ledger jsonb not null, updated_at timestamptz not null default now()
);
create table public.case_identity_lookup_results (
  id uuid primary key default gen_random_uuid(),
  base_report_id uuid not null references public.capability_report_versions(id),
  user_id uuid not null references public.users(id), case_id uuid not null references public.client_cases(id),
  result jsonb not null, created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['case_business_identity_versions','capability_reassessment_requests',
    'capability_reassessment_completions','case_identity_lookup_results','case_identity_lookup_ledgers'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
    if t<>'case_identity_lookup_ledgers' then
      execute format('create trigger immutable_identity_version before update or delete on public.%I for each row execute function public.reject_v22_capability_mutation()',t);
    end if;
  end loop;
end $$;

create function public.get_v22_identity_workspace(p_user_id uuid,p_case_id uuid,p_report_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.capability_report_versions; recipe jsonb; body jsonb;
begin
  select * into r from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  if r.id is null or r.payload->>'report_type'<>'prospect' then return null; end if;
  select g.recipe into recipe from public.capability_generation_recipes g where g.manifest_id=r.manifest_id and g.user_id=p_user_id and g.case_id=p_case_id;
  if recipe is null then return null; end if;
  body=public.hydrate_v22_capability_generation_input(r.payload->'input_manifest',recipe);
  return jsonb_build_object('report',r.payload,'request',body,
    'identity_revision',(select coalesce(max(revision),0) from public.case_business_identity_versions where case_id=p_case_id and user_id=p_user_id),
    'delivery_revision',(select coalesce(max(revision),0) from public.report_content_revisions where report_id=p_report_id and case_id=p_case_id and user_id=p_user_id),
    'ledger',(select ledger from public.case_identity_lookup_ledgers where case_id=p_case_id and user_id=p_user_id),
    'saved_records',coalesce((select jsonb_agg(c->'record') from public.case_identity_lookup_results l,
      lateral jsonb_array_elements(l.result->'candidates') c where l.case_id=p_case_id and l.user_id=p_user_id),'[]'::jsonb));
end $$;

create function public.save_v22_identity_lookup_ledger(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_ledger jsonb,p_reserve boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior jsonb; n integer; m integer; i integer; a jsonb; b jsonb; domain text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found or not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id)) then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select normalized_domain into domain from public.client_cases where id=p_case_id;
  if jsonb_typeof(p_ledger->'attempts') is distinct from 'array'
    or p_ledger->>'case_ref' is distinct from p_case_id::text
    or p_ledger->>'normalized_domain' is distinct from domain then raise exception 'IDENTITY_INVALID'; end if;
  select ledger into prior from public.case_identity_lookup_ledgers where case_id=p_case_id and user_id=p_user_id for update;
  n=jsonb_array_length(p_ledger->'attempts');m=coalesce(jsonb_array_length(prior->'attempts'),0);
  if n>3 or n<m or n>m+1 then raise exception 'IDENTITY_LOOKUP_BUDGET'; end if;
  if p_reserve is null or (p_reserve and n<>m+1) or (not p_reserve and n<>m) then
    raise exception 'IDENTITY_LOOKUP_CONFLICT' using errcode='40001'; end if;
  for i in 0..n-1 loop
    a=p_ledger->'attempts'->i;b=prior->'attempts'->i;
    if (a->>'number')::integer<>i+1 or a->>'stage' not in ('link','refresh','domain_phone','name')
      or a->>'outcome' not in ('started','success','failed','interrupted')
      or (i<m and (a-'outcome' is distinct from b-'outcome' or (b->>'outcome'<>'started' and a is distinct from b)))
      or (i>=m and a->>'outcome'<>'started') then raise exception 'IDENTITY_LOOKUP_CONFLICT' using errcode='40001'; end if;
  end loop;
  insert into public.case_identity_lookup_ledgers(base_report_id,user_id,case_id,ledger)
    values(p_report_id,p_user_id,p_case_id,p_ledger)
    on conflict(case_id) do update set ledger=excluded.ledger,updated_at=now();
  return p_ledger;
end $$;

create function public.save_v22_identity_lookup_result(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id))
    or p_result->>'schema_version' is distinct from 'gbp_identity_result_v2'
    or p_result#>>'{ledger,case_ref}' is distinct from p_case_id::text or octet_length(p_result::text)>2000000 then raise exception 'IDENTITY_INVALID'; end if;
  if coalesce(jsonb_array_length(p_result#>'{ledger,attempts}'),4)>3 then raise exception 'IDENTITY_LOOKUP_BUDGET'; end if;
  insert into public.case_identity_lookup_results(base_report_id,user_id,case_id,result) values(p_report_id,p_user_id,p_case_id,p_result);
  return p_result;
end $$;

create function public.get_v22_public_reassessment(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_request_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select q.preview||jsonb_build_object('request_id',q.id,'state',case when c.request_id is null then 'preview' else 'committed' end)
  from public.capability_reassessment_requests q left join public.capability_reassessment_completions c on c.request_id=q.id
  where q.id=p_request_id and q.user_id=p_user_id and q.case_id=p_case_id and q.base_report_id=p_report_id
    and exists(select 1 from public.client_cases where id=p_case_id and user_id=p_user_id);
$$;

create function public.prepare_v22_public_reassessment(p_user_id uuid,p_case_id uuid,p_report_id uuid,
  p_request_id uuid,p_preview jsonb,p_canonical text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare base public.capability_report_versions; m jsonb; r jsonb; old public.capability_reassessment_requests;
  ir integer; dr integer; source jsonb; hydrated jsonb; expected jsonb; visit boolean; location jsonb; confirmation jsonb; saved_address text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Share the delivery writer's report lock before reading its latest revision.
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into base from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id);
  if base.id is null or base.payload->>'report_type'<>'prospect' then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into old from public.capability_reassessment_requests where id=p_request_id;
  if found then
    if old.user_id<>p_user_id or old.case_id<>p_case_id or old.base_report_id<>p_report_id or old.preview is distinct from p_preview then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
    return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
  end if;
  select coalesce(max(revision),0) into ir from public.case_business_identity_versions where case_id=p_case_id;
  select coalesce(max(revision),0) into dr from public.report_content_revisions where report_id=p_report_id;
  if (p_preview->>'expected_identity_revision')::integer is distinct from ir or (p_preview->>'expected_delivery_revision')::integer is distinct from dr then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
  if (p_preview#>'{selection,customers_can_visit}' is not null
      and jsonb_typeof(p_preview#>'{selection,customers_can_visit}') is distinct from 'boolean')
    or coalesce(p_preview#>>'{selection,reason}','') ~ '^[[:space:]]*$' then raise exception 'IDENTITY_INVALID'; end if;
  visit=coalesce((p_preview#>>'{selection,customers_can_visit}')::boolean,false);
  location=p_preview#>'{identity,operating_location}';confirmation=location->'confirmation_ref';
  if visit then
    if coalesce(p_preview#>>'{selection,operating_model}','') not in ('storefront','hybrid')
      or location->>'role' is distinct from 'customer_facing' or location->>'state' is distinct from 'seo_confirmed'
      or confirmation->>'confirmed_by' is distinct from p_user_id::text
      or confirmation->>'confirmed_at' is distinct from p_preview#>>'{report,input_manifest,evaluated_at}'
      or confirmation->>'confirmed_at' is distinct from p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_at}'
      or confirmation->>'selected_branch_ref' is distinct from split_part(p_preview#>>'{selection,branch_ref}',':',2)
      or confirmation->>'selected_branch_ref' is distinct from p_preview#>>'{identity,selected_branch_ref}'
      or confirmation->>'source_ref' is distinct from 'identity-review:'||p_request_id::text then raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID'; end if;
  elsif location->>'role' is distinct from 'unknown' or location ? 'confirmation_ref' or location->>'state'='seo_confirmed' then
    raise exception 'IDENTITY_VISIT_CONFIRMATION_INVALID';
  end if;
  r=p_preview->'report';m=r->'input_manifest';
  if p_preview is distinct from p_canonical::jsonb or octet_length(p_canonical)>3000000
    or public.v22_review_hash(r) is distinct from p_preview->>'report_checksum'
    or public.v22_review_hash(m-'input_checksum') is distinct from m->>'input_checksum'
    or public.v22_review_hash(p_preview->'identity') is distinct from m->>'identity_checksum'
    or r->>'schema_version' is distinct from '2.2.8' or r->>'report_type' is distinct from 'prospect'
    or r->>'settlement_policy' is distinct from 'no_charge_public_reassessment'
    or r->>'id' is distinct from m->>'job_id' or r->>'id'=p_report_id::text
    or (r->>'version')::integer is distinct from (base.payload->>'version')::integer+1
    or m->>'execution_type' is distinct from 'public_reassessment'
    or m->>'schema_version' is distinct from 'v22_analysis_input_v3' or m->>'ruleset_version' is distinct from 'v22_capability_public_v13'
    or m->>'mode' is distinct from 'acquisition' or m->>'case_id' is distinct from p_case_id::text or m->>'user_id' is distinct from p_user_id::text
    or m#>>'{base_report_ref,report_id}' is distinct from p_report_id::text
    or m#>>'{base_report_ref,payload_checksum}' is distinct from base.payload_checksum
    or m->'snapshots' is distinct from base.payload#>'{input_manifest,snapshots}'
    or m->'business' is distinct from base.payload#>'{input_manifest,business}'
    or m->>'evidence_as_of' is distinct from coalesce(base.payload#>>'{input_manifest,evidence_as_of}',base.payload#>>'{input_manifest,evaluated_at}')
    or (m->>'evaluated_at')::timestamptz < (base.payload->>'generated_at')::timestamptz
    or (m->>'evaluated_at')::timestamptz > now()+interval '5 minutes'
    or p_preview#>>'{identity,schema_version}' is distinct from 'business_identity_v2'
    or p_preview#>>'{identity,operating_model,value}' is distinct from p_preview#>>'{selection,operating_model}'
    or p_preview#>>'{identity,operating_model,confirmation_ref,confirmed_by}' is distinct from p_user_id::text
    or p_preview#>>'{identity,operating_model,confirmation_ref,source_ref}' is distinct from 'identity-review:'||p_request_id::text
    or jsonb_array_length(r->'actions')>3 then raise exception 'IDENTITY_INVALID'; end if;
  expected=(select public.hydrate_v22_capability_generation_input(base.payload->'input_manifest',g.recipe)
    from public.capability_generation_recipes g where g.manifest_id=base.manifest_id);
  hydrated=public.hydrate_v22_capability_generation_input(m,p_preview->'recipe');
  if expected is null or hydrated->'evidence_input' is distinct from expected->'evidence_input'
    or public.v22_review_hash(hydrated) is distinct from m->>'generation_input_checksum'
    or hydrated->'business_identity' is distinct from p_preview->'identity'
    or not exists(select 1 from jsonb_array_elements(expected#>'{evidence_input,context,customer_public_gbp,entity_keys}') k
      where (k->>'kind')||':'||(k->>'value')=p_preview#>>'{selection,branch_ref}') then raise exception 'IDENTITY_SOURCE_CONFLICT'; end if;
  if visit then
    select s#>>'{payload,record,fields,address,value}' into saved_address
      from jsonb_array_elements(expected#>'{evidence_input,sources}') s
      where s->>'kind'='public_gbp' and s#>>'{payload,record,fields,address,state}'='observed';
    if saved_address is null or location#>>'{location,address}' is distinct from saved_address
      or confirmation->>'address' is distinct from saved_address then raise exception 'IDENTITY_VISIT_ADDRESS_INVALID'; end if;
  end if;
  perform public.validate_v22_candidate_pool(r);
  insert into public.capability_reassessment_requests(id,user_id,case_id,base_report_id,preview,preview_checksum,expected_identity_revision,expected_delivery_revision)
    values(p_request_id,p_user_id,p_case_id,p_report_id,p_preview,'sha256:'||encode(sha256(convert_to(p_canonical,'UTF8')),'hex'),ir,dr);
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $$;

create function public.commit_v22_public_reassessment(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.capability_reassessment_requests; r jsonb; m jsonb; s jsonb; ir integer; dr integer; result_id uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Share the delivery writer's report lock before reading its latest revision.
  perform 1 from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into q from public.capability_reassessment_requests where id=p_request_id and user_id=p_user_id and case_id=p_case_id and base_report_id=p_report_id;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  if exists(select 1 from public.capability_reassessment_completions where request_id=q.id) then
    return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id); end if;
  select coalesce(max(revision),0) into ir from public.case_business_identity_versions where case_id=p_case_id;
  select coalesce(max(revision),0) into dr from public.report_content_revisions where report_id=p_report_id;
  if ir<>q.expected_identity_revision or dr<>q.expected_delivery_revision then raise exception 'IDENTITY_CONFLICT' using errcode='40001'; end if;
  if not exists(select 1 from public.get_v22_completed_capability_report(p_user_id,p_case_id,p_report_id)) then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Do not change the identity under an in-flight collection or review workflow.
  if exists(select 1 from public.workflow_charges where case_id=p_case_id and state='reserved')
    or exists(select 1 from public.analysis_jobs where case_id=p_case_id and status in ('queued','running')) then
    raise exception 'IDENTITY_BUSY' using errcode='40001'; end if;
  r=q.preview->'report';m=r->'input_manifest';result_id=(r->>'id')::uuid;
  insert into public.case_business_identity_versions(id,user_id,case_id,revision,base_report_id,identity,identity_checksum)
    values((m->>'identity_version_id')::uuid,p_user_id,p_case_id,ir+1,p_report_id,q.preview->'identity',m->>'identity_checksum');
  insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key)
    values(result_id,p_case_id,'prospect_report','queued','public-reassessment:'||q.id::text);
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload)
    values((m->>'id')::uuid,p_user_id,p_case_id,result_id,(m#>>'{business,id}')::uuid,'acquisition',m->>'input_checksum',m);
  for s in select value from jsonb_array_elements(m->'snapshots') loop
    insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind) values((m->>'id')::uuid,(s->>'snapshot_id')::uuid,s->>'source_kind');
  end loop;
  insert into public.capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe)
    values((m->>'id')::uuid,p_user_id,p_case_id,m->>'generation_input_checksum',q.preview->'recipe');
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(result_id,(m->>'id')::uuid,p_user_id,p_case_id,'2.2.8',q.preview->>'report_checksum',r);
  insert into public.capability_reassessment_completions(request_id,report_id,identity_version_id,user_id,case_id)
    values(q.id,result_id,(m->>'identity_version_id')::uuid,p_user_id,p_case_id);
  update public.analysis_jobs set status='succeeded',current_stage='completed',progress=100,completed_at=now(),capability_report_id=result_id
    where id=result_id;
  -- No delivery revision is copied or approved. Existing shares remain pinned.
  return public.get_v22_public_reassessment(p_user_id,p_case_id,p_report_id,p_request_id);
end $$;

-- New services use the latest confirmed identity; historical Case rows and
-- already frozen requests are retained. Commit is serialized with active work.
create function public.v22_current_service_identity(p_case_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select public.v22_service_identity(coalesce((select identity from public.case_business_identity_versions
    where case_id=cc.id and user_id=cc.user_id order by revision desc limit 1),cc.business_identity),cc.target_market)
  from public.client_cases cc where cc.id=p_case_id;
$$;
revoke all on function public.v22_current_service_identity(uuid) from public,anon,authenticated;
grant execute on function public.v22_current_service_identity(uuid) to service_role;

do $consumers$
declare n text; d text; old text;
begin
 foreach n in array array['check_v22_first_service_discovery_binding','claim_v22_first_service_discovery_run_base',
  'continue_v22_first_service_discovery','get_v22_first_service_workspace','reserve_v22_first_service_discovery_base',
  'start_v22_first_service_preparation'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  old='public.v22_service_identity(cc.business_identity,cc.target_market)';
  if position(old in d)=0 then raise exception 'P105_SERVICE_IDENTITY_TARGET_MISSING: %',n; end if;
  execute replace(d,old,'public.v22_current_service_identity(cc.id)');
 end loop;
 foreach n in array array['begin_v22_first_service_collection','check_v22_first_service_preparation_binding','resolve_v22_capability_analysis_input'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  old='(select public.v22_service_identity(business_identity,target_market) from public.client_cases';
  if position(old in d)=0 then raise exception 'P105_SERVICE_IDENTITY_TARGET_MISSING: %',n; end if;
  execute replace(d,old,'(select public.v22_current_service_identity(id) from public.client_cases');
 end loop;
end $consumers$;

do $migration$
declare d text; old text;
begin
  select pg_get_functiondef('public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure) into d;
  old=$old$(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end)$old$;
  if position(old in d)=0 then raise exception 'P105_REASSESS_HYDRATE_TARGET_MISSING'; end if;
  execute replace(d,old,$new$(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version'='v22_analysis_input_v3' and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end)$new$);
  select pg_get_functiondef('public.guard_v22_capability_job_completion()'::regprocedure) into d;
  old=$old$  if old.capability_report_id is not null then$old$;
  if position(old in d)=0 then raise exception 'P105_REASSESS_COMPLETION_TARGET_MISSING'; end if;
  execute replace(d,old,$new$  if old.capability_report_id is null and new.capability_report_id=new.id
    and new.status='succeeded' and new.current_stage='completed' and new.progress=100
    and new.case_id=old.case_id and new.run_generation=old.run_generation and new.report_id is null
    and exists(select 1 from public.capability_reassessment_completions re_completion join public.capability_reassessment_requests re_request on re_request.id=re_completion.request_id
      where re_completion.report_id=new.id and re_completion.case_id=new.case_id and re_request.case_id=new.case_id
        and re_request.preview#>>'{report,settlement_policy}'='no_charge_public_reassessment') then return new; end if;
  if old.capability_report_id is not null then$new$);
  select pg_get_functiondef('public.get_v22_completed_capability_report(uuid,uuid,uuid)'::regprocedure) into d;
  old=$old$and not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.kind='technical_failure_credit');$old$;
  if position(old in d)=0 then raise exception 'P105_REASSESS_ENTITLEMENT_TARGET_MISSING'; end if;
  execute replace(d,old,$new$and not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=c.id and l.kind='technical_failure_credit')
  union all
  select r.* from public.capability_report_versions r
  join public.capability_reassessment_completions rc on rc.report_id=r.id and rc.user_id=r.user_id and rc.case_id=r.case_id
  join public.capability_reassessment_requests rq on rq.id=rc.request_id and rq.user_id=r.user_id and rq.case_id=r.case_id
  join public.analysis_jobs j on j.id=r.id and j.case_id=r.case_id
  join public.client_cases cc on cc.id=r.case_id and cc.user_id=r.user_id
  where r.id=p_report_id and r.user_id=p_user_id and r.case_id=p_case_id
    and j.status='succeeded' and j.capability_report_id=r.id
    and r.payload=rq.preview->'report' and r.payload->>'settlement_policy'='no_charge_public_reassessment';$new$);
end $migration$;

do $$ declare f record; begin
  for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname in
    ('get_v22_identity_workspace','save_v22_identity_lookup_ledger','save_v22_identity_lookup_result',
     'get_v22_public_reassessment','prepare_v22_public_reassessment','commit_v22_public_reassessment') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.sig);
    execute format('grant execute on function %s to service_role',f.sig);
  end loop;
end $$;
commit;
