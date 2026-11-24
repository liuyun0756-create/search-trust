-- Optional confirmations from already-collected preflight evidence. No existing rows are rewritten.
begin;

create table public.case_gbp_branch_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  revision integer not null check (revision > 0),
  request_id uuid not null,
  evidence jsonb not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  operating_mode text check (operating_mode in ('storefront','service_area','hybrid','meeting_point')),
  customers_can_visit boolean not null,
  confirmed_at timestamptz not null default clock_timestamp(),
  confirmation_checksum text not null,
  unique(case_id,revision),
  unique(case_id,request_id),
  unique(id,user_id,case_id),
  check (not customers_can_visit or coalesce(operating_mode in ('storefront','hybrid'),false))
);
create table public.prospect_gbp_branch_bindings (
  workflow_id uuid primary key references public.workflow_charges(id),
  user_id uuid not null,
  case_id uuid not null,
  confirmation_id uuid not null,
  foreign key(confirmation_id,user_id,case_id) references public.case_gbp_branch_confirmations(id,user_id,case_id)
);
alter table public.case_gbp_branch_confirmations enable row level security;
alter table public.prospect_gbp_branch_bindings enable row level security;
revoke all on public.case_gbp_branch_confirmations,public.prospect_gbp_branch_bindings from public,anon,authenticated,service_role;
create trigger guard_case_gbp_branch_confirmations before update or delete on public.case_gbp_branch_confirmations
  for each row execute function public.reject_v22_capability_mutation();
create trigger guard_prospect_gbp_branch_bindings before update or delete on public.prospect_gbp_branch_bindings
  for each row execute function public.reject_v22_capability_mutation();

