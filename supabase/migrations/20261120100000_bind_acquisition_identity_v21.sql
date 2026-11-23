-- A3: pin the owner's saved confirmation before the worker starts.
-- Rollback definitions and checksum table are in docs/acquisition-plan/rollback/20261120100000.
begin;
alter table public.capability_acquisition_preparations
 add column pinned_identity_version_id uuid references public.case_business_identity_versions(id);

create function public.get_v22_acquisition_identity_pin(p_user_id uuid,p_case_id uuid,p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',i.id,'revision',i.revision,'identity',i.identity,'identity_checksum',i.identity_checksum,
  'entity_keys',coalesce((select jsonb_object_agg(k->>'kind',k->>'value')
    from jsonb_array_elements(g.record->'observed_entity_keys') k),'{}'::jsonb),
  'gbp_website_url',case when g.record#>>'{fields,website_url,state}'='observed' then g.record#>>'{fields,website_url,value}' end,
  'gbp_phone',case when g.record#>>'{fields,phone,state}'='observed' then g.record#>>'{fields,phone,value}' end,
  'phone_matched',exists(select 1 from jsonb_array_elements(b.payload->'contact_checks') c
    where c->>'field'='phone' and c->>'status'='confirmed' and c->>'result'='match'))
 from public.capability_acquisition_preparations a
 join public.case_business_identity_versions i on (i.id,i.user_id,i.case_id)=(a.pinned_identity_version_id,a.user_id,a.case_id)
 join public.capability_report_versions b on (b.id,b.user_id,b.case_id)=(i.base_report_id,i.user_id,i.case_id)
 left join lateral (
   select s.normalized_payload->'record' as record from public.analysis_manifest_snapshots ms
   join public.data_snapshots s on s.id=ms.snapshot_id where ms.manifest_id=b.manifest_id and ms.source_kind='public_gbp'
 ) g on true
 where (a.user_id,a.case_id,a.job_id)=(p_user_id,p_case_id,p_job_id);
