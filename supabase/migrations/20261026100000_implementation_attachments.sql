begin;

-- No file bytes or object names are added to immutable implementation payloads.
create table public.implementation_attachments (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  case_id uuid not null references public.client_cases(id),
  report_id uuid not null references public.capability_report_versions(id),
  delivery_revision_id uuid not null references public.report_content_revisions(id),
  record_id uuid not null,
  record_revision integer not null,
  record_checksum text not null,
  action_id text not null,
  file_name text not null check(length(file_name) between 1 and 160),
  mime text not null check(mime in ('image/png','image/jpeg','application/pdf')),
  byte_size integer not null check(byte_size between 1 and 2097152),
  digest text not null check(digest ~ '^[a-f0-9]{64}$'),
  object_key text not null unique,
  status text not null check(status in ('uploading','ready','removing','removed')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
  updated_at timestamptz not null default clock_timestamp(),
  cleanup_after timestamptz,
  cleaned_at timestamptz,
  foreign key(record_id,record_revision) references public.capability_implementation_records(id,revision)
);
create index implementation_attachment_case_time on public.implementation_attachments(case_id,created_at);
create index implementation_attachment_record on public.implementation_attachments(record_id,record_revision,action_id);
create table public.implementation_attachment_events (
  sequence bigint generated always as identity primary key,
  attachment_id uuid not null references public.implementation_attachments(id),
  event text not null check(event in ('reserved','ready','removing','removed')),
  recorded_at timestamptz not null default clock_timestamp(),
  unique(attachment_id,event)
);
alter table public.implementation_attachments enable row level security;
alter table public.implementation_attachment_events enable row level security;
revoke all on public.implementation_attachments,public.implementation_attachment_events from public,anon,authenticated,service_role;
create trigger immutable_attachment_events before update or delete on public.implementation_attachment_events
  for each row execute function public.reject_v22_capability_mutation();

create function public.v22_attachment_source(p_user uuid,p_case uuid,p_report uuid,p_delivery uuid,p_record uuid,p_revision integer,p_checksum text,p_action text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.client_cases where id=p_case and user_id=p_user and status='active' and archived_at is null)
    then raise exception 'ATTACHMENT_NOT_FOUND'; end if;
  perform public.v22_implementation_source(p_user,p_case,p_report,p_delivery);
  if not exists(select 1 from public.capability_implementation_records r where r.id=p_record and r.revision=p_revision
    and r.user_id=p_user and r.case_id=p_case and r.report_id=p_report and r.delivery_revision_id=p_delivery and r.checksum=p_checksum
    and exists(select 1 from jsonb_array_elements(r.payload->'entries') e where e->>'action_id'=p_action))
    then raise exception 'ATTACHMENT_NOT_FOUND'; end if;
end; $$;

-- Application receives storage keys only on its authenticated server boundary.
create function public.v22_attachments(p_user uuid,p_case uuid,p_report uuid,p_delivery uuid,p_record uuid,p_revision integer,p_checksum text,p_action text,
  p_operation text,p_id uuid default null,p_name text default null,p_mime text default null,p_size integer default null,p_digest text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.implementation_attachments; t timestamptz; fresh boolean=false;
begin
  perform public.v22_attachment_source(p_user,p_case,p_report,p_delivery,p_record,p_revision,p_checksum,p_action);
  if p_operation='list' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from
      (select * from public.implementation_attachments where user_id=p_user and case_id=p_case and report_id=p_report and delivery_revision_id=p_delivery
       and record_id=p_record and record_revision=p_revision and action_id=p_action order by created_at desc,id limit 100) x),'[]'::jsonb);
  end if;
  if p_id is null or p_operation not in ('read','reserve','finalize','remove') then raise exception 'ATTACHMENT_INVALID'; end if;
  -- Shared Case lock makes reservations and quota release serial; report lock matches implementation saves.
  if p_operation<>'read' then
    perform 1 from public.client_cases where id=p_case and user_id=p_user for update;
    perform 1 from public.capability_report_versions where id=p_report for update;
    perform public.v22_attachment_source(p_user,p_case,p_report,p_delivery,p_record,p_revision,p_checksum,p_action);
  end if;
  t=clock_timestamp();
  select * into a from public.implementation_attachments where id=p_id;
  if a.id is not null and (a.user_id<>p_user or a.case_id<>p_case or a.report_id<>p_report or a.delivery_revision_id<>p_delivery
    or a.record_id<>p_record or a.record_revision<>p_revision or a.record_checksum<>p_checksum or a.action_id<>p_action)
    then raise exception 'ATTACHMENT_NOT_FOUND'; end if;
  if p_operation='reserve' then
    if p_name is null or length(p_name) not between 1 and 160 or p_name ~ '[[:cntrl:]/\\]' or btrim(p_name)=''
      or p_mime is null or p_mime not in ('image/png','image/jpeg','application/pdf') or p_size is null or p_size not between 1 and 2097152
      or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'ATTACHMENT_INVALID'; end if;
    if a.id is not null then
      if a.file_name<>p_name or a.mime<>p_mime or a.byte_size<>p_size or a.digest<>p_digest then raise exception 'ATTACHMENT_CONFLICT'; end if;
      return jsonb_build_object('created',false,'attachment',to_jsonb(a));
    end if;
    if p_revision<>(select max(revision) from public.capability_implementation_records where delivery_revision_id=p_delivery)
      then raise exception 'ATTACHMENT_STALE'; end if;
    if (select count(*) from public.implementation_attachments where record_id=p_record and record_revision=p_revision and action_id=p_action and status<>'removed')>=5
      or (select coalesce(sum(byte_size),0) from public.implementation_attachments where case_id=p_case and cleaned_at is null)+p_size>104857600
      or (select count(*) from public.implementation_attachments where case_id=p_case and created_at>t-interval '24 hours')>=20
      then raise exception 'ATTACHMENT_LIMIT'; end if;
    insert into public.implementation_attachments(id,user_id,case_id,report_id,delivery_revision_id,record_id,record_revision,record_checksum,action_id,
      file_name,mime,byte_size,digest,object_key,status,created_at,expires_at,updated_at)
      values(p_id,p_user,p_case,p_report,p_delivery,p_record,p_revision,p_checksum,p_action,p_name,p_mime,p_size,p_digest,
        'files/'||p_id::text,'uploading',t,t+interval '15 minutes',t) returning * into a;
    insert into public.implementation_attachment_events(attachment_id,event) values(p_id,'reserved');
    return jsonb_build_object('created',true,'attachment',to_jsonb(a));
  end if;
  if a.id is null then raise exception 'ATTACHMENT_NOT_FOUND'; end if;
  if p_operation='finalize' and a.status<>'ready' then
    if a.status<>'uploading' or a.expires_at<=t then raise exception 'ATTACHMENT_EXPIRED'; end if;
    if p_revision<>(select max(revision) from public.capability_implementation_records where delivery_revision_id=p_delivery)
      then raise exception 'ATTACHMENT_STALE'; end if;
    if p_digest is distinct from a.digest or p_size is distinct from a.byte_size then raise exception 'ATTACHMENT_CONFLICT'; end if;
    update public.implementation_attachments set status='ready',updated_at=t where id=p_id returning * into a;
    insert into public.implementation_attachment_events(attachment_id,event) values(p_id,'ready') on conflict do nothing;
  elsif p_operation='remove' and a.status not in ('removing','removed') then
    update public.implementation_attachments set status='removing',updated_at=t,cleanup_after=greatest(t,expires_at+interval '2 minutes') where id=p_id returning * into a;
    insert into public.implementation_attachment_events(attachment_id,event) values(p_id,'removing') on conflict do nothing;
  end if;
  return to_jsonb(a);