create function public.save_v22_preflight_branch_confirmation(p_user_id uuid,p_case_id uuid,p_request_id uuid,
  p_evidence jsonb,p_reason text,p_operating_mode text,p_customers_can_visit boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.client_cases; saved public.case_gbp_branch_confirmations; checksum text;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'GBP_BRANCH_UNAVAILABLE'; end if;
  if p_request_id is null or jsonb_typeof(p_evidence) is distinct from 'object' or octet_length(p_evidence::text)>25000
    or p_evidence->>'domain' is distinct from c.normalized_domain
    or coalesce(p_evidence->>'branch_ref','') = ''
    or not coalesce(p_evidence->>'branch_ref' in (p_evidence#>>'{entity_keys,cid}',p_evidence#>>'{entity_keys,place_id}'),false)
    or coalesce(p_evidence->>'public_gbp_url','') = ''
    or p_reason is null or length(btrim(p_reason)) not between 1 and 1000
    or p_customers_can_visit is null or (p_customers_can_visit and
       (not coalesce(p_operating_mode in ('storefront','hybrid'),false) or nullif(p_evidence->>'gbp_address','') is null))
    then raise exception 'GBP_BRANCH_INVALID'; end if;
  checksum=public.v22_review_hash(jsonb_build_object('evidence',p_evidence,'reason',btrim(p_reason),
    'operating_mode',p_operating_mode,'customers_can_visit',p_customers_can_visit));
  select * into saved from public.case_gbp_branch_confirmations where case_id=p_case_id and request_id=p_request_id;
  if found then
    if saved.user_id is distinct from p_user_id or saved.confirmation_checksum is distinct from checksum
      then raise exception 'GBP_BRANCH_CONFLICT'; end if;
  else
    if not coalesce((p_evidence->>'observed_at')::timestamptz <= clock_timestamp()
           and (p_evidence->>'expires_at')::timestamptz > clock_timestamp(),false)
      then raise exception 'GBP_BRANCH_EVIDENCE_EXPIRED'; end if;
    insert into public.case_gbp_branch_confirmations(user_id,case_id,revision,request_id,evidence,reason,operating_mode,
      customers_can_visit,confirmation_checksum)
    values(p_user_id,p_case_id,(select coalesce(max(revision),0)+1 from public.case_gbp_branch_confirmations where case_id=p_case_id),
      p_request_id,p_evidence,btrim(p_reason),p_operating_mode,p_customers_can_visit,checksum)
    returning * into saved;
  end if;
  return jsonb_build_object('id',saved.id,'case_id',saved.case_id,'revision',saved.revision,
    'public_gbp_url',saved.evidence->>'public_gbp_url','expires_at',saved.evidence->>'expires_at');
end $$;

create function public.start_v22_prospect_discovery_with_branch(p_user_id uuid,p_case_id uuid,p_workflow_id uuid,
  p_discovery_job_id uuid,p_workflow_idempotency_key text,p_task_idempotency_key text,p_confirmation_id uuid,
  p_public_gbp_url text,p_planning_revision integer,p_queries_canonical text,p_keyword_scope jsonb)
returns table(workflow_id uuid,discovery_job_id uuid,charge_state text,created boolean,idempotent boolean,credit_balance integer)
language plpgsql security definer set search_path=public as $$
declare c public.client_cases; pin public.case_gbp_branch_confirmations; binding public.prospect_gbp_branch_bindings;
begin
  select * into c from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for no key update;
  if not found then raise exception 'GBP_BRANCH_UNAVAILABLE'; end if;
  select * into binding from public.prospect_gbp_branch_bindings b where b.workflow_id=p_workflow_id;
  select * into pin from public.case_gbp_branch_confirmations i where (i.id,i.user_id,i.case_id)=(p_confirmation_id,p_user_id,p_case_id);
  if pin.id is null then raise exception 'GBP_BRANCH_UNAVAILABLE'; end if;
  if pin.evidence->>'public_gbp_url' is distinct from p_public_gbp_url then raise exception 'GBP_BRANCH_CONFLICT'; end if;
  if binding.workflow_id is not null then
    if (binding.user_id,binding.case_id,binding.confirmation_id) is distinct from (p_user_id,p_case_id,p_confirmation_id)
      then raise exception 'GBP_BRANCH_CONFLICT'; end if;
  else
    if exists(select 1 from public.workflow_charges w where w.id=p_workflow_id) then raise exception 'GBP_BRANCH_CONFLICT'; end if;
    if pin.evidence->>'domain' is distinct from c.normalized_domain or (pin.evidence->>'expires_at')::timestamptz <= clock_timestamp()
      then raise exception 'GBP_BRANCH_EVIDENCE_EXPIRED'; end if;
  end if;
  if p_planning_revision is null then
    return query select * from public.start_v22_prospect_discovery(p_user_id,p_case_id,p_workflow_id,
      p_discovery_job_id,p_workflow_idempotency_key,p_task_idempotency_key);
  else
    return query select * from public.start_v22_prospect_discovery_with_keywords(p_user_id,p_case_id,p_workflow_id,
      p_discovery_job_id,p_workflow_idempotency_key,p_task_idempotency_key,p_planning_revision,p_queries_canonical,p_keyword_scope);
  end if;
  if binding.workflow_id is null then
    insert into public.prospect_gbp_branch_bindings values (p_workflow_id,p_user_id,p_case_id,p_confirmation_id);
  end if;
end $$;

-- A job resolves its pin through the immutable workflow binding, including after a retry.
create function public.get_v22_acquisition_preflight_branch_pin(p_user_id uuid,p_case_id uuid,p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',i.id,'revision',i.revision,'confirmation_checksum',i.confirmation_checksum,
    'confirmed_at',to_char(i.confirmed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'confirmed_by',i.user_id,'reason',i.reason,'operating_mode',i.operating_mode,
    'customers_can_visit',i.customers_can_visit,'evidence',i.evidence)
  from public.capability_acquisition_preparations a
  join public.workflow_charges w on (w.analysis_job_id,w.user_id,w.case_id)=(a.job_id,a.user_id,a.case_id)
  join public.prospect_gbp_branch_bindings b on (b.workflow_id,b.user_id,b.case_id)=(w.id,w.user_id,w.case_id)
  join public.case_gbp_branch_confirmations i on (i.id,i.user_id,i.case_id)=(b.confirmation_id,b.user_id,b.case_id)
  where (a.user_id,a.case_id,a.job_id)=(p_user_id,p_case_id,p_job_id);
$$;

create function public.validate_v22_preflight_branch_pin(pin jsonb,m jsonb,pub jsonb) returns void
language plpgsql immutable set search_path=public as $$
declare proof jsonb=m->'identity_inheritance'; identity jsonb=pub->'business_identity';
  mode_ref jsonb=identity#>'{operating_model,confirmation_ref}'; visit_ref jsonb=identity#>'{operating_location,confirmation_ref}';
  source_ref text='preflight-branch-confirmation:'||(pin->>'id');
begin
  if proof->>'source_identity_version_id' is distinct from pin->>'id'
    or proof->>'source_identity_checksum' is distinct from pin->>'confirmation_checksum'
    or proof->>'source_revision' is distinct from pin->>'revision'
    or proof->>'confirmed_at' is distinct from pin->>'confirmed_at'
    or public.v22_review_hash(identity) is distinct from m->>'identity_checksum'
    or (proof->>'branch'='retained' and (identity->>'selected_branch_ref' is distinct from pin#>>'{evidence,branch_ref}'
      or identity->>'normalized_domain' is distinct from pin#>>'{evidence,domain}'
      or (m->>'evaluated_at')::timestamptz >= (pin#>>'{evidence,expires_at}')::timestamptz))
    or (proof->>'operating_model'='retained') is distinct from (mode_ref->>'confirmed_at' is not null)
    or (proof->>'operating_model'='retained' and (pin->>'operating_mode' is null
      or mode_ref->>'value' is distinct from pin->>'operating_mode'
      or mode_ref->>'confirmed_at' is distinct from pin->>'confirmed_at'
      or mode_ref->>'confirmed_by' is distinct from pin->>'confirmed_by'
      or mode_ref->>'reason' is distinct from pin->>'reason'
      or mode_ref->>'source_ref' is distinct from source_ref))
    or (proof->>'visits'='retained') is distinct from (visit_ref->>'confirmed_at' is not null)
    or (proof->>'visits'='retained' and (pin->>'customers_can_visit' is distinct from 'true'
      or visit_ref->>'confirmed_at' is distinct from pin->>'confirmed_at'
      or visit_ref->>'confirmed_by' is distinct from pin->>'confirmed_by'
      or visit_ref->>'source_ref' is distinct from source_ref
      or visit_ref->>'source_identity_version_id' is distinct from pin->>'id'))
  then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
end $$;

revoke all on function public.save_v22_preflight_branch_confirmation(uuid,uuid,uuid,jsonb,text,text,boolean),
  public.start_v22_prospect_discovery_with_branch(uuid,uuid,uuid,uuid,text,text,uuid,text,integer,text,jsonb),
  public.get_v22_acquisition_preflight_branch_pin(uuid,uuid,uuid),public.validate_v22_preflight_branch_pin(jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.save_v22_preflight_branch_confirmation(uuid,uuid,uuid,jsonb,text,text,boolean),
  public.start_v22_prospect_discovery_with_branch(uuid,uuid,uuid,uuid,text,text,uuid,text,integer,text,jsonb),
  public.get_v22_acquisition_preflight_branch_pin(uuid,uuid,uuid),public.validate_v22_preflight_branch_pin(jsonb,jsonb,jsonb)
  to service_role;

-- These two patches keep the v21 envelope and the existing validator on old pins.
do $migration$
declare def text; code text; acl aclitem[]; target regprocedure; previous text; replacement text;
begin
  target='public.get_v22_acquisition_identity_pin(uuid,uuid,uuid)'::regprocedure;
  select pg_get_functiondef(oid),prosrc,proacl into strict def,code,acl from pg_proc where oid=target;
  if md5(code)<>'c5b43881b32206404728eee0aa1581d0' or md5(def)<>'cd5e1b4e97db6ea3408bc954d9966bf7' then raise exception 'GBP_BRANCH_BASELINE_MISMATCH_GET'; end if;
  previous=$old$ select jsonb_build_object('id',i.id$old$;
  replacement=$new$ select coalesce(public.get_v22_acquisition_preflight_branch_pin(p_user_id,p_case_id,p_job_id), (select jsonb_build_object('id',i.id$new$;
  if position(previous in def)=0 then raise exception 'GBP_BRANCH_MIGRATION_TARGET_MISSING'; end if;
  def=replace(def,previous,replacement);
  previous=$old$ where (a.user_id,a.case_id,a.job_id)=(p_user_id,p_case_id,p_job_id);$old$;
  if position(previous in def)=0 then raise exception 'GBP_BRANCH_MIGRATION_TARGET_MISSING'; end if;
  execute replace(def,previous,$new$ where (a.user_id,a.case_id,a.job_id)=(p_user_id,p_case_id,p_job_id)));$new$);
  if exists(select 1 from pg_proc where oid=target and (proacl is distinct from acl
        or md5(prosrc)<>'82538528d0f425783331731c1db963f1'
        or md5(pg_get_functiondef(oid))<>'7e3142104d5694b4991209b4e3cbd85c'))
      then raise exception 'GBP_BRANCH_GET_TARGET_MISMATCH'; end if;

  target='public.check_v22_acquisition_preparation_binding()'::regprocedure;
  select pg_get_functiondef(oid),prosrc,proacl into strict def,code,acl from pg_proc where oid=target;
  if md5(code)<>'a7b580ab49bd47e691d0714f3b657eff' or md5(def)<>'be1765884415dbe8b4664c86ccc9fe00' then raise exception 'GBP_BRANCH_BASELINE_MISMATCH_BINDING'; end if;
  previous=$old$proof jsonb; pinned public.case_business_identity_versions;$old$;
  if position(previous in def)=0 then raise exception 'GBP_BRANCH_MIGRATION_TARGET_MISSING'; end if;
  def=replace(def,previous,$new$proof jsonb; pinned public.case_business_identity_versions; branch_pin jsonb;$new$);
  previous=$old$      select 1 from public.case_business_identity_versions i where i.id=prep.pinned_identity_version_id$old$;
  if position(previous in def)=0 then raise exception 'GBP_BRANCH_MIGRATION_TARGET_MISSING'; end if;
  def=replace(def,previous,$new$      select 1 where (public.get_v22_acquisition_preflight_branch_pin(new.user_id,new.case_id,new.job_id)->>'id') =
        new.payload#>>'{identity_inheritance,source_identity_version_id}'
      union all
      select 1 from public.case_business_identity_versions i where i.id=prep.pinned_identity_version_id$new$);
  previous=$old$      if m.payload->>'ruleset_version'='v22_capability_public_v21' then
        proof=m.payload->'identity_inheritance';$old$;
  if position(previous in def)=0 then raise exception 'GBP_BRANCH_MIGRATION_TARGET_MISSING'; end if;
  execute replace(def,previous,$new$      branch_pin=public.get_v22_acquisition_preflight_branch_pin(prep.user_id,prep.case_id,m.job_id);
      if m.payload->>'ruleset_version'='v22_capability_public_v21' and branch_pin is not null then
        perform public.validate_v22_preflight_branch_pin(branch_pin,m.payload,pub);
      elsif m.payload->>'ruleset_version'='v22_capability_public_v21' then
        proof=m.payload->'identity_inheritance';$new$);
  if exists(select 1 from pg_proc where oid=target and (proacl is distinct from acl
        or md5(prosrc)<>'6edb7a3fb074a371044bb09c7dca2506'
        or md5(pg_get_functiondef(oid))<>'4288d622a353b963ac040f5277b4230e'))
      then raise exception 'GBP_BRANCH_BINDING_TARGET_MISMATCH'; end if;
end $migration$;
commit;