$$;
revoke all on function public.get_v22_acquisition_identity_pin(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_acquisition_identity_pin(uuid,uuid,uuid) to service_role;

-- Layout validation projects only version selectors. All storage and hash checks keep the full v21 envelope.
create function public.v22_a3_manifest_shape(m jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare shape jsonb; proof jsonb; manifest_version text; ruleset text;
begin
 if m->>'schema_version' is distinct from 'v22_analysis_input_v11' and m->>'ruleset_version' is distinct from 'v22_capability_public_v21' then
   if m ? 'identity_inheritance' then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
   return m;
 end if;
 proof=m->'identity_inheritance'; ruleset=proof->>'base_ruleset';
 manifest_version=case ruleset when 'v22_capability_public_v13' then 'v22_analysis_input_v3' when 'v22_capability_public_v14' then 'v22_analysis_input_v4' when 'v22_capability_public_v15' then 'v22_analysis_input_v5' when 'v22_capability_public_v16' then 'v22_analysis_input_v6' when 'v22_capability_public_v17' then 'v22_analysis_input_v7' when 'v22_capability_public_v18' then 'v22_analysis_input_v8' when 'v22_capability_public_v20' then 'v22_analysis_input_v10' end;
 if m->>'schema_version' is distinct from 'v22_analysis_input_v11' or m->>'ruleset_version' is distinct from 'v22_capability_public_v21'
   or m->>'mode' is distinct from 'acquisition' or m ? 'execution_type' or manifest_version is null
   or jsonb_typeof(proof) is distinct from 'object'
   or not (proof ?& array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits'])
   or proof-array['base_ruleset','source_identity_version_id','source_identity_checksum','source_revision','confirmed_at','branch','operating_model','visits']<>'{}'::jsonb
   or coalesce(proof->>'source_identity_version_id','') !~ '^[a-f0-9-]{36}$'
   or coalesce(proof->>'source_identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
   or jsonb_typeof(proof->'source_revision')<>'number' or coalesce(proof->>'source_revision','') !~ '^[1-9][0-9]*$'
   or coalesce(proof->>'confirmed_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
   or (proof->>'confirmed_at')::timestamptz>(m->>'evaluated_at')::timestamptz
   or coalesce(proof->>'branch','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'operating_model','') not in ('retained','needs_confirmation')
   or coalesce(proof->>'visits','') not in ('retained','needs_confirmation','not_previously_confirmed')
   or (proof->>'branch'='needs_confirmation' and (proof->>'operating_model'='retained' or proof->>'visits'='retained'))
 then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
 return (m-'identity_inheritance') || jsonb_build_object('schema_version',manifest_version,'ruleset_version',ruleset);
end $$;
create function public.v22_a3_report_shape(p jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare shape jsonb; version text;
begin
 shape=public.v22_a3_manifest_shape(p->'input_manifest');
 if coalesce(p->>'schema_version'='2.2.16',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v21') then
   raise exception 'CAPABILITY_REPORT_INVALID';
 end if;
 if p->>'schema_version' is distinct from '2.2.16' then return p; end if;
 version=case shape->>'ruleset_version' when 'v22_capability_public_v13' then '2.2.8' when 'v22_capability_public_v14' then '2.2.9' when 'v22_capability_public_v15' then '2.2.10' when 'v22_capability_public_v16' then '2.2.11' when 'v22_capability_public_v17' then '2.2.12' when 'v22_capability_public_v18' then '2.2.13' when 'v22_capability_public_v20' then '2.2.15' end;
 return p || jsonb_build_object('schema_version',version,'input_manifest',shape);
end $$;
revoke all on function public.v22_a3_manifest_shape(jsonb),public.v22_a3_report_shape(jsonb) from public,anon,authenticated;
grant execute on function public.v22_a3_manifest_shape(jsonb),public.v22_a3_report_shape(jsonb) to service_role;


do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from 'b1678bd152a98eebbd2c832a0881e576' then
  raise exception 'A3_CONSTRAINT_BASELINE_MISMATCH_capability_report_input_variant';
 end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from '16c338e3b81dc2bbe8fad7adca72e25f' then
  raise exception 'A3_CONSTRAINT_BASELINE_MISMATCH_capability_report_versions_schema_version_check';
 end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text])));
end $constraint$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)'::regprocedure;
 if md5(definition)<>'fff88355e792c2fc78d3b8733209c00a' or (select md5(prosrc) from pg_proc where oid='public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)'::regprocedure)<>'52974b3e20b6e48f2fccf7cf81f06417'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_begin_v22_acquisition_preparation'; end if;
 prior := $old$    insert into public.capability_acquisition_preparations(job_id,user_id,case_id,business_version_id,request,request_checksum)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,body,checksum);
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_begin_v22_acquisition_preparation'; end if;
 definition := replace(definition,prior,$new$    insert into public.capability_acquisition_preparations(job_id,user_id,case_id,business_version_id,request,request_checksum,pinned_identity_version_id)
      values(p_job_id,p_user_id,p_case_id,p_business_version_id,body,checksum,
        (select id from public.case_business_identity_versions where case_id=p_case_id and user_id=p_user_id order by revision desc limit 1));
$new$);
 if md5(definition)<>'7e7ffb4ba653fd7a2feb519543814712' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_begin_v22_acquisition_preparation'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'c552a160f16d680f5877e55130537faa'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_begin_v22_acquisition_preparation'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(definition)<>'eb3a93fa608c8547641bc6d9b8d14fd8' or (select md5(prosrc) from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure)<>'6ccda16035beaa2295294312946f000b'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 prior := $old$declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,prior,$new$declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb; proof jsonb; pinned public.case_business_identity_versions;
$new$);
 prior := $old$    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,prior,$new$    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if new.payload->>'ruleset_version'='v22_capability_public_v21' and not exists (
      select 1 from public.case_business_identity_versions i where i.id=prep.pinned_identity_version_id
        and i.user_id=new.user_id and i.case_id=new.case_id
        and i.id::text=new.payload#>>'{identity_inheritance,source_identity_version_id}'
    ) then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
$new$);
 prior := $old$      req=prep.request->'analyze_request'; pub=new.recipe->'request';
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,prior,$new$      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      if m.payload->>'ruleset_version'='v22_capability_public_v21' then
        proof=m.payload->'identity_inheritance';
        select * into pinned from public.case_business_identity_versions
          where id=prep.pinned_identity_version_id and user_id=prep.user_id and case_id=prep.case_id;
        if pinned.id is null or proof->>'source_identity_version_id' is distinct from pinned.id::text
          or proof->>'source_identity_checksum' is distinct from pinned.identity_checksum
          or proof->>'source_revision' is distinct from pinned.revision::text
          or proof->>'confirmed_at' is distinct from pinned.identity#>>'{operating_model,confirmation_ref,confirmed_at}'
          or public.v22_review_hash(pub->'business_identity') is distinct from m.payload->>'identity_checksum'
          or (proof->>'branch'='retained' and pub#>>'{business_identity,selected_branch_ref}' is distinct from pinned.identity->>'selected_branch_ref')
          or (proof->>'operating_model'='retained') is distinct from (pub#>>'{business_identity,operating_model,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'operating_model'='retained' and
              ((pub#>'{business_identity,operating_model,confirmation_ref}')-'evidence_checksum') is distinct from
              ((pinned.identity#>'{operating_model,confirmation_ref}')-'evidence_checksum'))
          or (proof->>'visits'='retained') is distinct from (pub#>>'{business_identity,operating_location,confirmation_ref,confirmed_at}' is not null)
          or (proof->>'visits'='retained' and
              ((pub#>'{business_identity,operating_location,confirmation_ref}')-array['address','source_identity_version_id']) is distinct from
              ((pinned.identity#>'{operating_location,confirmation_ref}')-'address'))
          or (proof->>'visits'='retained' and pub#>>'{business_identity,operating_location,confirmation_ref,source_identity_version_id}' is distinct from pinned.id::text)
        then raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
      end if;
$new$);
 prior := $old$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'),false)
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,prior,$new$          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21'),false)
$new$);
 if md5(definition)<>'be1765884415dbe8b4664c86ccc9fe00' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'a7b580ab49bd47e691d0714f3b657eff'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(definition)<>'d3b6d324634673ff72c44f08433fc793' or (select md5(prosrc) from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure)<>'ea5bbd5bb2d13703f6c24347b96190ff'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 prior := $old$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_enforce_v22_delivery_prerequisites'; end if;
 definition := replace(definition,prior,$new$  if report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') then
$new$);
 if md5(definition)<>'a4740fc94671d835351a1ce23549e339' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'38fa04c7fbfaeed6717ca885e0bbc47e'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(definition)<>'02006f638ef65f53f8116ae90a926729' or (select md5(prosrc) from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure)<>'f7765af77b2f63627f05c22197aa7770'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_freeze_v22_analysis_manifest'; end if;
 prior := $old$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  previous_payload jsonb; previous_legacy uuid; previous_capability uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_JOB_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id
    and case_id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CHARGE_NOT_FOUND'; end if;
  select * into saved from public.analysis_input_manifests where job_id=p_job_id;
  if found then
    if saved.payload is distinct from p_manifest then raise exception 'CAPABILITY_INPUT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  if job.status not in ('queued','running') or charge.state <> 'reserved'
    or not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
      and l.case_id=p_case_id and l.delta=-1 and l.kind=charge.workflow_kind||'_debit') then
    raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED';
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(p_manifest->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if p_manifest->>'mode' is distinct from 'acquisition'
      or coalesce(p_manifest->>'identity_version_id','') !~ '^[a-f0-9-]{36}$'
      or coalesce(p_manifest->>'identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
      or p_manifest->>'evidence_as_of' is distinct from p_manifest->>'evaluated_at'
      or jsonb_typeof(p_manifest->'target_market') is distinct from 'object'
      or p_manifest#>>'{target_market,display_name}' is distinct from p_manifest#>>'{business,target_market}'
      or p_manifest->'target_market' is distinct from (select target_market from public.client_cases where id=p_case_id)
    then raise exception 'CAPABILITY_IDENTITY_BINDING_INVALID'; end if;
  elsif p_manifest ?| array['identity_version_id','identity_checksum','target_market','evidence_as_of'] then
    raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID';
  end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v10') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v20') then raise exception 'CAPABILITY_ACTION_ADVICE_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v8') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v7') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v6') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version'='v22_analysis_input_v5') is distinct from (p_manifest->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (p_manifest->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if p_manifest->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(p_manifest->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'))
    or p_manifest->>'schema_version'='v22_analysis_input_v1' and p_manifest->>'ruleset_version'='v22_capability_public_v7'
    then raise exception 'CAPABILITY_RENDER_VERSION_INVALID'; end if;
  if kind not in ('acquisition','after_acquisition','first_service') then
    -- Review needs implementation ownership/qualification added in P5.
    raise exception 'CAPABILITY_MODE_NOT_ENABLED';
  end if;
  if charge.workflow_kind is distinct from (case when kind='acquisition' then 'prospect' else 'verified' end)
    or job.job_type is distinct from (case when kind='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_WORKFLOW_MISMATCH';
  end if;
  evaluation=(p_manifest->>'evaluated_at')::timestamptz;
  if evaluation is null or evaluation>now() or evaluation<now()-interval '5 minutes' then raise exception 'CAPABILITY_EVALUATION_STALE'; end if;
  select * into business from public.case_business_scope_versions where id=(p_manifest#>>'{business,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if not found or business.scope is distinct from p_manifest->'business' then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if (business.scope->>'confirmed_at')::timestamptz > evaluation then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if kind in ('acquisition','first_service') and ((p_manifest->'previous_report') is distinct from 'null'::jsonb or p_previous_canonical is not null) then
    raise exception 'CAPABILITY_INITIAL_HISTORY_FORBIDDEN';
  end if;
  if (p_manifest->'implementation') is distinct from 'null'::jsonb then raise exception 'CAPABILITY_IMPLEMENTATION_UNSUPPORTED'; end if;
  if kind='after_acquisition' then
    select report_v2_2,id into previous_payload,previous_legacy from public.reports
      where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
        and report_type='prospect' and status='paid_full' and version_number=(p_manifest#>>'{previous_report,version}')::integer;
    if not found then
      select payload,id into previous_payload,previous_capability from public.capability_report_versions
        where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
          and payload->>'report_type'='prospect' and (payload->>'version')::integer=(p_manifest#>>'{previous_report,version}')::integer;
    end if;
    if previous_payload is null or p_previous_canonical is null or previous_payload is distinct from p_previous_canonical::jsonb
      or p_manifest#>>'{previous_report,case_id}' is distinct from p_case_id::text
      or p_manifest#>>'{previous_report,report_type}' is distinct from 'prospect'
      or p_manifest#>>'{previous_report,payload_checksum}' is distinct from 'sha256:'||encode(sha256(convert_to(p_previous_canonical,'UTF8')),'hex') then
      raise exception 'CAPABILITY_HISTORY_INVALID';
    end if;
  end if;
  if jsonb_typeof(p_manifest->'snapshots') is distinct from 'array' then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  select array_agg(value->>'source_kind' order by ordinal) into kinds from jsonb_array_elements(p_manifest->'snapshots') with ordinality t(value,ordinal);
  required=case when kind='acquisition' then array['site','serp','competitor','public_gbp'] else array['site','serp','competitor','public_gbp','gsc','ga4'] end;
  if p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when p_manifest->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')
          and source->>'schema_version'='site_inventory_snapshot_v2'
        then 'site_inventory_snapshot_v2' else 'site_inventory_snapshot_v1' end when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then case
        when source->>'schema_version'='customer_public_gbp_snapshot_v2'
        then 'customer_public_gbp_snapshot_v2' else 'customer_public_gbp_snapshot_v1' end
      when 'gsc' then 'gsc_sync_v1' when 'ga4' then 'ga4_sync_v1' when 'official_gbp' then 'gbp_sync_v1' end;
    if snapshot.id is null or snapshot.payload_checksum is distinct from source->>'payload_checksum'
      or snapshot.schema_version is distinct from expected_schema or source->>'schema_version' is distinct from expected_schema
      or snapshot.source_type is distinct from (case when source->>'source_kind' in ('public_gbp','official_gbp') then 'gbp' when source->>'source_kind'='rendered' then 'site' else source->>'source_kind' end)
      or source->>'case_id' is distinct from p_case_id::text or snapshot.health_status <> 'healthy'
      or source->>'health' is distinct from 'healthy' or source->>'identity_match' is distinct from 'matched'
      or snapshot.fetched_at is distinct from (source->>'fetched_at')::timestamptz
      or snapshot.expires_at is null or snapshot.expires_at is distinct from (source->>'expires_at')::timestamptz
      or snapshot.fetched_at>evaluation or snapshot.expires_at<=now()
      or snapshot.binding_id is distinct from (source->>'binding_id')::uuid then
      raise exception 'CAPABILITY_SNAPSHOT_INVALID';
    end if;
    if source->>'source_kind'='rendered' and (
      snapshot.normalized_payload->>'source_kind' is distinct from 'rendered'
      or snapshot.normalized_payload->>'root_url' is distinct from p_manifest#>>'{business,site_url}'
      or snapshot.normalized_payload->>'static_payload_checksum' is distinct from
        (select value->>'payload_checksum' from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'='site'))
      then raise exception 'CAPABILITY_RENDER_BINDING_INVALID'; end if;
    if source->>'source_kind'='public_gbp' and (
      snapshot.normalized_payload->>'identity_match_status' is distinct from 'matched'
      or snapshot.normalized_payload->>'health_status' is distinct from 'healthy') then raise exception 'CAPABILITY_GBP_INVALID'; end if;
    if source->>'source_kind' in ('gsc','ga4','official_gbp') then
      select * into binding from public.case_source_bindings where id=snapshot.binding_id and case_id=p_case_id;
      if binding.id is null or not binding.is_active or binding.identity_match_status<>'matched' or binding.health_status<>'healthy'
        or binding.source_type is distinct from snapshot.source_type
        or not exists (select 1 from public.google_connections where id=binding.connection_id and user_id=p_user_id and status='active') then
        raise exception 'CAPABILITY_AUTHORIZATION_INVALID';
      end if;
    elsif snapshot.binding_id is not null then raise exception 'CAPABILITY_PUBLIC_BINDING_INVALID'; end if;
  end loop;
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload,previous_legacy_report_id,previous_capability_report_id)
    values ((p_manifest->>'id')::uuid,p_user_id,p_case_id,p_job_id,business.id,kind,p_manifest->>'input_checksum',p_manifest,previous_legacy,previous_capability) returning * into saved;
  insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind)
    select saved.id,(value->>'snapshot_id')::uuid,value->>'source_kind' from jsonb_array_elements(p_manifest->'snapshots');
  return saved;
end;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_freeze_v22_analysis_manifest'; end if;
 definition := replace(definition,prior,$new$
declare
  saved public.analysis_input_manifests;
  job public.analysis_jobs;
  charge public.workflow_charges;
  business public.case_business_scope_versions;
  source jsonb; snapshot public.data_snapshots; binding public.case_source_bindings;
  evaluation timestamptz; kind text; kinds text[]; required text[]; expected_schema text;
  a3_shape jsonb;
  previous_payload jsonb; previous_legacy uuid; previous_capability uuid;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into job from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_JOB_NOT_FOUND'; end if;
  select * into charge from public.workflow_charges where analysis_job_id=p_job_id
    and case_id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CHARGE_NOT_FOUND'; end if;
  select * into saved from public.analysis_input_manifests where job_id=p_job_id;
  if found then
    if saved.payload is distinct from p_manifest then raise exception 'CAPABILITY_INPUT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  if job.status not in ('queued','running') or charge.state <> 'reserved'
    or not exists (select 1 from public.credit_ledger l where l.workflow_charge_id=charge.id and l.user_id=p_user_id
      and l.case_id=p_case_id and l.delta=-1 and l.kind=charge.workflow_kind||'_debit') then
    raise exception 'CAPABILITY_WORKFLOW_NOT_RESERVED';
  end if;
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
  if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>100000
    or coalesce(a3_shape->>'schema_version','') not in ('v22_analysis_input_v1','v22_analysis_input_v2','v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if p_manifest->>'mode' is distinct from 'acquisition'
      or coalesce(p_manifest->>'identity_version_id','') !~ '^[a-f0-9-]{36}$'
      or coalesce(p_manifest->>'identity_checksum','') !~ '^sha256:[a-f0-9]{64}$'
      or p_manifest->>'evidence_as_of' is distinct from p_manifest->>'evaluated_at'
      or jsonb_typeof(p_manifest->'target_market') is distinct from 'object'
      or p_manifest#>>'{target_market,display_name}' is distinct from p_manifest#>>'{business,target_market}'
      or p_manifest->'target_market' is distinct from (select target_market from public.client_cases where id=p_case_id)
    then raise exception 'CAPABILITY_IDENTITY_BINDING_INVALID'; end if;
  elsif p_manifest ?| array['identity_version_id','identity_checksum','target_market','evidence_as_of'] then
    raise exception 'CAPABILITY_IDENTITY_VERSION_INVALID';
  end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v10') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v20') then raise exception 'CAPABILITY_ACTION_ADVICE_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v8') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v18') then raise exception 'CAPABILITY_LOCAL_ENTITY_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v7') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v17') then raise exception 'CAPABILITY_REASONS_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v6') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v16') then raise exception 'CAPABILITY_LANDING_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version'='v22_analysis_input_v5') is distinct from (a3_shape->>'ruleset_version'='v22_capability_public_v15') then raise exception 'CAPABILITY_GBP_VERSION_INVALID'; end if;
  if (a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10')) is distinct from (a3_shape->>'ruleset_version' in ('v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')) then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') then
    if jsonb_typeof(p_manifest->'keyword_queries') is distinct from 'array' or jsonb_array_length(p_manifest->'keyword_queries') not between 3 and 5
      or exists(select 1 from jsonb_array_elements(p_manifest->'keyword_queries') q where jsonb_typeof(q)<>'string' or length(btrim(q#>>'{}')) not between 1 and 300)
      or (select count(distinct lower(q#>>'{}')) from jsonb_array_elements(p_manifest->'keyword_queries') q)<>jsonb_array_length(p_manifest->'keyword_queries') then raise exception 'CAPABILITY_KEYWORDS_INVALID'; end if;
  elsif p_manifest ? 'keyword_queries' then raise exception 'CAPABILITY_KEYWORDS_VERSION_INVALID'; end if;
  kind=p_manifest->>'mode';
  if a3_shape->>'schema_version'='v22_analysis_input_v2' and
    (kind is distinct from 'acquisition' or coalesce(a3_shape->>'ruleset_version','') not in ('v22_capability_public_v7','v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20'))
    or a3_shape->>'schema_version'='v22_analysis_input_v1' and a3_shape->>'ruleset_version'='v22_capability_public_v7'
    then raise exception 'CAPABILITY_RENDER_VERSION_INVALID'; end if;
  if kind not in ('acquisition','after_acquisition','first_service') then
    -- Review needs implementation ownership/qualification added in P5.
    raise exception 'CAPABILITY_MODE_NOT_ENABLED';
  end if;
  if charge.workflow_kind is distinct from (case when kind='acquisition' then 'prospect' else 'verified' end)
    or job.job_type is distinct from (case when kind='acquisition' then 'prospect_report' else 'verified_report' end) then
    raise exception 'CAPABILITY_WORKFLOW_MISMATCH';
  end if;
  evaluation=(p_manifest->>'evaluated_at')::timestamptz;
  if evaluation is null or evaluation>now() or evaluation<now()-interval '5 minutes' then raise exception 'CAPABILITY_EVALUATION_STALE'; end if;
  select * into business from public.case_business_scope_versions where id=(p_manifest#>>'{business,id}')::uuid
    and user_id=p_user_id and case_id=p_case_id;
  if not found or business.scope is distinct from p_manifest->'business' then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if (business.scope->>'confirmed_at')::timestamptz > evaluation then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  if kind in ('acquisition','first_service') and ((p_manifest->'previous_report') is distinct from 'null'::jsonb or p_previous_canonical is not null) then
    raise exception 'CAPABILITY_INITIAL_HISTORY_FORBIDDEN';
  end if;
  if (p_manifest->'implementation') is distinct from 'null'::jsonb then raise exception 'CAPABILITY_IMPLEMENTATION_UNSUPPORTED'; end if;
  if kind='after_acquisition' then
    select report_v2_2,id into previous_payload,previous_legacy from public.reports
      where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
        and report_type='prospect' and status='paid_full' and version_number=(p_manifest#>>'{previous_report,version}')::integer;
    if not found then
      select payload,id into previous_payload,previous_capability from public.capability_report_versions
        where id=(p_manifest#>>'{previous_report,report_id}')::uuid and user_id=p_user_id and case_id=p_case_id
          and payload->>'report_type'='prospect' and (payload->>'version')::integer=(p_manifest#>>'{previous_report,version}')::integer;
    end if;
    if previous_payload is null or p_previous_canonical is null or previous_payload is distinct from p_previous_canonical::jsonb
      or p_manifest#>>'{previous_report,case_id}' is distinct from p_case_id::text
      or p_manifest#>>'{previous_report,report_type}' is distinct from 'prospect'
      or p_manifest#>>'{previous_report,payload_checksum}' is distinct from 'sha256:'||encode(sha256(convert_to(p_previous_canonical,'UTF8')),'hex') then
      raise exception 'CAPABILITY_HISTORY_INVALID';
    end if;
  end if;
  if jsonb_typeof(p_manifest->'snapshots') is distinct from 'array' then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  select array_agg(value->>'source_kind' order by ordinal) into kinds from jsonb_array_elements(p_manifest->'snapshots') with ordinality t(value,ordinal);
  required=case when kind='acquisition' then array['site','serp','competitor','public_gbp'] else array['site','serp','competitor','public_gbp','gsc','ga4'] end;
  if a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and 'rendered'=any(kinds)) then required=required||array['rendered']; end if;
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'rendered' then 'site_rendered_snapshot_v1' when 'site' then case
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and source->>'schema_version'='site_inventory_snapshot_v3' then 'site_inventory_snapshot_v3'
        when a3_shape->>'ruleset_version' in ('v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20')
          and source->>'schema_version'='site_inventory_snapshot_v2'
        then 'site_inventory_snapshot_v2' else 'site_inventory_snapshot_v1' end when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then case
        when source->>'schema_version'='customer_public_gbp_snapshot_v2'
        then 'customer_public_gbp_snapshot_v2' else 'customer_public_gbp_snapshot_v1' end
      when 'gsc' then 'gsc_sync_v1' when 'ga4' then 'ga4_sync_v1' when 'official_gbp' then 'gbp_sync_v1' end;
    if snapshot.id is null or snapshot.payload_checksum is distinct from source->>'payload_checksum'
      or snapshot.schema_version is distinct from expected_schema or source->>'schema_version' is distinct from expected_schema
      or snapshot.source_type is distinct from (case when source->>'source_kind' in ('public_gbp','official_gbp') then 'gbp' when source->>'source_kind'='rendered' then 'site' else source->>'source_kind' end)
      or source->>'case_id' is distinct from p_case_id::text or snapshot.health_status <> 'healthy'
      or source->>'health' is distinct from 'healthy' or source->>'identity_match' is distinct from 'matched'
      or snapshot.fetched_at is distinct from (source->>'fetched_at')::timestamptz
      or snapshot.expires_at is null or snapshot.expires_at is distinct from (source->>'expires_at')::timestamptz
      or snapshot.fetched_at>evaluation or snapshot.expires_at<=now()
      or snapshot.binding_id is distinct from (source->>'binding_id')::uuid then
      raise exception 'CAPABILITY_SNAPSHOT_INVALID';
    end if;
    if source->>'source_kind'='rendered' and (
      snapshot.normalized_payload->>'source_kind' is distinct from 'rendered'
      or snapshot.normalized_payload->>'root_url' is distinct from p_manifest#>>'{business,site_url}'
      or snapshot.normalized_payload->>'static_payload_checksum' is distinct from
        (select value->>'payload_checksum' from jsonb_array_elements(p_manifest->'snapshots') where value->>'source_kind'='site'))
      then raise exception 'CAPABILITY_RENDER_BINDING_INVALID'; end if;
    if source->>'source_kind'='public_gbp' and (
      snapshot.normalized_payload->>'identity_match_status' is distinct from 'matched'
      or snapshot.normalized_payload->>'health_status' is distinct from 'healthy') then raise exception 'CAPABILITY_GBP_INVALID'; end if;
    if source->>'source_kind' in ('gsc','ga4','official_gbp') then
      select * into binding from public.case_source_bindings where id=snapshot.binding_id and case_id=p_case_id;
      if binding.id is null or not binding.is_active or binding.identity_match_status<>'matched' or binding.health_status<>'healthy'
        or binding.source_type is distinct from snapshot.source_type
        or not exists (select 1 from public.google_connections where id=binding.connection_id and user_id=p_user_id and status='active') then
        raise exception 'CAPABILITY_AUTHORIZATION_INVALID';
      end if;
    elsif snapshot.binding_id is not null then raise exception 'CAPABILITY_PUBLIC_BINDING_INVALID'; end if;
  end loop;
  insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload,previous_legacy_report_id,previous_capability_report_id)
    values ((p_manifest->>'id')::uuid,p_user_id,p_case_id,p_job_id,business.id,kind,p_manifest->>'input_checksum',p_manifest,previous_legacy,previous_capability) returning * into saved;
  insert into public.analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind)
    select saved.id,(value->>'snapshot_id')::uuid,value->>'source_kind' from jsonb_array_elements(p_manifest->'snapshots');
  return saved;
end;
$new$);
 if md5(definition)<>'7f26b20183e9672aa0723062f9420291' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_freeze_v22_analysis_manifest'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'b570b42a415e852ebf420210d3f80ff6'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_freeze_v22_analysis_manifest'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(definition)<>'00e51f429b6e19380df377d1dae155a4' or (select md5(prosrc) from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure)<>'b18f8c8b763e4da941a397fdb5b2aa88'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_get_v22_completed_plan_source'; end if;
 prior := $old$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') then
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_get_v22_completed_plan_source'; end if;
 definition := replace(definition,prior,$new$  if r.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') then
$new$);
 if md5(definition)<>'c3b9f2f829513e4466215cb2d3f44920' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_get_v22_completed_plan_source'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'877ea62bdcc7322363938e4f5d9b6e8d'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_get_v22_completed_plan_source'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'458c732a46ccbf1671c2a16633d2e855' or (select md5(prosrc) from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure)<>'c570a9440f929a9f1b0b484479be7d2f'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_hydrate_v22_capability_generation_input'; end if;
 prior := $old$declare body jsonb; pub jsonb; source jsonb; ref jsonb; row public.data_snapshots;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_hydrate_v22_capability_generation_input'; end if;
 definition := replace(definition,prior,$new$declare a3_shape jsonb; body jsonb; pub jsonb; source jsonb; ref jsonb; row public.data_snapshots;
$new$);
 prior := $old$  if p_recipe->>'schema_version' is distinct from (case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 'v22_generation_recipe_v2' else 'v22_generation_recipe_v1' end)
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_hydrate_v22_capability_generation_input'; end if;
 definition := replace(definition,prior,$new$  a3_shape=public.v22_a3_manifest_shape(p_manifest);
  if p_recipe->>'schema_version' is distinct from (case when a3_shape->>'schema_version'='v22_analysis_input_v2' then 'v22_generation_recipe_v2' else 'v22_generation_recipe_v1' end)
$new$);
 prior := $old$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' or (p_manifest->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_hydrate_v22_capability_generation_input'; end if;
 definition := replace(definition,prior,$new$    or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape->>'schema_version' in ('v22_analysis_input_v3','v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_RECIPE_INVALID'; end if;
$new$);
 if md5(definition)<>'2a4dadd51fe51b3115e4d62ec0ca0965' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_hydrate_v22_capability_generation_input'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.hydrate_v22_capability_generation_input(jsonb,jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'ef22b646f4ba90b364e7acc175a57e30'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_hydrate_v22_capability_generation_input'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(definition)<>'aeb06d5e15fc006bb2af5785c66d6e2d' or (select md5(prosrc) from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure)<>'6950b9316ce591e0865a5d6e41aaa3f4'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_list_v22_completed_capability_reports'; end if;
 prior := $old$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_list_v22_completed_capability_reports'; end if;
 definition := replace(definition,prior,$new$  where candidate.user_id=p_user_id and candidate.schema_version in ('2.2.2','2.2.4','2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')
$new$);
 if md5(definition)<>'9b20332a342669a8d367b1c887956d21' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_list_v22_completed_capability_reports'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'e0b6181f3aee5ac5dbe721bf12247112'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_list_v22_completed_capability_reports'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'36152bfd22b17033e07db1a27861f9a4' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure)<>'f2adf04713918cfd7c76c9d22bca1bab'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 prior := $old$declare job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$declare a3_shape jsonb; job public.analysis_jobs; saved public.analysis_input_manifests; previous public.capability_generation_recipes;
$new$);
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$begin
  a3_shape=public.v22_a3_manifest_shape(p_manifest);
$new$);
 prior := $old$    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$    or (select count(*) from jsonb_object_keys(p_public_source_canonicals))<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21' and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then raise exception 'CAPABILITY_GENERATION_INPUT_INVALID'; end if;
$new$);
 prior := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and exists(
$new$);
 prior := $old$  if p_manifest->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$  if a3_shape->>'schema_version' in ('v22_analysis_input_v4','v22_analysis_input_v5','v22_analysis_input_v6','v22_analysis_input_v7','v22_analysis_input_v8','v22_analysis_input_v10') and (p_manifest->'keyword_queries' is distinct from pub#>'{evidence_input,context,queries}'
$new$);
 prior := $old$  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when p_manifest->>'schema_version'='v22_analysis_input_v2' then 5 else 4 end) then
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,prior,$new$  if jsonb_typeof(pub#>'{evidence_input,sources}') is distinct from 'array' or jsonb_array_length(pub#>'{evidence_input,sources}')<>(case when a3_shape->>'schema_version'='v22_analysis_input_v2' or (a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21' and exists(select 1 from jsonb_array_elements(p_manifest->'snapshots') s where s->>'source_kind'='rendered')) then 5 else 4 end) then
$new$);
 if md5(definition)<>'5902b9597dd7230ea4d3e03db1670553' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'4639d97f0df2dcbe623d258143cf1bea'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure;
 if md5(definition)<>'f48e7da63cd581065a2c87fb817219e3' or (select md5(prosrc) from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure)<>'da9350d5fa8819cafaca21936aaaca75'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_prepare_v22_public_reassessment'; end if;
 prior := $old$  ir integer; dr integer; source jsonb; hydrated jsonb; expected jsonb; visit boolean; location jsonb; confirmation jsonb; saved_address text;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_public_reassessment'; end if;
 definition := replace(definition,prior,$new$  ir integer; dr integer; source jsonb; hydrated jsonb; expected jsonb; visit boolean; location jsonb; confirmation jsonb; saved_address text; base_report_schema text;
$new$);
 prior := $old$  r=p_preview->'report';m=r->'input_manifest';
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_public_reassessment'; end if;
 definition := replace(definition,prior,$new$  r=p_preview->'report';m=r->'input_manifest';
  base_report_schema=public.v22_a3_report_shape(base.payload)->>'schema_version';
$new$);
 prior := $old$    or (base.schema_version='2.2.15') is distinct from (r->>'schema_version'='2.2.15')
    or (base.schema_version='2.2.13') is distinct from (r->>'schema_version'='2.2.13')
    or (base.schema_version='2.2.12') is distinct from (r->>'schema_version'='2.2.12')
    or (base.schema_version='2.2.11') is distinct from (r->>'schema_version'='2.2.11')
    or (base.schema_version='2.2.10') is distinct from (r->>'schema_version'='2.2.10')
    or (base.schema_version='2.2.9') is distinct from (r->>'schema_version'='2.2.9')
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_prepare_v22_public_reassessment'; end if;
 definition := replace(definition,prior,$new$    or (base_report_schema='2.2.15') is distinct from (r->>'schema_version'='2.2.15')
    or (base_report_schema='2.2.13') is distinct from (r->>'schema_version'='2.2.13')
    or (base_report_schema='2.2.12') is distinct from (r->>'schema_version'='2.2.12')
    or (base_report_schema='2.2.11') is distinct from (r->>'schema_version'='2.2.11')
    or (base_report_schema='2.2.10') is distinct from (r->>'schema_version'='2.2.10')
    or (base_report_schema='2.2.9') is distinct from (r->>'schema_version'='2.2.9')
$new$);
 if md5(definition)<>'94961785c9a230aa9f9ac550efabc1a5' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_prepare_v22_public_reassessment'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'dcd19f685b1c09b95c09a58ff98ee90e'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_prepare_v22_public_reassessment'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(definition)<>'1883f9c53bac6b0e37900e4796556453' or (select md5(prosrc) from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure)<>'5a91a7178eb64e426432b3e02b27ac9c'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_save_v22_report_content_revision'; end if;
 prior := $old$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_save_v22_report_content_revision'; end if;
 definition := replace(definition,prior,$new$  if (p_content->>'schema_version'='v22_delivery_revision_v3') is distinct from (report.payload->>'schema_version' in ('2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
$new$);
 prior := $old$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15')
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_save_v22_report_content_revision'; end if;
 definition := replace(definition,prior,$new$    if coalesce(report.payload->>'schema_version','') not in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16')
$new$);
 if md5(definition)<>'7e68875ac1eeec348c3e1d906312b014' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_save_v22_report_content_revision'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'38b98afa2a148d6c6cbbca7e262414ae'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_save_v22_report_content_revision'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(definition)<>'73477a140d0406edccafec15b18e4bff' or (select md5(prosrc) from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure)<>'d572f0259d97e4387b3571445989bd5e'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_store_v22_capability_report'; end if;
 prior := $old$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,prior,$new$    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from (case when manifest.payload->>'ruleset_version'='v22_capability_public_v21' then '2.2.16' when manifest.payload->>'ruleset_version'='v22_capability_public_v20' then '2.2.15' when manifest.payload->>'ruleset_version'='v22_capability_public_v18' then '2.2.13' when manifest.payload->>'ruleset_version'='v22_capability_public_v17' then '2.2.12' when manifest.payload->>'ruleset_version'='v22_capability_public_v16' then '2.2.11' when manifest.payload->>'ruleset_version'='v22_capability_public_v15' then '2.2.10' when manifest.payload->>'ruleset_version'='v22_capability_public_v14' then '2.2.9' when manifest.payload->>'ruleset_version'='v22_capability_public_v13' then '2.2.8'
$new$);
 prior := $old$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15') and (
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,prior,$new$  if p_payload->>'schema_version' in ('2.2.5','2.2.6','2.2.7','2.2.8','2.2.9','2.2.10','2.2.11','2.2.12','2.2.13','2.2.15','2.2.16') and (
$new$);
 prior := $old$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,prior,$new$  if manifest.payload->>'ruleset_version' in ('v22_capability_public_v8','v22_capability_public_v9','v22_capability_public_v10','v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') then
$new$);
 prior := $old$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') then 5 else 4 end)
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,prior,$new$      or jsonb_array_length(p_payload->'contact_checks') > (case when manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') then 5 else 4 end)
$new$);
 prior := $old$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20') and c->>'field'='opening_hours'))
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,prior,$new$          and not (manifest.payload->>'ruleset_version' in ('v22_capability_public_v11','v22_capability_public_v12','v22_capability_public_v13','v22_capability_public_v14','v22_capability_public_v15','v22_capability_public_v16','v22_capability_public_v17','v22_capability_public_v18','v22_capability_public_v20','v22_capability_public_v21') and c->>'field'='opening_hours'))
$new$);
 if md5(definition)<>'9a6b53b668e38d18dc61b38435ba0bc7' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_store_v22_capability_report'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'5cf5e7bd11e77a91dc871033a466b81b'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_store_v22_capability_report'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_action_advice(jsonb)'::regprocedure;
 if md5(definition)<>'3e8ba72f0694fab849447fe17678101a' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_action_advice(jsonb)'::regprocedure)<>'781dbabaa9d7fc052f9e7089cc59696e'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_action_advice'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_action_advice'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'3020e8c559b51dc39de4eab8a785fc38' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_action_advice'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_action_advice(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'5409ccf0bfdf87f56f44bed573da6fde'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_action_advice'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure;
 if md5(definition)<>'db5c2f952cd122383e926826f50a9711' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure)<>'c3c09663d8b75ad17f8c35fe972b1215'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_candidate_pool'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_candidate_pool'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'38828ac4baaa7a0fd74f4af51d4be0ef' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_candidate_pool'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_candidate_pool(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'25aea0e4348fe8b88edb7db8e621dac4'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_candidate_pool'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure;
 if md5(definition)<>'d7ee8d78b2c4c4b88518bab3c128921f' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure)<>'1c357bf64c945e897b0f85ad5c4a4761'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_candidate_selection'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_candidate_selection'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'c549b0040b25512de3fc0b51e06718ed' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_candidate_selection'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_candidate_selection(jsonb,jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'3d6097ac3c8f81e71380023c6e6c1069'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_candidate_selection'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(definition)<>'49f1317c82b800f3135b79a98e48263a' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure)<>'fbb49257bd7342006707fbb41737f4b2'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_gbp_comparison'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'b9c361b0d526b73dfbfd098e61c62932' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_gbp_comparison'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'11f8dd4be0107003131ab6ed0d5fdab4'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_gbp_comparison'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure;
 if md5(definition)<>'409689159eecb869681c52f7f419fb69' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure)<>'9002c0028e876da46324e5d3718d175c'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_keyword_visibility'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_keyword_visibility'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'c23c2f29f51b3c299141312f1ac5c5ab' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_keyword_visibility'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_keyword_visibility(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'8b82367e401fc438f70670762621339c'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_keyword_visibility'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure;
 if md5(definition)<>'7984aed02eead420d22a8dfa0434fa0c' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure)<>'867130da045a7b67bf2a6a2d1a68835c'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_landing_comparison'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_landing_comparison'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'1e2ca8f0022b58a86aa0ebdf7c52d092' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_landing_comparison'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'32512981319e07687544e7931f9b4608'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_landing_comparison'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure;
 if md5(definition)<>'819599f3a7e0815605865060a51f2956' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure)<>'5da5ca2a6ea78c3dbdee4c6d0973e2c8'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_local_entity_coverage'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_local_entity_coverage'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'e692962ff2599e936d00b5602c847c5f' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_local_entity_coverage'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_local_entity_coverage(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'6cd989fe2c4292c9a6315b173ac6dd2d'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_local_entity_coverage'; end if;
end $migration$;

do $migration$
declare definition text; prior text; prior_acl aclitem[];
begin
 select pg_get_functiondef(oid),proacl into strict definition,prior_acl from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure;
 if md5(definition)<>'25b02d2e6fca3f545e6cda062a9d172b' or (select md5(prosrc) from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure)<>'faa69f555c2ba7a3b35f755dd766d5b3'
 then raise exception 'A3_FUNCTION_BASELINE_MISMATCH_validate_v22_possible_reasons'; end if;
 prior := $old$begin
$old$;
 if position(prior in definition)=0 then raise exception 'A3_FUNCTION_TARGET_MISSING_validate_v22_possible_reasons'; end if;
 definition := replace(definition,prior,$new$begin
  p=public.v22_a3_report_shape(p);
$new$);
 if md5(definition)<>'42d7a9e494e803a43b8f85293fcd3b72' then raise exception 'A3_FUNCTION_TARGET_MISMATCH_validate_v22_possible_reasons'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure and
     (proacl is distinct from prior_acl or md5(prosrc)<>'8e1972d9941adf78324acf5e134ece9d'))
 then raise exception 'A3_FUNCTION_ACL_OR_SOURCE_MISMATCH_validate_v22_possible_reasons'; end if;
end $migration$;

commit;