end; $$;

-- Explicit maintenance only. Reads never expire requests or change storage.
create function public.prepare_v22_attachment_cleanup()
returns setof public.implementation_attachments language plpgsql security definer set search_path=public as $$
declare a public.implementation_attachments;
begin
  for a in select * from public.implementation_attachments where status='uploading' and expires_at<=clock_timestamp() order by expires_at limit 20 loop
    perform 1 from public.client_cases where id=a.case_id for update;
    update public.implementation_attachments set status='removing',updated_at=clock_timestamp(),cleanup_after=expires_at+interval '2 minutes'
      where id=a.id and status='uploading' and expires_at<=clock_timestamp();
    if found then insert into public.implementation_attachment_events(attachment_id,event) values(a.id,'removing') on conflict do nothing; end if;
  end loop;
  -- Tombstones are periodically revisited to remove a late object-store completion.
  return query select * from public.implementation_attachments where status in ('removing','removed') and cleanup_after<=clock_timestamp()
    order by cleanup_after,id limit 20;
end; $$;

create function public.finish_v22_attachment_cleanup(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare a public.implementation_attachments;
begin
  select * into a from public.implementation_attachments where id=p_id;
  perform 1 from public.client_cases where id=a.case_id for update;
  update public.implementation_attachments set status='removed',cleaned_at=coalesce(cleaned_at,clock_timestamp()),updated_at=clock_timestamp(),
    cleanup_after=clock_timestamp()+interval '24 hours'
    where id=p_id and status in ('removing','removed') and cleanup_after<=clock_timestamp();
  if found then insert into public.implementation_attachment_events(attachment_id,event) values(p_id,'removed') on conflict do nothing; end if;
end; $$;

revoke all on function public.v22_attachment_source(uuid,uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function public.v22_attachments(uuid,uuid,uuid,uuid,uuid,integer,text,text,text,uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.prepare_v22_attachment_cleanup(),public.finish_v22_attachment_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.v22_attachments(uuid,uuid,uuid,uuid,uuid,integer,text,text,text,uuid,text,text,integer,text),
  public.prepare_v22_attachment_cleanup(),public.finish_v22_attachment_cleanup(uuid) to service_role;

-- Plain PostgreSQL test runners have no Storage schema. Runtime checks fail closed if bucket provisioning is absent.
do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $s$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('implementation-files','implementation-files',false,2097152,array['image/png','image/jpeg','application/pdf'])
      on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types$s$;
    execute $s$create policy implementation_files_private on storage.objects as restrictive for all to anon,authenticated
      using(bucket_id<>'implementation-files') with check(bucket_id<>'implementation-files')$s$;
  end if;
end; $$;
commit;
