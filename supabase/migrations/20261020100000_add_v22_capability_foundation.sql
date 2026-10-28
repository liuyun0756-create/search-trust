-- P1 compatible foundations. No new public intake, debit or settlement path.
begin;

create table public.case_business_scope_versions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  revision integer not null check (revision > 0),
  scope jsonb not null check (jsonb_typeof(scope) = 'object'),
  created_at timestamptz not null default now(),
  unique (case_id, revision)
);

create table public.analysis_input_manifests (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  job_id uuid not null unique references public.analysis_jobs(id) on delete cascade,
  business_version_id uuid not null references public.case_business_scope_versions(id) deferrable initially deferred,
  mode text not null check (mode in ('acquisition','after_acquisition','first_service','review')),
  input_checksum text not null check (input_checksum ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.analysis_manifest_snapshots (
  manifest_id uuid not null references public.analysis_input_manifests(id) on delete cascade,
  snapshot_id uuid not null references public.data_snapshots(id) deferrable initially deferred,
  source_kind text not null check (source_kind in ('site','serp','competitor','public_gbp','gsc','ga4','official_gbp')),
  primary key (manifest_id, snapshot_id),
  unique (manifest_id, source_kind)
);

-- New payloads remain separate from immutable historical ReportV22 JSON.
-- P2 attaches validated generated results; P3 supplies the new start workflow.
create table public.capability_report_versions (
  id uuid primary key references public.analysis_jobs(id) on delete cascade,
  manifest_id uuid not null unique references public.analysis_input_manifests(id) deferrable initially deferred,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  schema_version text not null check (schema_version = '2.2.2'),
  payload_checksum text not null check (payload_checksum ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.report_content_revisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.capability_report_versions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  revision integer not null check (revision > 0),
  status text not null check (status in ('draft','approved')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (report_id, revision),
  check ((status = 'approved') = (approved_at is not null))
);

alter table public.analysis_input_manifests
  add column previous_legacy_report_id uuid references public.reports(id) deferrable initially deferred,
  add column previous_capability_report_id uuid references public.capability_report_versions(id) deferrable initially deferred,
  add constraint capability_previous_report_binding check (
    (mode in ('acquisition','first_service') and previous_legacy_report_id is null and previous_capability_report_id is null)
    or (mode in ('after_acquisition','review') and num_nonnulls(previous_legacy_report_id,previous_capability_report_id)=1)
  );

create function public.reject_v22_capability_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'CAPABILITY_VERSION_IMMUTABLE';
end;
$$;

do $$
declare item text;
begin
  foreach item in array array['case_business_scope_versions','analysis_input_manifests',
    'analysis_manifest_snapshots','capability_report_versions','report_content_revisions'] loop
    execute format('alter table public.%I enable row level security', item);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', item);
    execute format('grant select on public.%I to service_role', item);
    execute format('create trigger immutable_capability_version before update or delete on public.%I for each row execute function public.reject_v22_capability_mutation()', item);
  end loop;
end;
$$;

create function public.save_v22_business_scope(p_user_id uuid, p_case_id uuid, p_expected_revision integer, p_scope jsonb)
returns public.case_business_scope_versions
language plpgsql security definer set search_path = public as $$
declare current_revision integer; saved public.case_business_scope_versions; case_domain text; site text; domains text[]='{}'; domain text;
begin
  select normalized_domain into case_domain from public.client_cases where id=p_case_id and user_id=p_user_id and status='active' for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  if jsonb_typeof(p_scope) is distinct from 'object' or octet_length(p_scope::text)>50000
    or p_scope->>'user_id' is distinct from p_user_id::text or p_scope->>'case_id' is distinct from p_case_id::text
    or (p_scope->>'revision')::integer is distinct from p_expected_revision+1
    or coalesce(p_scope->>'confirmation_source','') not in ('seo_confirmation','client_confirmation')
    or jsonb_typeof(p_scope->'competitor_sites') is distinct from 'array'
    or jsonb_array_length(p_scope->'competitor_sites') not between 1 and 3
    or coalesce(length(btrim(p_scope->>'primary_service')),0) not between 1 and 200
    or coalesce(length(btrim(p_scope->>'target_market')),0) not between 1 and 200
    or p_scope->>'confirmed_at' is null or (p_scope->>'confirmed_at')::timestamptz > now() then
    raise exception 'CAPABILITY_BUSINESS_INVALID';
  end if;
  for site in select p_scope->>'site_url' union all select value#>>'{}' from jsonb_array_elements(p_scope->'competitor_sites') loop
    if site is null or site !~ '^https?://[^/@[:space:]]+([/][^[:space:]]*)?$' then raise exception 'CAPABILITY_BUSINESS_INVALID'; end if;
    domain=regexp_replace(lower(split_part(split_part(regexp_replace(site,'^https?://',''), '/', 1),':',1)), '^www[.]','');
    if domain=any(domains) then raise exception 'CAPABILITY_BUSINESS_INVALID'; end if;
    domains=array_append(domains,domain);
  end loop;
  if regexp_replace(lower(split_part(split_part(regexp_replace(p_scope->>'site_url','^https?://',''), '/', 1),':',1)), '^www[.]','')
    is distinct from regexp_replace(case_domain,'^www[.]','') then raise exception 'CAPABILITY_BUSINESS_MISMATCH'; end if;
  select coalesce(max(revision),0) into current_revision from public.case_business_scope_versions where case_id=p_case_id;
  if p_expected_revision is distinct from current_revision then raise exception 'CAPABILITY_REVISION_CONFLICT' using errcode='40001'; end if;
  insert into public.case_business_scope_versions(id,user_id,case_id,revision,scope)
    values ((p_scope->>'id')::uuid,p_user_id,p_case_id,current_revision+1,p_scope) returning * into saved;
  return saved;
end;
$$;

create function public.freeze_v22_analysis_manifest(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_manifest jsonb,p_canonical_content text,p_previous_canonical text default null)
returns public.analysis_input_manifests
language plpgsql security definer set search_path = public as $$
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
    or p_manifest->>'schema_version' is distinct from 'v22_analysis_input_v1'
    or p_manifest->>'user_id' is distinct from p_user_id::text or p_manifest->>'case_id' is distinct from p_case_id::text
    or p_manifest->>'job_id' is distinct from p_job_id::text
    or (p_manifest-'input_checksum') is distinct from p_canonical_content::jsonb
    or p_manifest->>'input_checksum' is distinct from 'sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex') then
    raise exception 'CAPABILITY_MANIFEST_INVALID';
  end if;
  kind=p_manifest->>'mode';
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
  if kinds is distinct from required and (kind='acquisition' or kinds is distinct from required||array['official_gbp']) then raise exception 'CAPABILITY_SOURCES_INVALID'; end if;
  for source in select value from jsonb_array_elements(p_manifest->'snapshots') loop
    select * into snapshot from public.data_snapshots where id=(source->>'snapshot_id')::uuid and case_id=p_case_id;
    expected_schema=case source->>'source_kind'
      when 'site' then 'site_inventory_snapshot_v1' when 'serp' then 'serp_market_snapshot_v1'
      when 'competitor' then 'competitor_collection_snapshot_v1' when 'public_gbp' then 'customer_public_gbp_snapshot_v1'
      when 'gsc' then 'gsc_sync_v1' when 'ga4' then 'ga4_sync_v1' when 'official_gbp' then 'gbp_sync_v1' end;
    if snapshot.id is null or snapshot.payload_checksum is distinct from source->>'payload_checksum'
      or snapshot.schema_version is distinct from expected_schema or source->>'schema_version' is distinct from expected_schema
      or snapshot.source_type is distinct from (case when source->>'source_kind' in ('public_gbp','official_gbp') then 'gbp' else source->>'source_kind' end)
      or source->>'case_id' is distinct from p_case_id::text or snapshot.health_status <> 'healthy'
      or source->>'health' is distinct from 'healthy' or source->>'identity_match' is distinct from 'matched'
      or snapshot.fetched_at is distinct from (source->>'fetched_at')::timestamptz
      or snapshot.expires_at is null or snapshot.expires_at is distinct from (source->>'expires_at')::timestamptz
      or snapshot.fetched_at>evaluation or snapshot.expires_at<=now()
      or snapshot.binding_id is distinct from (source->>'binding_id')::uuid then
      raise exception 'CAPABILITY_SNAPSHOT_INVALID';
    end if;
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
$$;

revoke all on function public.save_v22_business_scope(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_v22_business_scope(uuid,uuid,integer,jsonb) to service_role;
revoke all on function public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text) to service_role;

create function public.store_v22_capability_report(p_user_id uuid,p_case_id uuid,p_job_id uuid,p_payload jsonb,p_canonical_content text,p_run_generation integer default 1)
returns public.capability_report_versions
language plpgsql security definer set search_path=public as $$
declare manifest public.analysis_input_manifests; saved public.capability_report_versions; checksum text;
begin
  perform 1 from public.client_cases where id=p_case_id and user_id=p_user_id for update;
  if not found then raise exception 'CAPABILITY_CASE_NOT_FOUND'; end if;
  select * into manifest from public.analysis_input_manifests where job_id=p_job_id and user_id=p_user_id and case_id=p_case_id;
  if not found then raise exception 'CAPABILITY_MANIFEST_NOT_FOUND'; end if;
  checksum='sha256:'||encode(sha256(convert_to(p_canonical_content,'UTF8')),'hex');
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_canonical_content)>2000000
    or p_payload is distinct from p_canonical_content::jsonb or p_payload->>'schema_version' is distinct from '2.2.2'
    or p_payload->>'id' is distinct from p_job_id::text or p_payload->'input_manifest' is distinct from manifest.payload
    or p_payload->>'report_type' is distinct from (case when manifest.mode='acquisition' then 'prospect' else 'verified_execution' end)
    or p_payload->>'settlement_policy' is distinct from 'one_credit_per_completed_analysis'
    or coalesce(p_payload->>'action_state','') not in ('actions_supported','insufficient_basis')
    or jsonb_typeof(p_payload->'actions') is distinct from 'array' or jsonb_array_length(p_payload->'actions')>3
    or ((jsonb_array_length(p_payload->'actions')>0) is distinct from (p_payload->>'action_state'='actions_supported')) then
    raise exception 'CAPABILITY_REPORT_INVALID';
  end if;
  select * into saved from public.capability_report_versions where id=p_job_id;
  if found then
    if saved.payload is distinct from p_payload then raise exception 'CAPABILITY_REPORT_CONFLICT' using errcode='40001'; end if;
    return saved;
  end if;
  perform 1 from public.analysis_jobs where id=p_job_id and case_id=p_case_id for update;
  if not exists (select 1 from public.analysis_jobs j join public.workflow_charges c on c.analysis_job_id=j.id
    where j.id=p_job_id and j.case_id=p_case_id and j.status in ('queued','running') and j.run_generation=p_run_generation
      and c.user_id=p_user_id and c.case_id=p_case_id and c.state='reserved') then raise exception 'CAPABILITY_GENERATION_NOT_ACTIVE'; end if;
  insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
    values(p_job_id,manifest.id,p_user_id,p_case_id,'2.2.2',checksum,p_payload) returning * into saved;
  return saved;
end;
$$;

create function public.save_v22_report_content_revision(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_content jsonb)
returns public.report_content_revisions
language plpgsql security definer set search_path=public as $$
declare report public.capability_report_versions; saved public.report_content_revisions;
  current_revision integer; expected_ids text[]; actual_ids text[]; item jsonb; field text; text_value jsonb;
begin
  select * into report from public.capability_report_versions where id=p_report_id and user_id=p_user_id and case_id=p_case_id for update;
  if not found then raise exception 'CAPABILITY_REPORT_NOT_FOUND'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or octet_length(p_content::text)>100000
    or p_content->>'schema_version' is distinct from 'v22_delivery_revision_v1'
    or p_content->>'report_id' is distinct from p_report_id::text or p_content->>'case_id' is distinct from p_case_id::text
    or p_content->>'user_id' is distinct from p_user_id::text or p_content->>'source_checksum' is distinct from report.payload_checksum
    or coalesce(p_content->>'status','') not in ('draft','approved')
    or jsonb_typeof(p_content->'actions') is distinct from 'array'
    or p_content-array['schema_version','report_id','user_id','case_id','expected_revision','source_checksum','status','title','summary','client_note','actions'] <> '{}'::jsonb then
    raise exception 'CAPABILITY_REVISION_INVALID';
  end if;
  foreach field in array array['title','summary'] loop
    if jsonb_typeof(p_content->field) is distinct from 'string' or length(btrim(p_content->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then
      raise exception 'CAPABILITY_REVISION_INVALID';
    end if;
  end loop;
  if p_content->'client_note' is distinct from 'null'::jsonb and (jsonb_typeof(p_content->'client_note') is distinct from 'string'
    or length(btrim(p_content->>'client_note')) not between 1 and 2000) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into expected_ids from jsonb_array_elements(report.payload->'actions');
  select coalesce(array_agg(value->>'id' order by value->>'id'),'{}') into actual_ids from jsonb_array_elements(p_content->'actions');
  if expected_ids is distinct from actual_ids then raise exception 'CAPABILITY_ACTION_IDENTITY_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_content->'actions') loop
    if item-array['id','title','target','steps','completion','review'] <> '{}'::jsonb then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    foreach field in array array['title','target','review'] loop
      if jsonb_typeof(item->field) is distinct from 'string' or length(btrim(item->>field)) not between 1 and (case when field='title' then 200 else 2000 end) then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
    end loop;
    foreach field in array array['steps','completion'] loop
      if jsonb_typeof(item->field) is distinct from 'array' or jsonb_array_length(item->field) not between 1 and 12 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      for text_value in select value from jsonb_array_elements(item->field) loop
        if jsonb_typeof(text_value) is distinct from 'string' or length(btrim(text_value#>>'{}')) not between 1 and 2000 then raise exception 'CAPABILITY_REVISION_INVALID'; end if;
      end loop;
    end loop;
  end loop;
  select coalesce(max(revision),0) into current_revision from public.report_content_revisions where report_id=p_report_id;
  if (p_content->>'expected_revision')::integer is distinct from current_revision then raise exception 'CAPABILITY_REVISION_CONFLICT' using errcode='40001'; end if;
  insert into public.report_content_revisions(report_id,user_id,case_id,revision,status,content,approved_at)
    values(p_report_id,p_user_id,p_case_id,current_revision+1,p_content->>'status',p_content,
      case when p_content->>'status'='approved' then now() else null end) returning * into saved;
  return saved;
end;
$$;

revoke all on function public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer) to service_role;
revoke all on function public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb) to service_role;

commit;
